export type Platform =
  | "wise"
  | "revolut"
  | "payoneer"
  | "paypal"
  | "bca"
  | "mandiri"
  | "bni";

const normalizeHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(
    /^_+|_+$/g,
    "",
  );

const hasAll = (headers: Set<string>, required: string[]) =>
  required.every((header) => headers.has(header));

export const detectPlatform = (headerRow: string): Platform | null => {
  const headers = new Set(
    headerRow.split(",").map((header) => normalizeHeader(header)),
  );

  if (
    hasAll(headers, [
      "transfer_id",
      "created_on",
      "amount_sent",
      "amount_received",
    ]) ||
    hasAll(headers, [
      "transfer_id",
      "created_on",
      "source_currency",
      "amount_sent",
    ])
  ) {
    return "wise";
  }

  if (
    hasAll(headers, ["completed_date", "type", "currency", "amount"]) ||
    hasAll(headers, ["completed_on", "type", "currency", "amount"]) ||
    hasAll(headers, ["started_date", "type", "currency", "amount"])
  ) {
    return "revolut";
  }

  if (
    hasAll(headers, [
      "date",
      "description",
      "amount",
      "currency",
    ]) ||
    hasAll(headers, [
      "completion_date",
      "description",
      "amount",
      "currency",
    ])
  ) {
    return "payoneer";
  }

  if (hasAll(headers, ["date", "amount", "currency"])) {
    return "paypal";
  }

  // BNI: uses "Debit" (not "Debet")
  if (
    hasAll(headers, ["tgl_transaksi", "keterangan", "debit", "kredit"]) ||
    hasAll(headers, ["tanggal", "keterangan", "debit", "kredit"])
  ) {
    return "bni";
  }

  // BCA KlikBCA: uses "Debet" (not "Debit") with Tgl. Transaksi
  if (
    hasAll(headers, ["tgl_transaksi", "keterangan", "cabang", "debet", "kredit"]) ||
    hasAll(headers, ["tgl_transaksi", "keterangan", "debet", "kredit"])
  ) {
    return "bca";
  }

  // BCA mobile: uses "Jumlah" column (single column amount)
  if (
    hasAll(headers, ["tanggal", "keterangan", "jumlah"])
  ) {
    return "bca";
  }

  // Mandiri: uses "Debet" with "Tanggal" (not "Tgl. Transaksi") and includes "Cabang"
  if (
    hasAll(headers, ["tanggal", "keterangan", "cabang", "debet", "kredit"])
  ) {
    return "mandiri";
  }

  return null;
};
