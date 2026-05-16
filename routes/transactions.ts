import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql from "../db/client.ts";
import { lookupKmkRate } from "../services/kmk.ts";
import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono<{ Variables: { userId: string | undefined } }>();

const schema = z.object({
  date: z.string().date(),
  currency: z.string().length(3).default("USD"),
  amountCents: z.string().regex(/^\d+$/).transform(BigInt),
  withholdingCents: z.string().regex(/^\d+$/).default("0").transform(BigInt),
  actualIdrReceivedCents: z.string().regex(/^\d+$/).transform(BigInt).optional(),
  kmkRate: z.number().optional(),
  is1042sVerified: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

app.use("*", authMiddleware);

// deno-lint-ignore no-explicit-any
const withAuth = (id: string | undefined, fn: (tx: any) => Promise<any>) => 
  sql.begin(async tx => { 
    if (!id) throw new Error("Authentication required");
    await tx`SET LOCAL app.current_user_id = ${id}`; 
    return fn(tx); 
  });

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

app.patch("/:id/verify", async c => {
  const id = c.req.param("id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return c.json({ error: "Invalid ID" }, 400);
  const res = await withAuth(c.get("userId"), tx => tx`UPDATE transactions SET is_1042s_verified = TRUE, verified_at = NOW() WHERE id = ${id} AND is_1042s_verified = FALSE RETURNING *`);
  return res[0] ? c.json({ success: true, data: res[0] }) : c.json({ error: "Fail" }, 404);
});




export default app;

