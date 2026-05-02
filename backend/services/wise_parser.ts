import { CsvParseStream } from "jsr:@std/csv";

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
export interface WiseTransaction { date: string; amountCents: bigint; currency: string; description: string; type: "Income" | "Expense" | "ForeignTaxCredit" }

export const parseAmount = (s: string): Result<bigint> => {
  const c = s.replace(/[^0-9.,-]/g, ''), i = Math.max(c.lastIndexOf('.'), c.lastIndexOf(','));
  if (!c) return { ok: false, error: new Error('Invalid') };
  try { return { ok: true, value: BigInt((i !== -1 && i >= c.length - 3) ? c.slice(0, i).replace(/[.,]/g, '') + (c.slice(i + 1) + "00").slice(0, 2) : c.replace(/[.,]/g, '') + "00") }; } 
  catch(e) { return { ok: false, error: e as Error }; }
};

export const parseWiseRow = (r: Record<string, string>): Result<WiseTransaction> => {
  const a = parseAmount(r.Amount || "");
  return !a.ok ? a : { ok: true, value: { date: r.Date || "1970-01-01", amountCents: a.value < 0n ? -a.value : a.value, currency: r.Currency || "", description: r.Description || "", type: (r.Description || "").toLowerCase().includes("tax withheld") ? "ForeignTaxCredit" : (a.value < 0n ? "Expense" : "Income") } };
};

export async function* streamWiseTransactions(f: string) {
  for await (const r of (await Deno.open(f)).readable.pipeThrough(new TextDecoderStream()).pipeThrough(new CsvParseStream({ skipFirstRow: true }))) yield parseWiseRow(r as Record<string, string>);
}
