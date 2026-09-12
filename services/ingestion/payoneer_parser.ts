import { parseAmount } from "../math_utils.ts";

export const mapPayoneerRow = (r: Record<string, string>) => {
  const dateValue = r["Date"] || r["Completion Date"];
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid transaction date: "${dateValue}"`);
  }

  const externalId = r["Transaction ID"] || r["Reference"] ||
    `${dateValue}-${r["Amount"]}`;

  const amount = r["Amount"] || r["Amount Received"] || r["Payment Amount"];

  return {
    external_id: externalId,
    date: date.toISOString().split("T")[0],
    currency: r["Currency"],
    amount_cents: parseAmount(amount),
    actual_idr_received_cents: null,
    metadata: r,
  };
};
