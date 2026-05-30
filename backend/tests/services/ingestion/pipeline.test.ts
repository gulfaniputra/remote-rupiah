import { assertEquals } from "@std/assert";
import { processCanonicalTx } from "../../../src/services/ingestion/pipeline.ts";
import { mapCsvRow } from "../../../src/services/ingestion/csv-mapper.ts";

class MockStore {
  public saved: Array<unknown> = [];
  save(tx: unknown): Promise<void> {
    this.saved.push(tx);
    return Promise.resolve();
  }
}

Deno.test("Pipeline - accepts valid CanonicalTx", async () => {
  const store = new MockStore();
  const validTx = {
    date: new Date("2026-05-30"),
    amount: 10000n,
    currency: "USD",
  };

  const result = await processCanonicalTx(validTx, store);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.amount, 10000n);
    assertEquals(result.value.currency, "USD");
    assertEquals(store.saved.length, 1);
    assertEquals(
      (store.saved[0] as { amount: bigint }).amount,
      10000n,
    );
  }
});

Deno.test("Pipeline - rejects non-CanonicalTx input (missing amount)", async () => {
  const store = new MockStore();
  const invalidTx = {
    date: new Date("2026-05-30"),
    currency: "USD",
  };

  const result = await processCanonicalTx(invalidTx, store);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.error, "Invalid CanonicalTx boundary input");
  }
  assertEquals(store.saved.length, 0);
});

Deno.test("Pipeline - rejects non-CanonicalTx input (coerced amount)", async () => {
  const store = new MockStore();
  const coercedTx = {
    date: new Date("2026-05-30"),
    amount: "10000", // string, not bigint
    currency: "USD",
  };

  const result = await processCanonicalTx(coercedTx, store);
  assertEquals(result.ok, false);
  assertEquals(store.saved.length, 0);
});

Deno.test("Pipeline - integration csv-mapper -> pipeline", async () => {
  const store = new MockStore();
  const row = { "Date": "2026-05-30", "Amount": "150.00", "Currency": "USD" };
  const mapping = {
    "Date": "date",
    "Amount": "amount",
    "Currency": "currency",
  };

  const mapResult = mapCsvRow(row, mapping, ["Date", "Amount", "Currency"]);
  assertEquals(mapResult.ok, true);

  if (mapResult.ok) {
    const pipelineResult = await processCanonicalTx(mapResult.value, store);
    assertEquals(pipelineResult.ok, true);
    if (pipelineResult.ok) {
      assertEquals(pipelineResult.value.amount, 15000n);
      assertEquals(pipelineResult.value.currency, "USD");
      assertEquals(store.saved.length, 1);
    }
  }
});
