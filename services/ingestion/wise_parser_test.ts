import { assertEquals } from "@std/assert";
import { parseAmount } from "../math_utils.ts";

Deno.test("parseAmount", () => assertEquals(parseAmount("1,234.56"), 123456n));
