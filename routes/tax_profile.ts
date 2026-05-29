import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql, { requireUserId, UserId, withAuth } from "../db/client.ts";
import postgres from "postgres";

import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono();

const schema = z.object({
  npwp: z.string().transform((v) => v.replace(/[\.\-]/g, "")).pipe(
    z.string().regex(/^\d{15,16}$/),
  ),
  nik: z.string().length(16),
  address: z.string(),
  kluCode: z.union([z.string(), z.number()]).transform((v) => String(v)).pipe(
    z.string().length(5),
  ),
});

app.use("*", authMiddleware);

export type TaxProfileInput = {
  npwp: string;
  nik: string;
  address: string;
  kluCode: string;
};

export async function createTaxProfile(
  userId: string | undefined,
  data: TaxProfileInput,
  tx?: postgres.TransactionSql,
) {
  const validatedUserId = requireUserId(userId);
  const runQuery = (t: postgres.TransactionSql) =>
    t`
    INSERT INTO user_tax_profiles (user_id, npwp, nik, address, klu_code)
    VALUES (${validatedUserId}, ${data.npwp}, ${data.nik}, ${data.address}, ${data.kluCode})
    ON CONFLICT (user_id)
    DO UPDATE SET
      npwp = EXCLUDED.npwp,
      nik = EXCLUDED.nik,
      address = EXCLUDED.address,
      klu_code = EXCLUDED.klu_code
    RETURNING *
  `;
  if (tx) {
    return runQuery(tx);
  }
  return withAuth(validatedUserId, (t) => runQuery(t));
}

app.get("/", (c) => {
  const uid = (c.get as (key: string) => unknown)("userId") as
    | string
    | undefined;
  return withAuth(uid, (tx) => tx`SELECT * FROM user_tax_profiles`)
    .then((profiles) => c.json({ success: true, data: profiles[0] || null }));
});

app.post("/", zValidator("json", schema), (c) => {
  const d = c.req.valid("json");
  const uid = (c.get as (key: string) => unknown)("userId") as
    | string
    | undefined;
  return withAuth(uid, (tx, userId) => createTaxProfile(userId, d, tx))
    .then((res) => c.json({ success: true, data: res[0] }));
});

export default app;
