import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { verify } from "hono/jwt";
import sql from "../db/client.ts";
import { lookupKmkRate } from "../services/kmk.ts";

const app = new Hono<{ Variables: { userId: string | undefined } }>();
const safeId = "00000000-0000-0000-0000-000000000000";

const schema = z.object({
  date: z.string().date(),
  currency: z.string().length(3).default("USD"),
  amountCents: z.number().int().nonnegative(),
  withholdingCents: z.number().int().default(0),
  actualIdrReceivedCents: z.number().int().optional(),
  kmkRate: z.number().optional(),
  is1042sVerified: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

app.use("*", async (c, next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Authorization required" }, 401);
  const secret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) return c.json({ error: "Server misconfigured" }, 500);
  try {
    const decoded = await verify(auth.split(" ")[1], secret, "HS256");
    c.set("userId", decoded.sub as string);
  } catch { return c.json({ error: "Invalid token" }, 401); }
  await next();
});

const withAuth = (id: string | undefined, fn: (tx: any) => any) => 
  sql.begin(async tx => { await tx`SET LOCAL request.jwt.claim.sub = ${id || safeId}`; return fn(tx); });

const toSnake = (obj: any) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`), v]));

app.get("/", async c => c.json({ success: true, transactions: await withAuth(c.get("userId"), tx => tx`SELECT * FROM transactions`) }));

app.post("/", zValidator("json", schema), async c => {
  const d = c.req.valid("json");
  const rate = d.kmkRate ?? (await lookupKmkRate(d.date, d.currency))?.midRate;
  const res = await withAuth(c.get("userId"), tx => tx`INSERT INTO transactions ${tx(toSnake({...d, kmkRate: rate, userId: c.get("userId") || safeId}))} RETURNING *`);
  return c.json({ success: true, data: res[0] }, 201);
});

app.get("/:id", async c => {
  const res = await withAuth(c.get("userId"), tx => tx`SELECT * FROM transactions WHERE id = ${c.req.param("id")}`);
  return res[0] ? c.json({ success: true, data: res[0] }) : c.json({ error: "Not found" }, 404);
});

export default app;
