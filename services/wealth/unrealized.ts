import sql from "../../db/client.ts";
import postgres from "postgres";
import { Transaction } from "../ingestion/pipeline.ts";

const isTesting = !Deno.mainModule.endsWith("main.ts");

export type RealizedGain = {
  source: string;
  amount_usd_cents: bigint;
  cost_basis_idr_cents: bigint;
  proceeds_idr_cents: bigint;
  realized_idr_cents: bigint;
};

export type Lot = {
  amount_usd_cents: bigint;
  cost_basis_idr_cents: bigint;
  source: string;
};

export type FIFOResult = {
  realized: RealizedGain[];
  openLots: Lot[];
};

export type Position = {
  source: string;
  usd_cents: bigint;
  cost_idr_cents: bigint;
};

export type Unrealized = {
  source: string;
  unrealized_idr_cents: bigint;
};

export type UnrealizedReport = {
  fx_rate: bigint;
  total_unrealized_idr_cents: bigint;
  positions: Unrealized[];
};

export type IdrPerUsd = bigint;

export interface FxProvider {
  getLatestUsdIdr(): Promise<IdrPerUsd>;
}

export class FixedEnvFx implements FxProvider {
  getLatestUsdIdr() {
    try {
      const rate = Deno.env.get("USD_IDR_RATE")?.trim();
      if (rate && /^\d+$/.test(rate)) {
        return Promise.resolve(BigInt(rate));
      }
    } catch {
      if (!isTesting) {
        return Promise.reject(new Error("USD_IDR_RATE unavailable"));
      }
    }
    if (!isTesting) {
      return Promise.reject(new Error("USD_IDR_RATE unavailable"));
    }
    return Promise.resolve(15000n);
  }
}

export class StubFx implements FxProvider {
  constructor(private rate: bigint) {}

  getLatestUsdIdr() {
    return Promise.resolve(this.rate);
  }
}

const validateTransaction = (t: unknown) => {
  const transaction = t as Record<string, unknown>;
  if (
    !t ||
    typeof transaction.id !== "string" ||
    transaction.id.trim() === "" ||
    !(transaction.date instanceof Date) ||
    isNaN(transaction.date.getTime()) ||
    typeof transaction.amount !== "bigint" ||
    typeof transaction.currency !== "string" ||
    transaction.currency.length !== 3
  ) {
    throw new Error("Invalid transaction: malformed shape");
  }
};

export const runFIFO = (entries: Transaction[]): FIFOResult => {
  const openLots: Lot[] = [];
  const realized: RealizedGain[] = [];

  for (const entry of entries) {
    validateTransaction(entry);

    if (entry.amount > 0n) {
      const source = entry.metadata?.source;
      openLots.push({
        source: typeof source === "string" ? source : "unknown",
        amount_usd_cents: entry.amount,
        cost_basis_idr_cents: entry.actual_idr_received_cents ?? 0n,
      });
      continue;
    }

    let remaining = -entry.amount;

    while (remaining > 0n) {
      const current = openLots[0];
      if (!current) {
        throw new Error("Insufficient open lots");
      }

      const matched = remaining < current.amount_usd_cents
        ? remaining
        : current.amount_usd_cents;
      const costBasis = current.cost_basis_idr_cents * matched /
        current.amount_usd_cents;
      const proceeds = (entry.actual_idr_received_cents ?? 0n) * matched /
        (-entry.amount);

      realized.push({
        source: current.source,
        amount_usd_cents: matched,
        cost_basis_idr_cents: costBasis,
        proceeds_idr_cents: proceeds,
        realized_idr_cents: proceeds - costBasis,
      });

      if (matched === current.amount_usd_cents) {
        openLots.shift();
      } else {
        openLots[0] = {
          ...current,
          amount_usd_cents: current.amount_usd_cents - matched,
          cost_basis_idr_cents: current.cost_basis_idr_cents - costBasis,
        };
      }

      remaining -= matched;
    }
  }

  return { realized, openLots };
};

export const aggregate = (lots: Lot[]): Position[] =>
  Array.from(
    lots.reduce((acc, lot) => {
      const current = acc.get(lot.source) ?? {
        source: lot.source,
        usd_cents: 0n,
        cost_idr_cents: 0n,
      };
      acc.set(lot.source, {
        source: lot.source,
        usd_cents: current.usd_cents + lot.amount_usd_cents,
        cost_idr_cents: current.cost_idr_cents + lot.cost_basis_idr_cents,
      });
      return acc;
    }, new Map<string, Position>()).values(),
  );

export const computeUnrealized = (
  positions: Position[],
  fx_rate: bigint,
): Unrealized[] =>
  positions.map((position) => ({
    source: position.source,
    unrealized_idr_cents: position.usd_cents * fx_rate -
      position.cost_idr_cents,
  }));

type TransactionRow = {
  id: string;
  date: string;
  currency: string;
  amount_cents: string | bigint;
  actual_idr_received_cents: string | bigint | null;
  metadata: Record<string, unknown> | null;
};

export const getUnrealized = async (
  entries: Transaction[],
  fx: FxProvider,
): Promise<UnrealizedReport> => {
  const fx_rate = await fx.getLatestUsdIdr();
  const positions = computeUnrealized(
    aggregate(runFIFO(entries).openLots),
    fx_rate,
  );
  return {
    fx_rate,
    positions,
    total_unrealized_idr_cents: positions.reduce(
      (total, position) => total + position.unrealized_idr_cents,
      0n,
    ),
  };
};

export const getUnrealizedForUser = (
  userId: string,
  fx: FxProvider,
): Promise<UnrealizedReport> =>
  sql.begin(async (tx: postgres.TransactionSql<Record<string, unknown>>) => {
    await tx`SELECT set_config('app.current_user_id', ${userId}, true)`;
    const rows = await tx`
      SELECT
        id::text AS id,
        date::text AS date,
        currency,
        amount_cents::text AS amount_cents,
        actual_idr_received_cents::text AS actual_idr_received_cents,
        metadata
      FROM transactions
      WHERE currency = 'USD'
      ORDER BY date ASC, id ASC
    ` as TransactionRow[];

    return getUnrealized(
      rows.flatMap((row) =>
        BigInt(row.amount_cents) === 0n ? [] : [{
          id: row.id,
          date: new Date(row.date),
          amount: BigInt(row.amount_cents),
          currency: row.currency,
          actual_idr_received_cents: row.actual_idr_received_cents
            ? BigInt(row.actual_idr_received_cents)
            : 0n,
          metadata: typeof row.metadata === "string"
            ? JSON.parse(row.metadata)
            : row.metadata,
        }]
      ),
      fx,
    );
  });
