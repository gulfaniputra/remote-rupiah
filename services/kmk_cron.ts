import { syncKmkRates, backfillKmkRates } from "./kmk.ts";

/**
 * Register the KMK rate sync cron job.
 *
 * KMK rates rotate every Wednesday. We fetch at 01:00 WIB (UTC+7),
 * which is 18:00 UTC on Tuesday, giving the portal time to publish.
 *
 * Deno.cron uses UTC, so "Wednesday 01:00 WIB" = "Tuesday 18:00 UTC".
 * We add a second run on Wednesday 06:00 UTC (13:00 WIB) as a fallback
 * in case the portal publishes late.
 */
export function registerKmkCron(): void {
  const DEFAULT_CURRENCIES = ["USD", "SGD", "EUR", "AUD", "JPY"];

  // Primary Sync: Tuesday 18:00 UTC = Wednesday 01:00 WIB
  Deno.cron("kmk-rate-sync-primary", "0 18 * * 2", async () => {
    console.log("[KMK Cron] Primary sync triggered (Tue 18:00 UTC / Wed 01:00 WIB)");
    await performSync(DEFAULT_CURRENCIES);
  });

  // Fallback Sync: Wednesday 06:00 UTC = Wednesday 13:00 WIB
  Deno.cron("kmk-rate-sync-fallback", "0 6 * * 3", async () => {
    console.log("[KMK Cron] Fallback sync triggered (Wed 06:00 UTC / Wed 13:00 WIB)");
    await performSync(DEFAULT_CURRENCIES);
  });

  // Robustness: Sunday 17:00 UTC = Monday 00:00 WIB
  // Perform a 4-week backfill to ensure no gaps from portal downtime or network issues.
  Deno.cron("kmk-rate-backfill", "0 17 * * 0", async () => {
    console.log("[KMK Cron] Periodic backfill triggered (Sun 17:00 UTC / Mon 00:00 WIB)");
    try {
      const result = await backfillKmkRates(4, DEFAULT_CURRENCIES);
      console.log(
        `[KMK Cron] Backfill Done — inserted: ${result.inserted}, skipped: ${result.skipped}` +
        (result.errors.length > 0 ? `, errors: ${result.errors.length}` : ""),
      );
    } catch (err: unknown) {
      console.error(`[KMK Cron] Backfill failed: ${err}`);
    }
  });

  console.log("[KMK Cron] Registered primary, fallback, and weekly backfill schedules");
}

async function performSync(currencies: string[]): Promise<void> {
  try {
    const result = await syncKmkRates({ currency: currencies.join(",") });
    console.log(
      `[KMK Cron] Done — inserted: ${result.inserted}, skipped: ${result.skipped}` +
      (result.errors.length > 0 ? `, errors: ${result.errors.join("; ")}` : ""),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KMK Cron] Sync failed: ${message}`);
  }
}
