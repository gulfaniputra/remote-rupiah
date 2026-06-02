import { assertEquals } from "@std/assert";
import { mapPaypalRow } from "./paypal_parser.ts";

Deno.test("mapPaypalRow maps canonical transaction fields", () => {
  const result = mapPaypalRow({
    Date: "2026-05-18T10:00:00Z",
    Currency: "USD",
    Amount: "42.25",
    "Transaction ID": "pp-123",
  });

  assertEquals(result.external_id, "pp-123");
  assertEquals(result.date, "2026-05-18");
  assertEquals(result.currency, "USD");
  assertEquals(result.amount_cents, 4225n);
  assertEquals(result.actual_idr_received_cents, null);
});
