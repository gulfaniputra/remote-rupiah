import { z } from "zod";
import sql from "../db/client.ts";
import { parseSafeRate } from "./math_utils.ts";

// ---------------------------------------------------------------------------
// 1. Zod schemas for the Kemenkeu Fiscal Portal API response
// ---------------------------------------------------------------------------

/** Schema for a single currency entry in the API response */
const KmkApiCurrencySchema = z.object({
  kurs_beli: z.string(), // Buy rate as string, e.g. "17146.00"
  kurs_jual: z.string(), // Sell rate
  kurs_tengah: z.string(), // Mid rate (used for PPh calculations)
  kode_mata_uang: z.string().length(3), // "USD"
  nama_mata_uang: z.string(),
});

/** Top-level response wrapper from the fiskal portal */
const KmkApiResponseSchema = z.object({
  status: z.string(),
  data: z.object({
    result: z.array(z.object({
      no_kmk: z.string(), // Decree number e.g. "17/MK/EF.2/2026"
      tgl_berlaku: z.string(), // Start date YYYY-MM-DD
      tgl_akhir: z.string(), // End date YYYY-MM-DD
      kurs: z.array(KmkApiCurrencySchema),
    })),
  }),
});

type KmkApiResponse = z.infer<typeof KmkApiResponseSchema>;
type KmkApiCurrency = z.infer<typeof KmkApiCurrencySchema>;

// ---------------------------------------------------------------------------
// 2. Configuration
// ---------------------------------------------------------------------------

const FISKAL_API_BASE = "https://portal.fiskal.kemenkeu.go.id/api/v1/kurs/get";

function getAccessToken(): string {
  const token = Deno.env.get("KMK_ACCESS_TOKEN");
  if (!token) {
    throw new Error(
      "KMK_ACCESS_TOKEN env let is required. " +
        "Register at https://fiskal.kemenkeu.go.id to obtain one.",
    );
  }
  return token;
}

// ---------------------------------------------------------------------------
// 3. Fetch from Kemenkeu API
// ---------------------------------------------------------------------------

export interface KmkFetchOptions {
  /** Date in YYYYMMDD format. Omit for the latest rates. */
  date?: string;
  /** Currency code, defaults to "USD" */
  currency?: string;
}

/**
 * Fetch KMK rates from the Kemenkeu Fiscal Portal.
 * Returns the validated response or throws on network/validation errors.
 */
