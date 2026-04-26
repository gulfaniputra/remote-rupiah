import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql from "../db/client.ts";
import { lookupKmkRate } from "../services/kmk.ts";

const app = new Hono();
const safeId = "00000000-0000-0000-0000-000000000000";

const schema = z.object({
  date: z.string().date(),
  currency: z.string().length(3).default("USD"),
  amountCents: z.number().int(),
  withholdingCents: z.number().int().default(0),
  actualIdrReceivedCents: z.number().int().optional(),
  kmkRate: z.number().optional(),
  is1042sVerified: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

const withAuth = (id: string | undefined, fn: (tx: any) => any) => 
  sql.begin(async tx => { await tx`SET LOCAL request.jwt.claim.sub = ${id || safeId}`; return fn(tx); });

const toSnake = (obj: any) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`), v]));

app.get("/", async c => c.json({ success: true, transactions: await withAuth(c.req.header("x-user-id"), tx => tx`SELECT * FROM transactions`) }));

app.post("/", zValidator("json", schema), async c => {
  const d = c.req.valid("json");
  const rate = d.kmkRate ?? (await lookupKmkRate(d.date, d.currency))?.midRate;
  const res = await withAuth(c.req.header("x-user-id"), tx => tx`INSERT INTO transactions ${tx(toSnake({...d, kmkRate: rate, userId: c.req.header("x-user-id") || safeId}))} RETURNING *`);
  return c.json({ success: true, data: res[0] }, 201);
});

app.get("/:id", async c => {
  const res = await withAuth(c.req.header("x-user-id"), tx => tx`SELECT * FROM transactions WHERE id = ${c.req.param("id")}`);
  return res[0] ? c.json({ success: true, data: res[0] }) : c.json({ error: "Not found" }, 404);
});

app.patch("/:id", zValidator("json", schema.partial()), async c => {
  const updates = toSnake(c.req.valid("json"));
  if (!Object.keys(updates).length) return c.json({ error: "No fields" }, 400);
  const res = await withAuth(c.req.header("x-user-id"), tx => tx`UPDATE transactions SET ${tx(updates)} WHERE id = ${c.req.param("id")} RETURNING *`);
  return res[0] ? c.json({ success: true, data: res[0] }) : c.json({ error: "Not found" }, 404);
});

app.delete("/:id", async c => {
  const res = await withAuth(c.req.header("x-user-id"), tx => tx`DELETE FROM transactions WHERE id = ${c.req.param("id")} RETURNING id`);
  return res[0] ? c.json({ success: true, id: c.req.param("id") }) : c.json({ error: "Not found" }, 404);
});

export default app;

