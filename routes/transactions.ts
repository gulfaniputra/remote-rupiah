import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql from "../db/client.ts";
import { lookupKmkRate } from "../services/kmk.ts";
import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono<{ Variables: { userId: string | undefined } }>();
const safeId = "00000000-0000-0000-0000-000000000000";

const schema = z.object({
  date: z.string().date(),
  currency: z.string().length(3).default("USD"),
  amountCents: z.union([z.number().int(), z.bigint()]).transform(v => BigInt(v)),
  withholdingCents: z.union([z.number().int(), z.bigint()]).default(0).transform(v => BigInt(v)),
  actualIdrReceivedCents: z.union([z.number().int(), z.bigint()]).optional().transform(v => v ? BigInt(v) : v),
  kmkRate: z.number().optional(),
  is1042sVerified: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

app.use("*", authMiddleware);

// deno-lint-ignore no-explicit-any
const withAuth = (id: string | undefined, fn: (tx: any) => Promise<any>) => 
  sql.begin(async tx => { await tx`SET LOCAL app.current_user_id = ${id || safeId}`; return fn(tx); });

const toSnake = (obj: Record<string, unknown>) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`), v]));

app.get("/", async c => c.json({ success: true, transactions: await withAuth(c.get("userId"), tx => tx`SELECT * FROM transactions`) }));

app.post("/", zValidator("json", schema), async c => {
  const d = c.req.valid("json");
  const rate = d.kmkRate ?? (await lookupKmkRate(d.date, d.currency))?.midRate;
  // deno-lint-ignore no-explicit-any
  const data = toSnake({...d, kmkRate: rate, userId: c.get("userId") || (safeId as any)}) as any;
  const res = await withAuth(c.get("userId"), tx => tx`INSERT INTO transactions ${tx(data)} RETURNING *`);
  return c.json({ success: true, data: res[0] }, 201);
});

app.get("/:id", zValidator("param", z.object({ id: z.string().uuid() })), async c => {
  const { id } = c.req.valid("param");
  const res = await withAuth(c.get("userId"), tx => tx`SELECT * FROM transactions WHERE id = ${id}`);
  return res[0] ? c.json({ success: true, data: res[0] }) : c.json({ error: "Not found" }, 404);
});

app.patch("/:id/verify", zValidator("param", z.object({ id: z.string().uuid() })), zValidator("json", z.object({ is_1042s_verified: z.boolean() })), async c => {
  const res = await withAuth(c.get("userId"), tx => tx`UPDATE transactions SET is_1042s_verified = ${c.req.valid("json").is_1042s_verified}, verified_at = NOW() WHERE id = ${c.req.valid("param").id} AND is_1042s_verified = FALSE RETURNING *`);
  return res[0] ? c.json({ success: true, data: res[0] }) : c.json({ error: "Not found or already verified" }, 404);
});

export default app;

