import { backfillKmkRates, syncKmkRates } from "./kmk.ts";

// Lazy KV instance – only opened when first needed
let kvInstance: Deno.Kv | null = null;
async function getKv(): Promise<Deno.Kv> {
  if (!kvInstance) {
    kvInstance = await Deno.openKv();
  }
  return kvInstance;
}

const DEFAULT_CURRENCIES = ["USD", "SGD", "EUR", "AUD", "JPY"];
const CURRENCY_STRING = DEFAULT_CURRENCIES.join(",");

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

  try {
    console.log("[KMK Cron] Registering cron jobs...");

    Deno.cron("kmk-rate-sync-primary", "0 0 18 * * 2", async () => {
      console.log("[KMK Cron] Primary sync triggered (Tue 18:00 UTC)");
      await performSync(CURRENCY_STRING);
    });

    Deno.cron("kmk-rate-sync-fallback", "0 0 6 * * 3", async () => {
      console.log("[KMK Cron] Fallback sync triggered (Wed 06:00 UTC)");
      await performSync(CURRENCY_STRING);
    });

    Deno.cron("kmk-rate-backfill", "0 0 17 * * 0", async () => {
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

    console.log("[KMK Cron] All cron jobs registered successfully.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KMK Cron] Registration failed: ${message}`);
  }
}

async function performSync(currencyList: string): Promise<void> {
  try {
    const result = await syncKmkRates({ currency: currencyList });
    console.log(
      `[KMK Cron] Sync Complete: +${result.inserted}, skip:${result.skipped}` +
        (result.errors.length > 0 ? `, err:${result.errors.join("; ")}` : ""),
    );

    // Write heartbeat on success
    const kv = await getKv();
    await kv.set(["kmk", "heartbeat"], {
      ok: true,
      updated: Date.now(),
      inserted: result.inserted,
      skipped: result.skipped,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[KMK Cron] Sync failed: ${message}`);

    // Write heartbeat on failure
    const kv = await getKv();
    await kv.set(["kmk", "heartbeat"], {
      ok: false,
      updated: Date.now(),
      error: message,
    });
  }
}
