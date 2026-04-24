import { Hono, Context } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import postgres from "postgres";
import sql from "../db/client.ts";
import { lookupKmkRate } from "../services/kmk.ts";

const app = new Hono();

// Transaction Schema for Validation enforcing Zod usage
export const transactionSchema = z.object({
  date: z.string().date(),
  currency: z.string().length(3).default("USD"),
  amountCents: z.number().int(),
  withholdingCents: z.number().int().default(0),
  actualIdrReceivedCents: z.number().int().optional(),
  kmkRate: z.number().optional(),
  is1042sVerified: z.boolean().default(false),
  metadata: z.record(z.any()).optional(),
});

// Helper to bind the user's RLS session within a Postgres transaction block
function withAuth<T>(userId: string | undefined, query: (tx: postgres.Sql) => Promise<T>) {
  // Using a fallback safe ID if unused, realistically should 401 earlier via middleware
  const safeUserId = userId || "00000000-0000-0000-0000-000000000000";
  return sql.begin(async (tx) => {
    await tx`SET LOCAL request.jwt.claim.sub = ${safeUserId}`;
    return await query(tx);
  });
}

app.get("/", async (c: Context) => {
  const userId = c.req.header("x-user-id");
  const transactions = await withAuth(userId, async (tx) => {
    return await tx`SELECT * FROM transactions`;
  });
  return c.json({ success: true, transactions });
});

app.post("/", zValidator("json", transactionSchema), async (c) => {
  const data = c.req.valid("json");
  const userId = c.req.header("x-user-id");

  // Auto-resolve KMK rate from the stored weekly rates if not explicitly provided.
  // Per tax_compliance rule: "Use the weekly KMK rate for the date of receipt."
  let resolvedKmkRate = data.kmkRate ?? null;
  if (resolvedKmkRate === null) {
    const kmkEntry = await lookupKmkRate(data.date, data.currency);
    if (kmkEntry) {
      resolvedKmkRate = parseFloat(kmkEntry.midRate);
    }
  }

  const result = await withAuth(userId, async (tx) => {
    return await tx`
      INSERT INTO transactions (
        user_id, date, currency, amount_cents, withholding_cents, 
        actual_idr_received_cents, kmk_rate, is_1042s_verified, metadata
      ) VALUES (
        ${userId || "00000000-0000-0000-0000-000000000000"}, ${data.date}, ${data.currency}, ${data.amountCents}, 
        ${data.withholdingCents}, ${data.actualIdrReceivedCents ?? null}, 
        ${resolvedKmkRate}, ${data.is1042sVerified}, ${data.metadata ?? null}
      )
      RETURNING *
    `;
  });

  return c.json({ success: true, data: result[0] }, 201);
});

app.get("/:id", async (c: Context) => {
  const id = c.req.param("id");
  const userId = c.req.header("x-user-id");

  const result = await withAuth(userId, async (tx) => {
    return await tx`SELECT * FROM transactions WHERE id = ${id}`;
  });

  if (result.length === 0) return c.json({ success: false, error: "Not found" }, 404);
  return c.json({ success: true, data: result[0] });
});

app.patch("/:id", zValidator("json", transactionSchema.partial()), async (c) => {
  const id = c.req.param("id");
  const updates = c.req.valid("json");
  const userId = c.req.header("x-user-id");

  const dbUpdates: Record<string, unknown> = {};
  if (updates.date !== undefined) dbUpdates.date = updates.date;
  if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
  if (updates.amountCents !== undefined) dbUpdates.amount_cents = updates.amountCents;
  if (updates.withholdingCents !== undefined) dbUpdates.withholding_cents = updates.withholdingCents;
  if (updates.actualIdrReceivedCents !== undefined) dbUpdates.actual_idr_received_cents = updates.actualIdrReceivedCents;
  if (updates.kmkRate !== undefined) dbUpdates.kmk_rate = updates.kmkRate;
  if (updates.is1042sVerified !== undefined) dbUpdates.is_1042s_verified = updates.is1042sVerified;
  if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata;

  if (Object.keys(dbUpdates).length === 0) {
    return c.json({ success: false, error: "No fields to update" }, 400);
  }

  const result = await withAuth(userId, async (tx) => {
    return await tx`
      UPDATE transactions 
      SET ${tx(dbUpdates)} 
      WHERE id = ${id} 
      RETURNING *
    `;
  });

  if (result.length === 0) return c.json({ success: false, error: "Not found" }, 404);
  return c.json({ success: true, data: result[0] });
});

app.delete("/:id", async (c: Context) => {
  const id = c.req.param("id");
  const userId = c.req.header("x-user-id");

  const result = await withAuth(userId, async (tx) => {
    return await tx`DELETE FROM transactions WHERE id = ${id} RETURNING id`;
  });

  if (result.length === 0) return c.json({ success: false, error: "Not found" }, 404);
  return c.json({ success: true, id });
});

export default app;
