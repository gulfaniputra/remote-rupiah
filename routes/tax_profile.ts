import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql from "../db/client.ts";
import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono<{ Variables: { userId: string } }>();
// deno-lint-ignore no-explicit-any
const withAuth = (c: any, fn: (tx: any) => Promise<any>) => sql.begin(async tx => { await tx`SET LOCAL app.current_user_id = ${c.get("userId") || "00000000-0000-0000-0000-000000000000"}`; return fn(tx); });

app.use("*", authMiddleware);
app.get("/", c => withAuth(c, tx => tx`SELECT * FROM user_tax_profiles`).then(r => c.json({ success: true, data: r[0] || null })));
app.post("/", zValidator("json", z.object({ npwp: z.string(), nik: z.string(), address: z.string(), kluCode: z.number().int().default(62010) })), async c => {
  const d = c.req.valid("json");
  const res = await withAuth(c, tx => tx`INSERT INTO user_tax_profiles (user_id, npwp, nik, address, klu_code) VALUES (${c.get("userId")}, ${d.npwp}, ${d.nik}, ${d.address}, ${d.kluCode}) ON CONFLICT (user_id) DO UPDATE SET npwp=EXCLUDED.npwp, nik=EXCLUDED.nik, address=EXCLUDED.address, klu_code=EXCLUDED.klu_code RETURNING *`);
  return c.json({ success: true, data: res[0] });
});

export default app;
