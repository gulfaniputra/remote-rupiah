import { backfillKmkRates, syncKmkRates } from "./kmk.ts";

const DEFAULT_CURRENCIES = ["USD", "SGD", "EUR", "AUD", "JPY"];
const CURRENCY_STRING = DEFAULT_CURRENCIES.join(",");

async function performSync(currencyList: string): Promise<void> {
  try {
    const result = await syncKmkRates({ currency: currencyList });
    console.log(
      `[KMK Cron] Sync Complete: +${result.inserted}, skip:${result.skipped}` +
        (result.errors.length > 0 ? `, err:${result.errors.join("; ")}` : ""),
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KMK Cron] Sync failed: ${message}`);
  }
}

/**
 * Initializes cron jobs.
 * Only call this in production environments where Deno.cron is supported.
 */
export function initKmkCron() {
  // 1. Guard Clause: Must come first
  if (!Deno.env.has("DENO_DEPLOYMENT_ID") || typeof Deno.cron !== "function") {
    console.info(
      "[KMK Cron] Skipping registration: Not in Deno Deploy environment.",
    );
    return;
  }

  // 2. Register Cron Jobs

  // Deno.cron uses standard 0-6 day-of-week (0=Sun, 1=Mon, … 6=Sat).
  // Do not use named abbreviations (TUE, WED, SUN). The Deploy API rejects them.

  // Primary Sync: Tuesday 18:00 UTC
  Deno.cron("kmk-rate-sync-primary", "0 18 * * 2", async () => {
    console.log("[KMK Cron] Primary sync triggered (Tue 18:00 UTC)");
    await performSync(CURRENCY_STRING);
  });

  // Fallback Sync: Wednesday 06:00 UTC
  Deno.cron("kmk-rate-sync-fallback", "0 6 * * 3", async () => {
    console.log("[KMK Cron] Fallback sync triggered (Wed 06:00 UTC)");
    await performSync(CURRENCY_STRING);
  });

  // Robustness Backfill: Sunday 17:00 UTC
  Deno.cron("kmk-rate-backfill", "0 17 * * 0", async () => {
    console.log("[KMK Cron] Periodic backfill triggered (Sun 17:00 UTC)");
    try {
      const result = await backfillKmkRates(4, DEFAULT_CURRENCIES);
      console.log(
        `[KMK Cron] Backfill Complete: +${result.inserted}, skip:${result.skipped}` +
          (result.errors.length > 0 ? `, err:${result.errors.length}` : ""),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[KMK Cron] Backfill failed: ${message}`);
    }
  });
}
