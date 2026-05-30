import { CanonicalTx } from "../../domain/canonical-tx.ts";

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** Normalizes YYYY-MM-DD / ISO dates. Returns null on invalid input. */
export const normalizeDate = (input: string): Date | null =>
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:?\d{2})?)?$/
      .test(
        input.trim(),
      ) && !isNaN(new Date(input.trim()).getTime())
    ? new Date(input.trim())
    : null;

/** Normalizes "1,234.56" → 123456n (bigint cents). No floats. */
export const normalizeAmount = (input: string): bigint | null => {
  const clean = input.replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d+)?$/.test(clean)) return null;
  const [i, f = ""] = clean.split(".");
  if (i.replace("-", "").length > 15) return null;
  try {
    return BigInt(i + f.padEnd(2, "0").slice(0, 2));
  } catch {
    return null;
  }
};

/** Maps a single CSV row to CanonicalTx via deterministic exact-match. */
export const mapCsvRow = (
  row: Record<string, string>,
  mapping: Record<string, string>,
  headers: string[],
): Result<CanonicalTx, string> => {
  if (headers.length === 0 || Object.keys(row).length === 0) {
    return { ok: false, error: "Empty row" };
  }

  if (new Set(headers).size !== headers.length) {
    return { ok: false, error: "Duplicate headers detected" };
  }

  const src = (target: string) =>
    Object.keys(mapping).find((k) => mapping[k] === target);

  const dateKey = src("date");
  const amountKey = src("amount");
  const currencyKey = src("currency");

  if (!dateKey || row[dateKey] === undefined) {
    return { ok: false, error: "Missing required field: date" };
  }
  if (!amountKey || row[amountKey] === undefined) {
    return { ok: false, error: "Missing required field: amount" };
  }
  if (!currencyKey || row[currencyKey] === undefined) {
    return { ok: false, error: "Missing required field: currency" };
  }

  if (!normalizeDate(row[dateKey])) {
    return { ok: false, error: `Invalid date format: ${row[dateKey]}` };
  }

  if (normalizeAmount(row[amountKey]) === null) {
    const clean = row[amountKey].replace(/,/g, "").trim();
    return {
      ok: false,
      error: /^-?\d+(\.\d+)?$/.test(clean) &&
          clean.split(".")[0].replace("-", "").length > 15
        ? "Amount overflow or invalid bigint"
        : `Invalid amount format: ${row[amountKey]}`,
    };
  }

  const currency = row[currencyKey].trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { ok: false, error: `Invalid currency format: ${row[currencyKey]}` };
  }

  return {
    ok: true,
    value: {
      date: normalizeDate(row[dateKey])!,
      amount: normalizeAmount(row[amountKey])!,
      currency,
    },
  };
};
