import sql from "../../db/client.ts";

export const recordConversion = (u: string, c: bigint) => sql.begin(async tx => {
  await tx`SELECT set_config('app.current_user_id', ${u}, true)`;
  let rem = c;
  for (const { id, unspent_usd_cents } of await tx`SELECT id, unspent_usd_cents FROM transactions WHERE unspent_usd_cents > 0 ORDER BY date ASC, id ASC FOR UPDATE`) {
    if (rem <= 0n) break;
    const uns = BigInt(unspent_usd_cents), dep = rem > uns ? uns : rem;
    await tx`UPDATE transactions SET unspent_usd_cents = unspent_usd_cents - ${dep} WHERE id = ${id}`;
    rem -= dep;
  }
  if (rem > 0n) throw new Error("Insufficient unspent USD");
});
