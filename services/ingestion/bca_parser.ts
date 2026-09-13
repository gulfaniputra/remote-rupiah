import { parseAmount } from "../math_utils.ts";

/**
 * Parse a date string in DD/MM/YYYY format to YYYY-MM-DD.
 * Also accepts YYYY-MM-DD as a fallback.
 */
const parseBcaDate = (raw: string): string => {
  const trimmed = raw.trim();

  // Try DD/MM/YYYY first (standard BCA format)
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

  throw new Error(`Invalid BCA transaction date: "${raw}"`);
};

/**
 * Extract the amount from a BCA row.
 *
 * BCA KlikBCA format uses separate "Debet" (outgoing) and "Kredit" (incoming) columns.
 * BCA mobile format uses a single "Jumlah" column (negative for debits).
 *
 * Returns the amount in cents (positive for incoming, negative for outgoing).
 */
const extractAmount = (r: Record<string, string>): bigint => {
  // Format 1: Separate Debet/Kredit columns (KlikBCA)
  const debet = r["Debet"]?.trim();
  const kredit = r["Kredit"]?.trim();

  if (debet && debet !== "" && kredit !== undefined) {
    // Debet is outgoing (negative)
    return -parseAmount(debet);
  }
  if (kredit && kredit !== "") {
    // Kredit is incoming (positive)
    return parseAmount(kredit);
  }

  // Format 2: Single Jumlah column (mobile/alternative)
  const jumlah = r["Jumlah"]?.trim() || r["Amount"]?.trim();
  if (jumlah && jumlah !== "") {
    return parseAmount(jumlah);
  }

  throw new Error(
    `Cannot determine amount from BCA row: no Debet, Kredit, or Jumlah column found`,
  );
};

export const mapBcaRow = (r: Record<string, string>) => {
  const dateRaw = r["Tgl. Transaksi"] || r["Tanggal"] || r["Date"] || "";
  const date = parseBcaDate(dateRaw);

  const description = r["Keterangan"] || r["Description"] || "";
  const externalId = r["Transaction ID"] || r["ID"] ||
    `${date}-${description}-${r["Debet"] || r["Kredit"] || r["Jumlah"] || ""}`;

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
