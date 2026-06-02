import { parseAmount } from "../math_utils.ts";

export const mapRevolutRow = (r: Record<string, string>) => {
  const dateValue = r["Completed Date"] || r["Started Date"] || r["Date"];
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid transaction date: "${dateValue}"`);
  }

  const amount = r["Amount"];
  const currency = r["Currency"];
  const externalId = r["Transaction ID"] || r["Reference"] ||
    `${dateValue}-${amount}`;

  return {
    external_id: externalId,
    date: date.toISOString().split("T")[0],
    currency,
    amount_cents: parseAmount(amount),
    actual_idr_received_cents: null,
    metadata: r,
  };
};
