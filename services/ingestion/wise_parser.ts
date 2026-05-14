import { parseAmount } from "../math_utils.ts";

export const mapWiseRow = (r: Record<string, string>) => {
  const d = new Date(r["Created on"]);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid transaction date: "${r["Created on"]}" for Transfer ID ${r["Transfer ID"]}`);
  }
  return {
    external_id: r["Transfer ID"],
    date: d.toISOString().split("T")[0],
    currency: r["Source Currency"],
    amount_cents: parseAmount(r["Amount Sent"]),
    actual_idr_received_cents: parseAmount(r["Amount Received"]),
    metadata: r,
  };
};
