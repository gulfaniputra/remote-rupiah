import { assertEquals } from "@std/assert";
import { mapCsvRow } from "../../../src/services/ingestion/csv-mapper.ts";

Deno.test("CSV Mapper - valid row to CanonicalTx", () => {
  const row = {
    "Tx Date": "2026-05-30",
    "Net Value": "1,234.56",
    Curr: "USD",
  };
  const mapping = {
    "Tx Date": "date",
    "Net Value": "amount",
    Curr: "currency",
  };

  const result = mapCsvRow(row, mapping, ["Tx Date", "Net Value", "Curr"]);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.amount, 123456n);
    assertEquals(result.value.currency, "USD");
    assertEquals(result.value.date.toISOString().split("T")[0], "2026-05-30");
  }
});

Deno.test("CSV Mapper - missing required field", () => {
  const row = { "Tx Date": "2026-05-30", Curr: "USD" };
  const mapping = {
    "Tx Date": "date",
    "Net Value": "amount",
    Curr: "currency",
  };

  const result = mapCsvRow(row, mapping, ["Tx Date", "Curr"]);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Missing required field: amount");
  }
});

Deno.test("CSV Mapper - invalid date format", () => {
  const row = {
    "Tx Date": "invalid-date",
    "Net Value": "1,234.56",
    Curr: "USD",
  };
  const mapping = {
    "Tx Date": "date",
    "Net Value": "amount",
    Curr: "currency",
  };

  const result = mapCsvRow(row, mapping, ["Tx Date", "Net Value", "Curr"]);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Invalid date format: invalid-date");
  }
});

Deno.test("CSV Mapper - invalid amount format", () => {
  const row = { "Tx Date": "2026-05-30", "Net Value": "abc", Curr: "USD" };
  const mapping = {
    "Tx Date": "date",
    "Net Value": "amount",
    Curr: "currency",
  };

  const result = mapCsvRow(row, mapping, ["Tx Date", "Net Value", "Curr"]);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Invalid amount format: abc");
  }
});

Deno.test("CSV Mapper - duplicate headers handling", () => {
  const row = {
    "Tx Date": "2026-05-30",
    "Net Value": "1,234.56",
    Curr: "USD",
  };
  const mapping = {
    "Tx Date": "date",
    "Net Value": "amount",
    Curr: "currency",
  };

  // Pass duplicate headers
  const result = mapCsvRow(row, mapping, [
    "Tx Date",
    "Net Value",
    "Curr",
    "Tx Date",
  ]);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Duplicate headers detected");
  }
});

Deno.test("CSV Mapper - empty row handling", () => {
  const row = {};
  const mapping = {
    "Tx Date": "date",
    "Net Value": "amount",
    Curr: "currency",
  };

  const result = mapCsvRow(row, mapping, []);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Empty row");
  }
});

Deno.test("CSV Mapper - bigint overflow handling", () => {
  const row = {
    "Tx Date": "2026-05-30",
    "Net Value": "99999999999999999999999999999999999999",
    Curr: "USD",
  };
  const mapping = {
    "Tx Date": "date",
    "Net Value": "amount",
    Curr: "currency",
  };

  const result = mapCsvRow(row, mapping, ["Tx Date", "Net Value", "Curr"]);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Amount overflow or invalid bigint");
  }
});

Deno.test("CSV Mapper - maps actual_idr_received_cents", () => {
  const row = {
    "Tx Date": "2026-05-30",
    "Net Value": "1,234.56",
    Curr: "USD",
    "IDR Received": "19,876,543.21",
  };
  const mapping = {
    "Tx Date": "date",
    "Net Value": "amount",
    Curr: "currency",
    "IDR Received": "actual_idr_received_cents",
  };
  const result = mapCsvRow(row, mapping, Object.keys(row));
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.actualIdrReceivedCents, 1987654321n);
  }
});
