import { parseAmount } from "../math_utils.ts";

/**
 * Parse a date string in DD/MM/YYYY format to YYYY-MM-DD.
 * Also accepts YYYY-MM-DD as a fallback.
 */
const parseBniDate = (raw: string): string => {
  const trimmed = raw.trim();

  // Try DD/MM/YYYY first (standard BNI format)
  const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  // Fallback: try YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  throw new Error(`Invalid BNI transaction date: "${raw}"`);
};

/**
 * Extract the amount from a BNI row.
 *
 * BNI CSV format uses separate "Debit" (outgoing) and "Kredit" (incoming) columns.
 * Also supports "Debet" as an alternative spelling, and a single "Jumlah" column
 * for simplified exports.
 *
 * Returns the amount in cents (positive for incoming, negative for outgoing).
 */
const extractAmount = (r: Record<string, string>): bigint => {
  // BNI uses "Debit" (alternative: "Debet"), "Kredit" columns
  const debit = r["Debit"]?.trim() || r["Debet"]?.trim();
  const kredit = r["Kredit"]?.trim();

  if (debit && debit !== "" && kredit !== undefined) {
    // Debit/Debet is outgoing (negative)
    return -parseAmount(debit);
  }
  if (kredit && kredit !== "") {
    // Kredit is incoming (positive)
    return parseAmount(kredit);
  }

  // Format 2: Single Jumlah column (alternative export formats)
  const jumlah = r["Jumlah"]?.trim() || r["Amount"]?.trim();
  if (jumlah && jumlah !== "") {
    return parseAmount(jumlah);
  }

  throw new Error(
    `Cannot determine amount from BNI row: no Debit, Debet, Kredit, or Jumlah column found`,
  );
};

export const mapBniRow = (r: Record<string, string>) => {
  const dateRaw = r["Tanggal"] || r["Tgl. Transaksi"] || r["Date"] || "";
  const date = parseBniDate(dateRaw);

  const description = r["Keterangan"] || r["Keterangan Transaksi"] ||
    r["Description"] || "";
  const externalId = r["Transaction ID"] || r["ID"] ||
    `${date}-${description}-${r["Debit"] || r["Debet"] || r["Kredit"] || r["Jumlah"] || ""}`;

  const amountCents = extractAmount(r);

  return {
    external_id: externalId,
    date,
    currency: "IDR",
    amount_cents: amountCents,
    actual_idr_received_cents: null,
    metadata: r,
  };
};
