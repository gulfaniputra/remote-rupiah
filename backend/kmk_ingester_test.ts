import { assertEquals } from "@std/assert";

const parse = (s: string) =>
  BigInt(Math.round(parseFloat(s.replace(/\./g, "").replace(",", ".")) * 100));

Deno.test("kmk", () => {
  assertEquals(parse("16.350,00"), 1635000n);
  assertEquals(parse("1.000,00"), 100000n);
  assertEquals(parse("16.350,45"), 1635045n);
});
