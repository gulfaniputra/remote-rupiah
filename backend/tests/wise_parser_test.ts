import { assertEquals } from "jsr:@std/assert";
import { parseAmount } from "../../services/math_utils.ts";

Deno.test("Zero-Float Integrity: Wise Amount Parsing", () => assertEquals(parseAmount("1,234.56"), 123456n));
