import sql from "../../db/client.ts";
import postgres from "postgres";

const isTesting = !Deno.mainModule.endsWith("main.ts");

export type WealthEntry = {
  source: string;
  usd_cents: bigint;
  idr_cents: bigint;
};

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

export const runFIFO = (entries: WealthEntry[]): FIFOResult => {
  const openLots: Lot[] = [];
  const realized: RealizedGain[] = [];

  for (const entry of entries) {
    if (entry.usd_cents > 0n) {
      openLots.push({
        source: entry.source,
        amount_usd_cents: entry.usd_cents,
        cost_basis_idr_cents: entry.idr_cents,
      });
      continue;
    }

    let remaining = -entry.usd_cents;

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
      const proceeds = entry.idr_cents * matched / (-entry.usd_cents);

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
  amount_cents: string | bigint;
  actual_idr_received_cents: string | bigint | null;
  source: string | null;
};

export const getUnrealized = async (
  entries: WealthEntry[],
  fx: FxProvider,
): Promise<UnrealizedReport> => {
  const fx_rate = await fx.getLatestUsdIdr();
  const positions = computeUnrealized(aggregate(runFIFO(entries).openLots), fx_rate);
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
        amount_cents::text AS amount_cents,
        actual_idr_received_cents::text AS actual_idr_received_cents,
        metadata->>'source' AS source
      FROM transactions
      WHERE currency = 'USD'
      ORDER BY date ASC, id ASC
    ` as TransactionRow[];

    return getUnrealized(
      rows.flatMap((row) =>
        BigInt(row.amount_cents) === 0n
          ? []
          : [{
            source: row.source ?? "unknown",
            usd_cents: BigInt(row.amount_cents),
            idr_cents: BigInt(row.actual_idr_received_cents ?? 0),
          }]
      ),
      fx,
    );
  });
