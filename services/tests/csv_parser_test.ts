import { assertEquals } from "@std/assert";
import { parseCsvStream } from "../csv_parser.ts";

const CSV = `Date,Description,Amount,Currency,Fee
2026-04-15,Invoice #42,"1,250.55",USD,2.50
2026-04-22,Invoice #43,"3,000.00",USD,3.75
2026-04-29,Invoice #44,500.00,USD,1.00
2026-05-06,Invoice #45,"12,345.67",USD,5.00
2026-05-13,Invoice #46,99.99,USD,0.50
2026-05-20,Invoice #47,"7,777.77",USD,4.25`;

Deno.test("headers", () =>
  assertEquals(parseCsvStream(CSV).headers, [
    "Date",
    "Description",
    "Amount",
    "Currency",
    "Fee",
  ]));
Deno.test("5 rows default", () => assertEquals(parseCsvStream(CSV).rows.length, 5));
Deno.test("maxRows=3", () => assertEquals(parseCsvStream(CSV, 3).rows.length, 3));
Deno.test("row data", () => {
  const r = parseCsvStream(CSV).rows[0];
  assertEquals(r["Amount"], "1,250.55");
  assertEquals(r["Currency"], "USD");
});
Deno.test("total count", () => assertEquals(parseCsvStream(CSV).totalRowCount, 6));
Deno.test("empty", () =>
  assertEquals(parseCsvStream(""), {
    headers: [],
    rows: [],
    totalRowCount: 0,
  }));
Deno.test("header-only", () => {
  const r = parseCsvStream("Date,Amount\n");
  assertEquals(r.headers, ["Date", "Amount"]);
  assertEquals(r.rows, []);
});
