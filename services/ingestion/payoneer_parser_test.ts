import { assertEquals, assertThrows } from "@std/assert";
import { mapPayoneerRow } from "./payoneer_parser.ts";

Deno.test("mapPayoneerRow maps canonical transaction fields", () => {
  const result = mapPayoneerRow({
    Date: "2026-05-18T10:00:00Z",
    Currency: "USD",
    Amount: "1250.00",
    "Transaction ID": "pnr-123456",
    Description: "Payment from client",
  });

  assertEquals(result.external_id, "pnr-123456");
  assertEquals(result.date, "2026-05-18");
  assertEquals(result.currency, "USD");
  assertEquals(result.amount_cents, 125000n);
  assertEquals(result.actual_idr_received_cents, null);
  assertEquals(result.metadata.Description, "Payment from client");
});

Deno.test("mapPayoneerRow falls back to Reference when Transaction ID is missing", () => {
  const result = mapPayoneerRow({
    Date: "2026-06-01",
    Currency: "EUR",
    Amount: "85.50",
    Reference: "REF-77",
    Description: "Invoice #102",
  });

  assertEquals(result.external_id, "REF-77");
  assertEquals(result.date, "2026-06-01");
  assertEquals(result.currency, "EUR");
  assertEquals(result.amount_cents, 8550n);
  assertEquals(result.actual_idr_received_cents, null);
});

Deno.test("mapPayoneerRow supports Completion Date and Payment Amount columns", () => {
  const result = mapPayoneerRow({
    "Completion Date": "2026-07-15T00:00:00Z",
    Currency: "USD",
    "Payment Amount": "40.99",
    "Transaction ID": "pnr-abc",
    Status: "Completed",
  });

  assertEquals(result.external_id, "pnr-abc");
  assertEquals(result.date, "2026-07-15");
  assertEquals(result.amount_cents, 4099n);
});

Deno.test("mapPayoneerRow rejects an invalid transaction date", () => {
  assertThrows(
    () =>
      mapPayoneerRow({
        Date: "not-a-date",
        Currency: "USD",
        Amount: "10.00",
        "Transaction ID": "pnr-x",
      }),
    Error,
    "Invalid transaction date",
  );
});
