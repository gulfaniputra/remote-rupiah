import { Hono } from "hono";
import { authMiddleware } from "../services/auth_middleware.ts";
import { withAuth } from "../db/client.ts";
import { CsvParseStream } from "@std/csv";
import { detectPlatform } from "../services/ingestion/detector.ts";
import { mapCsvRow } from "../backend/src/services/ingestion/csv-mapper.ts";
import { mapRevolutRow } from "../services/ingestion/revolut_parser.ts";
import { mapPaypalRow } from "../services/ingestion/paypal_parser.ts";
import { mapWiseRow } from "../services/ingestion/wise_parser.ts";

const app = new Hono();
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
const ROW_MAPPERS = {
  wise: mapWiseRow,
  revolut: mapRevolutRow,
  paypal: mapPaypalRow,
} as const;
type CanonicalRow = {
  date: Date;
  amount: bigint;
  currency: string;
};

app.use("*", authMiddleware);

const readBodyWithLimit = async (
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
) => {
  if (!body) return null;

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) return null;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
};

const parseCsvRows = async (body: string) => {
  const rows: Record<string, string>[] = [];
  let headers: string[] = [];
  let isFirst = true;
  for await (
    const record of new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }).pipeThrough(new TextDecoderStream()).pipeThrough(new CsvParseStream())
  ) {
    if (isFirst) {
      headers = record.map((value) => String(value));
      isFirst = false;
      continue;
    }
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = record[i] ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
};

const loadCsvMapping = (uid: string) =>
  withAuth(uid, async (tx) => {
    const rows = await tx`
      SELECT mapping FROM csv_mappings
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return rows[0]?.mapping ?? null;
  });

const serialize = (row: {
  external_id: string;
  date: string;
  currency: string;
  amount_cents: bigint;
  actual_idr_received_cents: bigint | null;
  metadata: Record<string, unknown>;
}) => ({
  source_tx_id: row.external_id,
  date: row.date,
  currency: row.currency,
  amount_cents: row.amount_cents,
  actual_idr_received_cents: row.actual_idr_received_cents,
  metadata: row.metadata,
});

const serializeCanonical = (
  row: CanonicalRow,
  sourceTxId: string,
  metadata: Record<string, unknown>,
) => ({
  source_tx_id: sourceTxId,
  date: row.date.toISOString().split("T")[0],
  currency: row.currency,
  amount_cents: row.amount,
  actual_idr_received_cents: null,
  metadata,
});

app.post("/", async (c) => {
  try {
    const ct = c.req.header("Content-Type") || "";
    const body = await readBodyWithLimit(c.req.raw.body, MAX_PAYLOAD_BYTES);
    if (body === null) {
      return c.json({ success: false, error: "Payload too large" }, 413);
    }
    if (!ct.includes("text/csv") && !ct.includes("text/plain")) {
      return c.json({ success: false, error: "Use text/csv" }, 415);
    }

    const { headers, rows } = await parseCsvRows(body);
    const platform = detectPlatform(headers.join(","));
    const uid = (c.get as (key: string) => unknown)("userId") as string;
    if (!uid) return c.json({ success: false, error: "Unauthorized" }, 401);

    const mapped = platform
      ? rows.map((row) => serialize(ROW_MAPPERS[platform](row)))
      : await (async () => {
        const mapping = await loadCsvMapping(uid);
        if (!mapping) {
          return null;
        }

        const decoded = rows.map((row) => mapCsvRow(row, mapping, headers));
        const failed = decoded.find((result) => !result.ok);
        if (failed && !failed.ok) {
          return c.json(
            { success: false, error: failed.error, headers },
            400,
          );
        }

        return decoded.map((result, index) =>
          serializeCanonical(
            (result as { ok: true; value: CanonicalRow }).value,
            String(index),
            rows[index] ?? {},
          )
        );
      })();

    if (mapped === null) {
      return c.json(
        { success: false, error: "CSV mapping required", headers },
        428,
      );
    }
    if (!Array.isArray(mapped)) {
      return mapped;
    }

    if (mapped.length > 0) {
      await withAuth(uid, async (tx, userId) => {
        await tx`INSERT INTO transactions ${
          tx(mapped.map((row) => ({
            user_id: userId,
            date: row.date,
            currency: row.currency,
            amount_cents: row.amount_cents,
            source_tx_id: row.source_tx_id,
            metadata: row.metadata,
            actual_idr_received_cents: row.actual_idr_received_cents,
          })) as unknown as Record<string, unknown>[])
        } ON CONFLICT (user_id, source_tx_id) DO NOTHING`;
      });
    }

    return c.json({ success: true, ingested: mapped.length, platform });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: `Ingest error: ${message}` }, 500);
  }
});

export default app;
