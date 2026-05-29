import sql from "../../db/client.ts";
import postgres from "postgres";

export const recordConversion = (u: string, c: bigint) =>
  sql.begin(async (tx: postgres.TransactionSql<Record<string, unknown>>) => {
    await tx`SELECT set_config('app.current_user_id', ${u}, true)`;
    let rem = c;
    const rows =
      await tx`SELECT id, unspent_usd_cents FROM transactions WHERE unspent_usd_cents > 0 ORDER BY date ASC, id ASC FOR UPDATE`;
    for (const r of rows) {
      if (rem <= 0n) break;
      const uns = BigInt(r.unspent_usd_cents as string),
        dep = rem > uns ? uns : rem;
      const id = r.id as string;
      await tx`UPDATE transactions SET unspent_usd_cents = unspent_usd_cents - ${dep} WHERE id = ${id}`;
      rem -= dep;
    }
    if (rem > 0n) throw new Error("Insufficient unspent USD");
  });
