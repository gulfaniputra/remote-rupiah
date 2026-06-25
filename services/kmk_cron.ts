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

// Safer, idiomatic environment check for static analyzers:
const hasCron =
  "cron" in Deno && typeof (Deno as { cron?: unknown }).cron === "function";

if (hasCron) {
  // Primary Sync: Tuesday 18:00 UTC = Wednesday 01:00 WIB
  Deno.cron("kmk-rate-sync-primary", "0 18 * * 2", async () => {
    console.log(
      "[KMK Cron] Primary sync triggered (Tue 18:00 UTC / Wed 01:00 WIB)",
    );
    await performSync(CURRENCY_STRING);
  });

  // Fallback Sync: Wednesday 06:00 UTC = Wednesday 13:00 WIB
  Deno.cron("kmk-rate-sync-fallback", "0 6 * * 3", async () => {
    console.log(
      "[KMK Cron] Fallback sync triggered (Wed 06:00 UTC / Wed 13:00 WIB)",
    );
    await performSync(CURRENCY_STRING);
  });

  // Robustness: Sunday 17:00 UTC = Monday 00:00 WIB
  Deno.cron("kmk-rate-backfill", "0 17 * * 0", async () => {
    console.log(
      "[KMK Cron] Periodic backfill triggered (Sun 17:00 UTC / Mon 00:00 WIB)",
    );
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
} else {
  console.warn(
    "[KMK Cron] Deno.cron is not available in this environment. Skipping registration.",
  );
}
