import { assertEquals } from "@std/assert";
import { parseKmkRate, isRateSanityCheckOk } from "./kmk.ts";

Deno.test("parseKmkRate", () => assertEquals(parseKmkRate("Rp 16.205,12 (Fixed)"), 1620512n));
Deno.test("isRateSanityCheckOk", () => assertEquals(isRateSanityCheckOk(185000000n, 160000000n), false));
