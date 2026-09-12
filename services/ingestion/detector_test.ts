import { assertEquals } from "@std/assert";
import { detectPlatform } from "./detector.ts";

Deno.test("detectPlatform identifies Wise headers", () => {
  assertEquals(
    detectPlatform(
      "Transfer ID,Created on,Source Currency,Amount Sent,Amount Received",
    ),
    "wise",
  );
});

Deno.test("detectPlatform identifies Revolut headers", () => {
  assertEquals(
    detectPlatform("Completed Date,Type,Currency,Amount"),
    "revolut",
  );
});

Deno.test("detectPlatform identifies Payoneer headers", () => {
  assertEquals(
    detectPlatform(
      "Date,Description,Amount,Currency,Status,Transaction ID",
    ),
    "payoneer",
  );
});

Deno.test("detectPlatform identifies Payoneer headers with Completion Date", () => {
  assertEquals(
    detectPlatform(
      "Completion Date,Description,Amount,Currency,Status",
    ),
    "payoneer",
  );
});

Deno.test("detectPlatform identifies PayPal headers", () => {
  assertEquals(detectPlatform("Date,Amount,Currency"), "paypal");
});

Deno.test("detectPlatform returns null for unknown headers", () => {
  assertEquals(detectPlatform("Foo,Bar,Baz"), null);
});
