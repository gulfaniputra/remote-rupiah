import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql from "../db/client.ts";
import { lookupKmkRate } from "../services/kmk.ts";
import { authMiddleware } from "../services/auth_middleware.ts";
import postgres from "postgres";

const app = new Hono();

const schema = z.object({
  date: z.string().date(),
  currency: z.string().length(3).default("USD"),
  amountCents: z.string().regex(/^\d+$/).transform(BigInt),
  withholdingCents: z.string().regex(/^\d+$/).default("0").transform(BigInt),
  actualIdrReceivedCents: z
    .string()
    .regex(/^\d+$/)
    .transform(BigInt)
    .optional(),
  kmkRate: z.number().optional(),
  is1042sVerified: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

// Output validation — enforces strings for all BIGINT database extractions
export const txOutputSchema = z.object({
  id: z.string(),
  date: z.preprocess(
    (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
    z.string(),
  ),
  currency: z.string(),
  amount_cents: z.string(),
  withholding_cents: z.string(),
  actual_idr_received_cents: z.string().nullable(),
  kmk_rate: z.string().nullable(),
  is_1042s_verified: z.boolean(),
  metadata: z.record(z.unknown()).nullable().optional(),
});

export const serializeTx = (row: Record<string, unknown>) =>
  txOutputSchema.parse(row);

app.use("*", authMiddleware);

const withAuth = <T>(
  id: string | undefined,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> =>
  sql.begin(async (tx) => {
    if (!id) throw new Error("Authentication required");
    await tx`SET LOCAL app.current_user_id = ${id}`;
    return fn(tx);
  }) as Promise<T>;

const toSnake = (obj: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`),
      v,
    ]),
  );

const userId = (c: { get: unknown }) =>
  (c.get as (key: string) => unknown)("userId") as string | undefined;

app.get("/", (c) =>
  withAuth(userId(c), (tx) => tx`SELECT * FROM transactions`).then((txs) =>
    c.json({
      success: true,
      transactions: (txs as Record<string, unknown>[]).map(serializeTx),
    }),
  ),
);

app.post("/", zValidator("json", schema), async (c) => {
  const d = c.req.valid("json");
  const rate = d.kmkRate ?? (await lookupKmkRate(d.date, d.currency))?.midRate;
  const uid = userId(c);
  return withAuth(
    uid,
    (tx) =>
      tx`INSERT INTO transactions ${tx(toSnake({ ...d, kmkRate: rate, userId: uid || "" }) as Record<string, unknown>)} RETURNING *`,
  ).then((res) =>
    c.json(
      {
        success: true,
        data: res[0]
          ? serializeTx(res[0] as Record<string, unknown>)
          : undefined,
      },
      201,
    ),
  );
});

app.get("/:id", zValidator("param", z.object({ id: z.string().uuid() })), (c) =>
  withAuth(
    userId(c),
    (tx) =>
      tx`SELECT * FROM transactions WHERE id = ${c.req.valid("param").id}`,
  ).then((res) =>
    res[0]
      ? c.json({
          success: true,
          data: serializeTx(res[0] as Record<string, unknown>),
        })
      : c.json({ error: "Not found" }, 404),
  ),
);

app.patch("/:id/verify", (c) => {
  const id = c.req.param("id");
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id,
  )
    ? Promise.resolve(c.json({ error: "Invalid ID" }, 400))
    : withAuth(
        userId(c),
        (tx) =>
          tx`UPDATE transactions SET is_1042s_verified = TRUE, verified_at = NOW() WHERE id = ${id} AND is_1042s_verified = FALSE RETURNING *`,
      ).then((res) =>
        res[0]
          ? c.json({
              success: true,
              data: serializeTx(res[0] as Record<string, unknown>),
            })
          : c.json({ error: "Fail" }, 404),
      );
});

app.patch(
  "/:id/verify",
  authMiddleware,
  zValidator("param", z.object({ id: z.string().uuid() })),
  (c) =>
    // Cast c.get as any to bypass the key check
    withAuth(
      (c.get as any)("userId"),
      (tx) =>
        tx`UPDATE transactions 
         SET is_1042s_verified = TRUE, verified_at = CURRENT_TIMESTAMP 
         WHERE id = ${c.req.valid("param").id} 
         RETURNING id`,
    ).then((res: unknown) => {
      const rows = res as { id: string }[];
      return rows.length > 0
        ? c.json({ success: true })
        : c.json({ error: "Not found" }, 404);
    }),
);

export default app;
