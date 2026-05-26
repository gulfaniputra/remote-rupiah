import { assertEquals } from "@std/assert";
import {
  aggregate,
  computeUnrealized,
  getUnrealized,
  runFIFO,
  StubFx,
} from "./unrealized.ts";

Deno.test("fifo exposes open lots", () => {
  const r = runFIFO([
    {
      source: "wise",
      usd_cents: 100000n,
      idr_cents: 1500000000n,
    },
    {
      source: "wise",
      usd_cents: -40000n,
      idr_cents: 640000000n,
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
  const input = [
    {
      source: "wise",
      usd_cents: 100000n,
      idr_cents: 1500000000n,
    },
    {
      source: "wise",
      usd_cents: -40000n,
      idr_cents: 640000000n,
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
    (total, current) => current.usd_cents > 0n ? total + current.idr_cents : total,
    0n,
  );

  assertEquals(totalCostOpen + totalCostRealized, totalCostInput);
});

Deno.test("deterministic output", async () => {
  const r1 = await getUnrealized([
    {
      source: "wise",
      usd_cents: 100000n,
      idr_cents: 1500000000n,
    },
    {
      source: "wise",
      usd_cents: -40000n,
      idr_cents: 640000000n,
    },
  ], new StubFx(16000n));
  const r2 = await getUnrealized([
    {
      source: "wise",
      usd_cents: 100000n,
      idr_cents: 1500000000n,
    },
    {
      source: "wise",
      usd_cents: -40000n,
      idr_cents: 640000000n,
    },
  ], new StubFx(16000n));

  assertEquals(r1, r2);
});
