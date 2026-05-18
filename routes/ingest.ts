import { Hono } from "hono";
import { parseCsvFromStream } from "../services/csv_parser.ts";
import { authMiddleware } from "../services/auth_middleware.ts";
import sql from "../db/client.ts";
import { parseAmount } from "../services/math_utils.ts";

import postgres from "postgres";

const app = new Hono();

app.use("*", authMiddleware);

interface ValidatedIngestRow {
  user_id: string;
  date: string;
  currency: string;
  amount_cents: bigint;
  source_tx_id: string;
  metadata: Record<string, unknown>;
}

function parseIngestRow(r: unknown, uid: string): ValidatedIngestRow | null {
  if (typeof r !== "object" || r === null) return null;
  const obj = r as Record<string, unknown>;
  const amountStr = obj.amountStr;
  const date = obj.date;
  const source_tx_id = obj.source_tx_id;
  const currency = obj.currency;

  if (
    typeof amountStr !== "string" ||
    typeof date !== "string" ||
    typeof source_tx_id !== "string"
  ) {
    return null;
  }

  try {
    return {
      user_id: uid,
      date,
      currency: typeof currency === "string" ? currency : "USD",
      amount_cents: parseAmount(amountStr),
      source_tx_id,
      metadata: obj,
    };
  } catch {
    return null;
  }
}

app.post("/preview", async (c) => {
  try {
    const size = parseInt(c.req.header("Content-Length") || "0", 10);
    if (size > 5 * 1024 * 1024) return c.json({ success: false, error: "Payload too large (max 5MB)" }, 413);
    
    const ct = c.req.header("Content-Type") || "";
    if (ct.includes("multipart/form-data")) {
      const file = (await c.req.formData()).get("file");
      if (!file || !(file instanceof File)) return c.json({ success: false, error: "Missing 'file' field" }, 400);
      if (!file.name.endsWith(".csv")) return c.json({ success: false, error: "File must be .csv" }, 400);
      return c.json({ success: true, ...(await parseCsvFromStream(file.stream())) });
    }
    if (ct.includes("text/csv") || ct.includes("text/plain")) {
      if (!c.req.raw.body) return c.json({ success: false, error: "Empty body" }, 400);
      return c.json({ success: true, ...(await parseCsvFromStream(c.req.raw.body)) });
    }
    return c.json({ success: false, error: "Use multipart/form-data or text/csv" }, 415);
  } catch (e: unknown) {
    return c.json({ success: false, error: `Parse error: ${e instanceof Error ? e.message : e}` }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const contentLength = parseInt(c.req.header("content-length") || "0", 10);
    if (contentLength > 5 * 1024 * 1024) return c.json({ success: false, error: "Payload too large" }, 413);
    
    // For JSON, we still need to be careful. If Content-Length is missing or lied about,
    // c.req.json() could still buffer a lot. But Hono usually has a default limit.
    const { rows = [] } = await c.req.json() as { rows?: unknown[] };
    const uid = (c.get as (key: string) => unknown)("userId") as string;
    if (!uid) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!Array.isArray(rows) || rows.length > 5000) return c.json({ success: false, error: "Invalid or too many rows" }, 400);
    
    await sql.begin(async (t: postgres.TransactionSql) => {
      await t`SET LOCAL app.current_user_id = ${uid}`;
      const toInsert = rows
        .map((r) => parseIngestRow(r, uid))
        .filter((r): r is ValidatedIngestRow => r !== null);
      if (toInsert.length > 0) {
        await t`INSERT INTO transactions ${t(toInsert as unknown as Record<string, unknown>[])} ON CONFLICT (user_id, source_tx_id) DO NOTHING`;
      }
    });
    return c.json({ success: true, ingested: rows.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: `Ingest error: ${message}` }, 500);
  }
});

export default app;
