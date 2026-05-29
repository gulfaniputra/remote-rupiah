import { assertEquals } from "@std/assert";
import { generateDeterministicId, Transaction } from "../ingestion/pipeline.ts";
import { runFIFO } from "../wealth/unrealized.ts";

Deno.test("Transaction contract requires id, date, amount, currency", () => {
  const tx: Transaction = {
    id: "tx-1",
    date: new Date("2026-05-29T12:00:00Z"),
    amount: 10000n,
    currency: "USD",
  };

  assertEquals(typeof tx.id, "string");
  assertEquals(tx.date instanceof Date, true);
  assertEquals(typeof tx.amount, "bigint");
  assertEquals(tx.currency, "USD");
});

Deno.test("Deterministic ID generation for identical input", () => {
  const input1 = {
    date: new Date("2026-05-29T12:00:00Z"),
    amount: 10000n,
    currency: "USD",
    metadata: { source: "wise" },
  };
  const input2 = {
    date: new Date("2026-05-29T12:00:00Z"),
    amount: 10000n,
    currency: "USD",
    metadata: { source: "wise" },
  };

  const id1 = generateDeterministicId(input1);
  const id2 = generateDeterministicId(input2);

  assertEquals(id1, id2);
  assertEquals(typeof id1, "string");
  assertEquals(id1.length > 0, true);
});

Deno.test("Ingestion output is usable by wealth without transform", () => {
  const ingestionOutput: Transaction[] = [
    {
      id: "1",
      date: new Date("2026-05-01"),
      amount: 100000n,
      currency: "USD",
      actual_idr_received_cents: 1500000000n,
      metadata: { source: "wise" },
    },
    {
      id: "2",
      date: new Date("2026-05-02"),
      amount: -40000n,
      currency: "USD",
      actual_idr_received_cents: 640000000n,
      metadata: { source: "wise" },
    },
  ];

  const result = runFIFO(ingestionOutput);

  assertEquals(result.openLots.length, 1);
  assertEquals(result.openLots[0].amount_usd_cents, 60000n);
  assertEquals(result.openLots[0].cost_basis_idr_cents, 900000000n);
});
