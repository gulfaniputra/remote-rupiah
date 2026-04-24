import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  syncKmkRates,
  lookupKmkRate,
  listKmkRates,
  backfillKmkRates,
} from "../services/kmk.ts";

const app = new Hono();

// ---------------------------------------------------------------------------
// Zod schemas for request validation
// ---------------------------------------------------------------------------

const lookupQuerySchema = z.object({
  date: z.string().date(), // YYYY-MM-DD
  currency: z.string().length(3).default("USD"),
});

const syncBodySchema = z.object({
  date: z.string().regex(/^\d{8}$/, "Date must be YYYYMMDD format").optional(),
  currency: z.string().min(3).optional(), // Can be "USD" or "USD,SGD,EUR"
});

const backfillBodySchema = z.object({
  weeks: z.number().int().min(1).max(52).default(4),
  currencies: z.array(z.string().length(3)).optional(),
});

const historyQuerySchema = z.object({
  currency: z.string().length(3).default("USD"),
  limit: z.coerce.number().int().min(1).max(104).default(52),
});

// ---------------------------------------------------------------------------
// GET /api/kmk/latest — Current week's KMK rate
// ---------------------------------------------------------------------------

app.get("/latest", async (c) => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const rate = await lookupKmkRate(today, "USD");

  if (!rate) {
    return c.json(
      {
        success: false,
        error: "No KMK rate found for the current week. Run POST /api/kmk/sync to fetch.",
      },
      404,
    );
  }

  return c.json({ success: true, data: rate });
});

// ---------------------------------------------------------------------------
// GET /api/kmk/lookup?date=YYYY-MM-DD&currency=USD
// Resolve KMK rate for a specific transaction date
// ---------------------------------------------------------------------------

app.get("/lookup", zValidator("query", lookupQuerySchema), async (c) => {
  const { date, currency } = c.req.valid("query");
  const rate = await lookupKmkRate(date, currency);

  if (!rate) {
    return c.json(
      {
        success: false,
        error: `No KMK rate found for ${currency} on ${date}. ` +
               "The rate may not have been synced yet.",
      },
      404,
    );
  }

  return c.json({ success: true, data: rate });
});

// ---------------------------------------------------------------------------
// GET /api/kmk/history?currency=USD&limit=52
// List stored KMK rates
// ---------------------------------------------------------------------------

app.get("/history", zValidator("query", historyQuerySchema), async (c) => {
  const { currency, limit } = c.req.valid("query");
  const rates = await listKmkRates(currency, limit);
  return c.json({ success: true, data: rates, count: rates.length });
});

// ---------------------------------------------------------------------------
// POST /api/kmk/sync — Manual trigger to fetch and upsert KMK rates
// ---------------------------------------------------------------------------

app.post("/sync", zValidator("json", syncBodySchema), async (c) => {
  const { date, currency } = c.req.valid("json");
  const authHeader = c.req.header("Authorization") || c.req.header("x-api-key");
  const expectedToken = Deno.env.get("ADMIN_API_KEY");
  
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const result = await syncKmkRates({ date, currency });

    const status = result.errors.length > 0 ? 207 : 200;
    return c.json({ success: true, ...result }, status);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 502);
  }
});

// ---------------------------------------------------------------------------
// POST /api/kmk/backfill — Trigger a historical backfill
// ---------------------------------------------------------------------------

app.post("/backfill", zValidator("json", backfillBodySchema), async (c) => {
  const { weeks, currencies } = c.req.valid("json");
  const authHeader = c.req.header("Authorization") || c.req.header("x-api-key");
  const expectedToken = Deno.env.get("ADMIN_API_KEY");

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const result = await backfillKmkRates(weeks, currencies);
    return c.json({ success: true, ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ success: false, error: message }, 500);
  }
});

export default app;
