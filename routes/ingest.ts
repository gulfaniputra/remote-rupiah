import { Hono } from "hono";
import { parseCsvFromStream } from "../services/csv_parser.ts";
import { authMiddleware } from "../services/auth_middleware.ts";
import sql from "../db/client.ts";
import { parseAmount } from "../backend/services/wise_parser.ts";

const app = new Hono();

app.use("*", authMiddleware);

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
    if (parseInt(c.req.header("content-length") || "0", 10) > 5 * 1024 * 1024) return c.json({ success: false, error: "Payload too large" }, 413);
    const { rows = [] } = await c.req.json(), uid = c.get("userId");
    if (!uid) return c.json({ success: false, error: "Unauthorized" }, 401);
    if (!Array.isArray(rows) || rows.length > 5000) return c.json({ success: false, error: "Invalid or too many rows" }, 400);
    await sql.begin(async (t) => {
      await t`SET LOCAL app.current_user_id = ${uid}`;
      const toInsert = rows
        .filter(r => r.amountStr && r.date && r.source_tx_id)
        .map(r => ({
          user_id: uid,
          date: r.date,
          currency: r.currency || 'USD',
          amount_cents: parseAmount(r.amountStr),
          source_tx_id: r.source_tx_id,
          metadata: r
        }));
      if (toInsert.length > 0) {
        await t`INSERT INTO transactions ${t(toInsert)} ON CONFLICT (user_id, source_tx_id) DO NOTHING`;
      }
    });
    return c.json({ success: true, ingested: rows.length });
  } catch (e: any) { return c.json({ success: false, error: `Ingest error: ${e.message||e}` }, 500); }
});

export default app;