export async function fetchKmkRates(
  options: KmkFetchOptions = {},
): Promise<KmkApiResponse> {
  const params = new URLSearchParams({
    "access-token": getAccessToken(),
  });

  if (options.date) params.set("date", options.date);
  if (options.currency) params.set("currency", options.currency);

  const url = `${FISKAL_API_BASE}?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `KMK API returned HTTP ${response.status}: ${body.slice(0, 500)}`,
    );
  }

  const json: unknown = await response.json();
  return KmkApiResponseSchema.parse(json);
}

// ---------------------------------------------------------------------------
// 4. Upsert into database
// ---------------------------------------------------------------------------

export interface UpsertResult {
  inserted: number;
  skipped: number;
  errors: string[];
}

/**
 * Upsert KMK rate records into the `kmk_rates` table.
 * Uses ON CONFLICT to skip duplicates (idempotent).
 * If targetCurrencies is provided (array), it only upserts those.
 * Otherwise, it upserts all currencies present in the API response.
 */
export async function upsertKmkRates(
  apiResponse: KmkApiResponse,
  targetCurrencies?: string | string[],
): Promise<UpsertResult> {
  const result: UpsertResult = { inserted: 0, skipped: 0, errors: [] };
  const allowedCurrencies = typeof targetCurrencies === "string"
    ? targetCurrencies.includes(",")
      ? targetCurrencies.split(",").map((s) => s.trim())
      : [targetCurrencies]
    : targetCurrencies;

  for (const period of apiResponse.data.result) {
    const currenciesToProcess = allowedCurrencies
      ? period.kurs.filter((k: KmkApiCurrency) => allowedCurrencies.includes(k.kode_mata_uang))
      : period.kurs;

    if (currenciesToProcess.length === 0 && allowedCurrencies) {
      result.errors.push(
        `No matches for [${allowedCurrencies.join(",")}] in KMK ${period.no_kmk}`,
      );
      continue;
    }

    for (const currencyEntry of currenciesToProcess) {
      const currency = currencyEntry.kode_mata_uang;

      // Use strings directly for DB insertion to maintain precision (Postgres NUMERIC handles strings)
      // This complies with the "No Float" spirit by avoiding JS number type for financial coefficients.
      const buyRate = currencyEntry.kurs_beli;
      const sellRate = currencyEntry.kurs_jual;
      const midRate = currencyEntry.kurs_tengah;

      try {
        const buyRateCents = parseSafeRate(buyRate);
        const sellRateCents = parseSafeRate(sellRate);
        const midRateCents = parseSafeRate(midRate);

        const rows = await sql`
          INSERT INTO kmk_rates (
            currency, kmk_number, valid_from, valid_until,
            buy_rate_cents, sell_rate_cents, mid_rate_cents
          ) VALUES (
            ${currency},
            ${period.no_kmk},
            ${period.tgl_berlaku}::DATE,
            ${period.tgl_akhir}::DATE,
            ${String(buyRateCents)},
            ${String(sellRateCents)},
            ${String(midRateCents)}
          )
          ON CONFLICT ON CONSTRAINT uq_kmk_currency_period DO NOTHING
          RETURNING id
        `;

        if (rows.length > 0) {
          result.inserted++;
        } else {
          result.skipped++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(
          `DB error for ${currency} in KMK ${period.no_kmk}: ${message}`,
        );
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 5. Sync orchestrator (fetch + upsert)
// ---------------------------------------------------------------------------

export interface SyncOptions {
  /** YYYYMMDD — fetch a specific week's rate */
  date?: string;
  currency?: string;
}

/**
 * Full sync: fetch from API → validate → upsert into DB.
 * Designed to be called by both Deno.cron and the manual sync endpoint.
 */
export async function syncKmkRates(
  options: SyncOptions = {},
): Promise<UpsertResult> {
  // Determine if we are requesting multiple currencies.
  // If so, we fetch 'all' from the API (omit currency param) and filter locally in upsert.
  const isMultiple = options.currency?.includes(",");
  const apiResponse = await fetchKmkRates({
    date: options.date,
    currency: isMultiple ? undefined : options.currency,
  });
  return await upsertKmkRates(apiResponse, options.currency);
}

/**
 * Backfill KMK rates for the last N weeks to ensure no gaps.
 * Currencies defaults to common Remote Developer ones.
 */
export async function backfillKmkRates(
  weeks = 4,
  currencies = ["USD", "SGD", "EUR", "AUD", "JPY"],
): Promise<UpsertResult> {
  const finalResult: UpsertResult = { inserted: 0, skipped: 0, errors: [] };

  // Step backward by 7 days for each week
  for (let i = 0; i < weeks; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (i * 7));
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

    try {
      // Fetch and sync the specified currencies for that week
      const upsertResult = await syncKmkRates({
        date: dateStr,
        currency: currencies.join(","),
      });

      finalResult.inserted += upsertResult.inserted;
      finalResult.skipped += upsertResult.skipped;
      finalResult.errors.push(...upsertResult.errors);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      finalResult.errors.push(
        `Backfill failed for week ${i} (${dateStr}): ${message}`,
      );
    }
  }

  return finalResult;
}

// ---------------------------------------------------------------------------
// 6. Lookup: resolve KMK rate for a specific transaction date
// ---------------------------------------------------------------------------

export interface KmkRate {
  id: string;
  currency: string;
  kmkNumber: string;
  validFrom: string;
  validUntil: string;
  buyRate: bigint;
  sellRate: bigint;
  midRate: bigint;
  fetchedAt: string;
}

/**
 * Find the KMK rate applicable for a given date and currency.
 * The rate is valid from `valid_from` (Wednesday) through `valid_until` (Tuesday).
 *
 * Per tax_compliance rule: "Use the weekly KMK rate for the date of receipt."
 */
const kv = await (async () => {
  try {
    return typeof Deno.openKv === "function" ? await Deno.openKv() : null;
  } catch {
    return null;
  }
})();

export async function lookupKmkRate(
  transactionDate: string,
  currency = "USD",
): Promise<KmkRate | null> {
  const k = ["kmk_rates", currency, transactionDate],
    v = kv ? (await kv.get<KmkRate>(k)).value : null;
  if (v) return v;
  const rows =
    await sql`SELECT id, currency, kmk_number AS "kmkNumber", valid_from AS "validFrom", valid_until AS "validUntil", buy_rate_cents AS "buyRate", sell_rate_cents AS "sellRate", mid_rate_cents AS "midRate", fetched_at AS "fetchedAt" FROM kmk_rates WHERE currency = ${currency} AND ${transactionDate}::DATE BETWEEN valid_from AND valid_until ORDER BY valid_from DESC LIMIT 1`;
  if (rows.length === 0) return null;
  if (kv) await kv.set(k, rows[0], { expireIn: 86_400_000 });
  return rows[0] as KmkRate;
}

/**
 * List all stored KMK rates for a currency, ordered newest first.
 */
export async function listKmkRates(
  currency = "USD",
  limit = 52,
): Promise<KmkRate[]> {
  const rows = await sql`
    SELECT
      id,
      currency,
      kmk_number AS "kmkNumber",
      valid_from AS "validFrom",
      valid_until AS "validUntil",
      buy_rate_cents AS "buyRate",
      sell_rate_cents AS "sellRate",
      mid_rate_cents AS "midRate",
      fetched_at AS "fetchedAt"
    FROM kmk_rates
    WHERE currency = ${currency}
    ORDER BY valid_from DESC
    LIMIT ${limit}
  `;
  return rows as unknown as KmkRate[];
}

// ---------------------------------------------------------------------------
// 7. Parsing & Circuit Breaker Logic
// ---------------------------------------------------------------------------

export const parseKmkRate = (rateStr: string): bigint => {
  const [int = "0", frac = ""] = rateStr.replace(/[^\d,]/g, "").split(",");
  return BigInt(int + frac.padEnd(2, "0").substring(0, 2));
};

export const isRateSanityCheckOk = (
  newRate: bigint,
  lastRate: bigint,
): boolean =>
  (newRate > lastRate ? newRate - lastRate : lastRate - newRate) <=
    lastRate / 10n;
