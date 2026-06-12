import { assertEquals, assertThrows } from "@std/assert";
import { parseAmount, parseSafeRate } from "./math_utils.ts";

Deno.test("parseAmount standard US format", () => {
  assertEquals(parseAmount("1,250.55"), 125055n);
  assertEquals(parseAmount("1250.55"), 125055n);
  assertEquals(parseAmount("500.00"), 50000n);
  assertEquals(parseAmount("500"), 50000n);
});

Deno.test("parseAmount zero and edge cases", () => {
  assertEquals(parseAmount("0"), 0n);
  assertEquals(parseAmount("0.00"), 0n);
  assertEquals(parseAmount(".50"), 50n);
  assertEquals(parseAmount("100."), 10000n);
  assertEquals(parseAmount("007.50"), 750n);
});

Deno.test("parseAmount handles large values without precision loss", () => {
  assertEquals(parseAmount("1,000,000.99"), 100000099n);
  assertEquals(parseAmount("12,345,678.01"), 1234567801n);
  assertEquals(parseAmount("999999999999.99"), 99999999999999n);
});

Deno.test("parseAmount fractional rounding truncates beyond 2 decimals", () => {
  assertEquals(parseAmount("1.999"), 199n);
  assertEquals(parseAmount("1.001"), 100n);
  assertEquals(parseAmount("1.005"), 100n);
});

Deno.test("parseAmount European comma format", () => {
  assertEquals(parseAmount("1.250,55"), 125055n);
  assertEquals(parseAmount("500,00"), 50000n);
});

Deno.test("parseSafeRate keeps exact cent values", () => {
  assertEquals(parseSafeRate("17146.00"), 1714600n);
  assertEquals(parseSafeRate("16.205,12"), 1620512n);
  assertEquals(parseSafeRate("15000"), 1500000n);
});

Deno.test("parseSafeRate rounds correctly on 3rd decimal", () => {
  assertEquals(parseSafeRate("1.005"), 101n);
  assertEquals(parseSafeRate("1.015"), 102n);
  assertEquals(parseSafeRate("1.004"), 100n);
  assertEquals(parseSafeRate("1.009"), 101n);
});

Deno.test("parseSafeRate rejects malformed input", () => {
  assertThrows(() => parseSafeRate("N/A"));
  assertThrows(() => parseSafeRate("16.20.5"));
  assertThrows(() => parseSafeRate("abc"));
  assertThrows(() => parseSafeRate(""));
});

Deno.test("parseSafeRate handles European format with . as thousands separator", () => {
  assertEquals(parseSafeRate("1.234,56"), 123456n);
  assertEquals(parseSafeRate("12.345,67"), 1234567n);
});

Deno.test("parseSafeRate handles negative rates", () => {
  assertEquals(parseSafeRate("-100.50"), -10050n);
  assertEquals(parseSafeRate("-1.005"), -101n);
});

Deno.test("legacy parseFloat path can drift on decimal inputs", () => {
  const legacyParse = (rate: string) => Math.round(parseFloat(rate) * 100);
  assertEquals(legacyParse("1.005"), 100);
  assertEquals(parseSafeRate("1.005"), 101n);
});
