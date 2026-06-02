import { parseAmount } from "../math_utils.ts";

export const mapPaypalRow = (r: Record<string, string>) => {
  const dateValue = r["Date"];
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid transaction date: "${dateValue}"`);
  }

  const externalId = r["Transaction ID"] || r["ID"] ||
    `${dateValue}-${r["Amount"]}`;

  return {
    external_id: externalId,
    date: date.toISOString().split("T")[0],
    currency: r["Currency"],
    amount_cents: parseAmount(r["Amount"]),
    actual_idr_received_cents: null,
    metadata: r,
  };
};
