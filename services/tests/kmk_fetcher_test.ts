import { assertEquals } from "@std/assert";
import { type KmkRate } from "../kmk.ts";

const mock = (o: Partial<KmkRate> = {}): KmkRate => ({
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", currency: "USD", kmkNumber: "17/MK/EF.2/2026",
  validFrom: "2026-04-23", validUntil: "2026-04-29", buyRate: "16105.00", sellRate: "16265.00",
  midRate: "16185.00", fetchedAt: "2026-04-23T10:00:00Z", ...o,
});

Deno.test("shape", () => { const r = mock(); assertEquals(Object.keys(r).length, 9); });
Deno.test("currency 3 chars", () => assertEquals(mock().currency.length, 3));
Deno.test("midRate numeric", () => assertEquals(parseFloat(mock({ midRate: "16200.50" }).midRate) > 0, true));
Deno.test("7-day window", () => assertEquals((new Date("2026-04-29").getTime() - new Date("2026-04-23").getTime()) / 864e5, 6));
Deno.test("override", () => { const r = mock({ currency: "SGD" }); assertEquals(r.currency, "SGD"); assertEquals(r.kmkNumber, "17/MK/EF.2/2026"); });
