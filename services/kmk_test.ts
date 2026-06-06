import { assertEquals, assertThrows } from "@std/assert";
import { parseSafeRate } from "./math_utils.ts";

const legacyParse = (rate: string) => Math.round(parseFloat(rate) * 100);

Deno.test("parseSafeRate keeps exact cent values", () => {
  assertEquals(parseSafeRate("17146.00"), 1714600n);
  assertEquals(parseSafeRate("16.205,12"), 1620512n);
});

Deno.test("legacy parseFloat path can drift on decimal inputs", () => {
  assertEquals(legacyParse("1.005"), 100);
  assertEquals(parseSafeRate("1.005"), 101n);
  assertEquals(parseSafeRate("1.015"), 102n);
});

Deno.test("parseSafeRate rejects malformed input", () => {
  assertThrows(() => parseSafeRate("N/A"));
  assertThrows(() => parseSafeRate("16.20.5"));
});
