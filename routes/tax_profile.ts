import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql from "../db/client.ts";
import postgres from "postgres";

import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono();

const schema = z.object({
  npwp: z.string().transform(v => v.replace(/[\.\-]/g, "")).pipe(z.string().regex(/^\d{15,16}$/)),
  nik: z.string().length(16),
  address: z.string(),
  kluCode: z.union([z.string(), z.number()]).transform(v => String(v)).pipe(z.string().length(5)),
});

app.use("*", authMiddleware);



const withAuth = <T>(
  id: string | undefined,
  fn: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> =>
  sql.begin(async (tx) => { 
    if (!id) throw new Error("Unauthorized");
    await tx`SET LOCAL app.current_user_id = ${id}`; 
    return fn(tx); 
  }) as Promise<T>;

app.get("/", c => withAuth((c.get as (key: string) => unknown)("userId") as string | undefined, tx => tx`SELECT * FROM user_tax_profiles`).then(profiles => c.json({ success: true, data: profiles[0] || null })));

app.post("/", zValidator("json", schema), c => {
  const d = c.req.valid("json");
  const uid = (c.get as (key: string) => unknown)("userId") as string | undefined;
  return withAuth(uid, tx => tx`INSERT INTO user_tax_profiles (user_id, npwp, nik, address, klu_code) VALUES (${uid || ""}, ${d.npwp}, ${d.nik}, ${d.address}, ${d.kluCode}) ON CONFLICT (user_id) DO UPDATE SET npwp=EXCLUDED.npwp, nik=EXCLUDED.nik, address=EXCLUDED.address, klu_code=EXCLUDED.klu_code RETURNING *`)
    .then(res => c.json({ success: true, data: res[0] }));
});

export default app;
