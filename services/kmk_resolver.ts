import sql from "../db/client.ts";

/**
 * Resolve the Wednesday anchor date for a given KMK date (Wednesday -> Tuesday).
 * Uses UTC only.
 */
export const resolveKmkWeek = (date: Date): Date =>
  new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - ((date.getUTCDay() - 3 + 7) % 7),
  ));

/**
 * Format a Date object into a YYYY-MM-DD string using UTC components.
 */
export const format = (date: Date): string =>
  `${date.getUTCFullYear()}-${
    String(date.getUTCMonth() + 1).padStart(2, "0")
  }-${String(date.getUTCDate()).padStart(2, "0")}`;

/**
 * Retrieve the KMK mid rate for USD from the database for the given date.
 * Throws if missing. No fallback logic. No floating-point math.
 */
export async function getKmkRateByDate(
  date: Date,
): Promise<{ effective_date: string; rate: string }> {
  const effectiveDate = resolveKmkWeek(date);

  // QA Check: Always Wednesday, Never future date
  if (effectiveDate.getUTCDay() !== 3) {
    throw new Error("Resolved KMK date must be a Wednesday");
  }
  if (effectiveDate > date) {
    throw new Error("Resolved KMK date cannot be in the future");
  }

  const dateStr = format(effectiveDate);
  const rows = await sql`
    SELECT mid_rate_cents FROM kmk_rates WHERE currency = 'USD' AND valid_from = ${dateStr}::DATE LIMIT 1
  `;

  if (!rows?.[0]) throw new Error(`No KMK rate found for date: ${dateStr}`);

  const cents = BigInt(rows[0].mid_rate_cents);
  const absCents = cents < 0n ? -cents : cents;

  return {
    effective_date: dateStr,
    rate: `${cents < 0n ? "-" : ""}${absCents / 100n}.${
      String(absCents % 100n).padStart(2, "0")
    }`,
  };
}
