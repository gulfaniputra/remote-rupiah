import { assertEquals } from "@std/assert";
import { mapRevolutRow } from "./revolut_parser.ts";

Deno.test("mapRevolutRow maps canonical transaction fields", () => {
  const result = mapRevolutRow({
    "Completed Date": "2026-05-18T10:00:00Z",
    Type: "Transfer",
    Currency: "USD",
    Amount: "100.50",
    "Transaction ID": "rev-123",
  });

  assertEquals(result.external_id, "rev-123");
  assertEquals(result.date, "2026-05-18");
  assertEquals(result.currency, "USD");
  assertEquals(result.amount_cents, 10050n);
  assertEquals(result.actual_idr_received_cents, null);
});
