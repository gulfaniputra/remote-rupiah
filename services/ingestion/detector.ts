export type Platform = "wise" | "revolut" | "paypal";

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

  if (hasAll(headers, ["date", "amount", "currency"])) {
    return "paypal";
  }

  return null;
};
