import { assertEquals, assertRejects } from "@std/assert";
import { format, getKmkRateByDate, resolveKmkWeek } from "../services/kmk_resolver.ts";
import { testMocks } from "../db/client.ts";
import sql from "../db/client.ts";
import { app } from "../main.ts";

async function seed(validFrom: string, rateStr: string) {
  testMocks.clear();
  const centsStr = String(Math.round(parseFloat(rateStr) * 100));
  testMocks.kmkRates.push({
    valid_from: validFrom,
    mid_rate_cents: centsStr,
    currency: "USD",
  });

  try {
    const validUntilDate = new Date(validFrom + "T00:00:00.000Z");
    validUntilDate.setUTCDate(validUntilDate.getUTCDate() + 6);
    await sql`
      INSERT INTO kmk_rates (
        currency, kmk_number, valid_from, valid_until,
        buy_rate_cents, sell_rate_cents, mid_rate_cents
      ) VALUES (
        'USD',
        'TEST-KMK-NO',
        ${validFrom}::DATE,
        ${validUntilDate.toISOString().slice(0, 10)}::DATE,
        ${Number(centsStr)},
        ${Number(centsStr)},
        ${Number(centsStr)}
      )
      ON CONFLICT (currency, valid_from) DO UPDATE 
      SET mid_rate_cents = EXCLUDED.mid_rate_cents
    `;
  } catch {
    // Ignore database errors under testing mock env
  }
}

// --- Step 1 Tests ---

Deno.test("Wed → same day", () => {
  assertEquals(format(resolveKmkWeek(new Date("2026-05-20"))), "2026-05-20");
});

Deno.test("Mon → previous Wed", () => {
  assertEquals(format(resolveKmkWeek(new Date("2026-05-25"))), "2026-05-20");
});

Deno.test("Sun → previous Wed", () => {
  assertEquals(format(resolveKmkWeek(new Date("2026-05-24"))), "2026-05-20");
});

Deno.test("Year boundary", () => {
  assertEquals(format(resolveKmkWeek(new Date("2026-01-01"))), "2025-12-31");
});

// --- Step 2 Tests ---

Deno.test("returns correct rate", async () => {
  await seed("2026-05-20", "16250.00");
  assertEquals(await getKmkRateByDate(new Date("2026-05-22")), {
    effective_date: "2026-05-20",
    rate: "16250.00",
  });
});

Deno.test("throws if missing", async () => {
  testMocks.clear();
  await assertRejects(() => getKmkRateByDate(new Date("2026-05-22")));
});

Deno.test("no fallback to nearest", async () => {
  await seed("2026-05-13", "16000.00");
  await assertRejects(() => getKmkRateByDate(new Date("2026-05-22")));
});

// --- Step 3 Tests ---

Deno.test("GET /kmk-rate success", async () => {
  await seed("2026-05-20", "16250.00");
  assertEquals(await (await app.request("/kmk-rate?date=2026-05-22")).json(), {
    effective_date: "2026-05-20",
    rate: "16250.00",
  });
});

Deno.test("GET /kmk-rate requires date", async () => {
  assertEquals((await app.request("/kmk-rate")).status, 400);
});

Deno.test("GET /kmk-rate invalid date", async () => {
  assertEquals((await app.request("/kmk-rate?date=invalid")).status, 400);
});

// --- Step 4 Tests (QA Checks) ---

Deno.test("QA: Always Wednesday", () => {
  for (let i = 0; i < 365; i++) {
    assertEquals(
      resolveKmkWeek(new Date(Date.UTC(2026, 0, i + 1))).getUTCDay(),
      3,
    );
  }
});

Deno.test("QA: Never future date", () => {
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.UTC(2026, 0, i + 1));
    assertEquals(resolveKmkWeek(d) <= d, true);
  }
});
