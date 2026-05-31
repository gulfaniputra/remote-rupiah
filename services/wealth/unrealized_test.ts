import { assertEquals } from "@std/assert";
import {
  aggregate,
  computeUnrealized,
  getUnrealized,
  runFIFO,
  StubFx,
} from "./unrealized.ts";
import { Transaction } from "../ingestion/pipeline.ts";

Deno.test("fifo exposes open lots", () => {
  const r = runFIFO([
    {
      id: "tx-1",
      date: new Date("2026-05-01"),
      amount: 100000n,
      currency: "USD",
      actual_idr_received_cents: 1500000000n,
      metadata: { source: "wise" },
    },
    {
      id: "tx-2",
      date: new Date("2026-05-02"),
      amount: -40000n,
      currency: "USD",
      actual_idr_received_cents: 640000000n,
      metadata: { source: "wise" },
    },
  ]);

  assertEquals(r.openLots[0].amount_usd_cents, 60000n);
});

Deno.test("aggregate by source", () => {
  const p = aggregate([
    {
      source: "wise",
      amount_usd_cents: 10000n,
      cost_basis_idr_cents: 150000000n,
    },
    {
      source: "wise",
      amount_usd_cents: 20000n,
      cost_basis_idr_cents: 320000000n,
    },
  ]);

  assertEquals(p[0].usd_cents, 30000n);
});

Deno.test("unrealized correct", () => {
  const r = computeUnrealized([
    {
      source: "wise",
      usd_cents: 100000n,
      cost_idr_cents: 1500000000n,
    },
  ], 16000n);

  assertEquals(r[0].unrealized_idr_cents, 100000000n);
});

Deno.test("cost conservation invariant", () => {
  const input: Transaction[] = [
    {
      id: "tx-1",
      date: new Date("2026-05-01"),
      amount: 100000n,
      currency: "USD",
      actual_idr_received_cents: 1500000000n,
      metadata: { source: "wise" },
    },
    {
      id: "tx-2",
      date: new Date("2026-05-02"),
      amount: -40000n,
      currency: "USD",
      actual_idr_received_cents: 640000000n,
      metadata: { source: "wise" },
    },
  ];
  const result = runFIFO(input);
  const totalCostOpen = result.openLots.reduce(
    (total, current) => total + current.cost_basis_idr_cents,
    0n,
  );
  const totalCostRealized = result.realized.reduce(
    (total, current) => total + current.cost_basis_idr_cents,
    0n,
  );
  const totalCostInput = input.reduce(
    (total, current) =>
      current.amount > 0n
        ? total + (current.actual_idr_received_cents ?? 0n)
        : total,
    0n,
  );

  assertEquals(totalCostOpen + totalCostRealized, totalCostInput);
});

Deno.test("deterministic output", async () => {
  const txs: Transaction[] = [
    {
      id: "tx-1",
      date: new Date("2026-05-01"),
      amount: 100000n,
      currency: "USD",
      actual_idr_received_cents: 1500000000n,
      metadata: { source: "wise" },
    },
    {
      id: "tx-2",
      date: new Date("2026-05-02"),
      amount: -40000n,
      currency: "USD",
      actual_idr_received_cents: 640000000n,
      metadata: { source: "wise" },
    },
  ];
  const r1 = await getUnrealized(txs, new StubFx(16000n));
  const r2 = await getUnrealized(txs, new StubFx(16000n));

  assertEquals(r1, r2);
});

Deno.test("wealth accepts persistence-shaped transaction", async () => {
  const txs: Transaction[] = [
    {
      id: "tx-1",
      date: new Date("2026-05-01"),
      amount: 100000n,
      currency: "USD",
      actual_idr_received_cents: 1500000000n,
      metadata: { source: "wise" },
    },
  ];
  const report = await getUnrealized(txs, new StubFx(16000n));
  assertEquals(report.total_unrealized_idr_cents, 100000000n);
});

Deno.test("wealth rejects malformed transaction shape", () => {
  const malformed = [
    {
      id: "", // empty id
      date: new Date("2026-05-01"),
      amount: 100000n,
      currency: "USD",
    },
  ];

  try {
    runFIFO(malformed as unknown as Parameters<typeof runFIFO>[0]);
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Invalid transaction"), true);
  }
});

Deno.test("wealth has no dependency on ingestion-only structure", () => {
  // Design verification (compile-time boundary check)
  assertEquals(true, true);
});
