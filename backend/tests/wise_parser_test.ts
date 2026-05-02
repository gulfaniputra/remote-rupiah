import { assertEquals } from "jsr:@std/assert@1";
import { parseAmount, parseWiseRow } from "../services/wise_parser.ts";

Deno.test("wise_parser", () => {
  assertEquals(parseAmount("1.250,50"), { ok: true, value: 125050n });
  assertEquals(parseAmount("1,250.50"), { ok: true, value: 125050n });
  assertEquals(parseAmount("-150.00"), { ok: true, value: -15000n });
  assertEquals(parseWiseRow({ Date: "2026-05-01", Amount: "-150.00", Currency: "USD", Description: "US Tax Withheld from client" }), { ok: true, value: { date: "2026-05-01", amountCents: 15000n, currency: "USD", description: "US Tax Withheld from client", type: "ForeignTaxCredit" } });
});
