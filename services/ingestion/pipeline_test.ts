import { assertEquals } from "@std/assert";
import {
  CanonicalField,
  ingestCsvStream,
  mapAndDecodeRow,
  MappingConfig,
  MemoryPersistenceStore,
  normalizeHeaders,
  schema,
  stringToStream,
  validateMappingConfig,
} from "./pipeline.ts";

Deno.test("Unit - normalizeHeaders basic and edge cases", () => {
  assertEquals(
    normalizeHeaders([
      " Transaction Date ",
      "Tx-Amount",
      "Currency Code",
      "actual_idr_received_cents",
    ]),
    [
      "transaction_date",
      "tx_amount",
      "currency_code",
      "actual_idr_received_cents",
    ],
  );
});

Deno.test("Unit - Date Decoder", () => {
  const res1 = schema.date("2026-05-17T14:30:00.000Z");
  assertEquals(
    res1.ok ? res1.value.toISOString() : undefined,
    "2026-05-17T14:30:00.000Z",
  );

  const res2 = schema.date("2026-05-17");
  assertEquals(
    res2.ok ? res2.value.toISOString().startsWith("2026-05-17") : false,
    true,
  );

  assertEquals(schema.date("17-05-2026"), {
    ok: false,
    error: "INVALID_FORMAT",
  });
  assertEquals(schema.date("2026-02-31"), {
    ok: false,
    error: "TRANSFORM_FAILED",
  });
});

Deno.test("Unit - Amount Decoder", () => {
  assertEquals(schema.amount("1250.55"), { ok: true, value: 125055n });
  assertEquals(schema.amount("-400.00"), { ok: true, value: -40000n });
  assertEquals(schema.amount("0"), { ok: true, value: 0n });
  assertEquals(schema.amount("abc"), { ok: false, error: "INVALID_FORMAT" });
});

Deno.test("Unit - Currency Decoder", () => {
  assertEquals(schema.currency("USD"), { ok: true, value: "USD" });
  assertEquals(schema.currency("usd"), { ok: true, value: "USD" });
  assertEquals(schema.currency("USDT"), { ok: false, error: "INVALID_FORMAT" });
});

const sampleConfig: MappingConfig = {
  version: 1,
  fields: [
    { source: "tx_date", target: "date", required: true },
    { source: "tx_amount", target: "amount", required: true },
    { source: "tx_currency", target: "currency", required: true },
    {
      source: "idr_received",
      target: "actual_idr_received_cents",
      required: false,
    },
    { source: "tx_source", target: "source", required: false },
  ],
};

Deno.test("Unit - mapAndDecodeRow success with generated id", () => {
  const result = mapAndDecodeRow(
    {
      tx_date: "2026-05-17T12:00:00Z",
      tx_amount: "100.00",
      tx_currency: "USD",
      idr_received: "1500000.00",
      tx_source: "wise",
    },
    sampleConfig,
    1,
    "lenient",
  );
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.date.toISOString(), "2026-05-17T12:00:00.000Z");
    assertEquals(result.value.amount, 10000n);
    assertEquals(result.value.currency, "USD");
    assertEquals(result.value.actual_idr_received_cents, 150000000n);
    assertEquals(result.value.metadata?.source, "wise");
    assertEquals(typeof result.value.id, "string");
  }
});

// Phase 1 requirements:
Deno.test("Ingestion - output includes id/date/amount/currency", async () => {
  const store = new MemoryPersistenceStore();
  await ingestCsvStream(
    stringToStream(
      "tx_date,tx_amount,tx_currency,tx_source\n" +
        "2026-05-01T00:00:00Z,1000.00,USD,wise\n",
    ),
    sampleConfig,
    store,
    "lenient",
  );
  const records = await store.getAll();
  assertEquals(records.length, 1);
  const r = records[0];
  assertEquals(typeof r.id, "string");
  assertEquals(r.id.length > 0, true);
  assertEquals(r.date instanceof Date, true);
  assertEquals(r.amount, 100000n);
  assertEquals(r.currency, "USD");
});

Deno.test("Ingestion - id stable across repeated runs", async () => {
  const csv =
    "tx_date,tx_amount,tx_currency,tx_source\n2026-05-01T00:00:00Z,1000.00,USD,wise\n";

  const store1 = new MemoryPersistenceStore();
  await ingestCsvStream(stringToStream(csv), sampleConfig, store1, "lenient");
  const r1 = (await store1.getAll())[0];

  const store2 = new MemoryPersistenceStore();
  await ingestCsvStream(stringToStream(csv), sampleConfig, store2, "lenient");
  const r2 = (await store2.getAll())[0];

  assertEquals(r1.id, r2.id);
});

Deno.test("Ingestion - no null/undefined critical fields", async () => {
  const store = new MemoryPersistenceStore();
  await ingestCsvStream(
    stringToStream(
      "tx_date,tx_amount,tx_currency,tx_source\n" +
        "2026-05-01T00:00:00Z,1000.00,USD,wise\n",
    ),
    sampleConfig,
    store,
    "lenient",
  );
  const records = await store.getAll();
  assertEquals(records.length, 1);
  const r = records[0];
  assertEquals(r.id !== undefined && r.id !== null, true);
  assertEquals(r.date !== undefined && r.date !== null, true);
  assertEquals(r.amount !== undefined && r.amount !== null, true);
  assertEquals(r.currency !== undefined && r.currency !== null, true);
});
