import { Hono, Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { syncKmkRates, lookupKmkRate, listKmkRates, backfillKmkRates } from "../services/kmk.ts";

const app = new Hono(), key = Deno.env.get("ADMIN_API_KEY");
const check = (c: Context) => {
  if (!key) return false;
  return (c.req.header("Authorization") || c.req.header("x-api-key")) === `Bearer ${key}`;
};

app.get("/latest", async c => {
  const r = await lookupKmkRate(new Date().toISOString().slice(0, 10), "USD");
  return r ? c.json({ success: true, data: r }) : c.json({ error: "Not synced" }, 404);
});

app.get("/lookup", zValidator("query", z.object({ date: z.string().date(), currency: z.string().length(3).default("USD") })), async c => {
  const { date, currency } = c.req.valid("query");
  const r = await lookupKmkRate(date, currency);
  return r ? c.json({ success: true, data: r }) : c.json({ error: "Not found" }, 404);
});

app.get("/history", zValidator("query", z.object({ currency: z.string().length(3).default("USD"), limit: z.coerce.number().default(52) })), async c => {
  const { currency, limit } = c.req.valid("query");
  const r = await listKmkRates(currency, limit);
  return c.json({ success: true, data: r, count: r.length });
});

app.post("/sync", zValidator("json", z.object({ date: z.string().optional(), currency: z.string().optional() })), async c => {
  if (!check(c)) return c.json({ error: "Unauthorized" }, 401);
  try {
    const res = await syncKmkRates(c.req.valid("json"));
    return c.json({ success: true, ...res }, res.errors.length ? 207 : 200);
  } catch (e: unknown) { return c.json({ success: false, error: e instanceof Error ? e.message : String(e) }, 502); }
});

app.post("/backfill", zValidator("json", z.object({ weeks: z.number().default(4), currencies: z.array(z.string().length(3)).optional() })), async c => {
  if (!check(c)) return c.json({ error: "Unauthorized" }, 401);
  const { weeks, currencies } = c.req.valid("json");
  try { return c.json({ success: true, ...(await backfillKmkRates(weeks, currencies)) }); }
  catch (e: unknown) { return c.json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500); }
});


export default app;


