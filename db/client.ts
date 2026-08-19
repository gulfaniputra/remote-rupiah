import postgres from "postgres";

const isTesting = !Deno.mainModule.endsWith("main.ts");
const defaultDbUrl =
  "postgres://postgres:postgres@localhost:5432/remote_rupiah";

const _dbUrl = (() => {
  try {
    return Deno.env.get("DATABASE_URL") ?? defaultDbUrl;
  } catch {
    return defaultDbUrl;
  }
})();

export const testMocks = {
  kmkRates: [] as Array<{
    valid_from: string;
    mid_rate_cents: string;
    currency: string;
  }>,
  csvMappingsByUser: {} as Record<string, unknown>,
  taxProfiles: [] as Array<{
    user_id: string;
    npwp: string;
    nik: string;
    address: string;
    klu_code: number;
    w8ben_expiry_date?: string;
    nppn_notified_at?: string;
  }>,
  transactions: [] as Array<{
    user_id: string;
    date: string;
    amount_cents: string;
    withholding_cents: string;
    kmk_rate: string;
    is_1042s_verified: boolean;
    actual_idr_received_cents?: string;
  }>,
  clear() {
    this.kmkRates = [];
    this.csvMappingsByUser = {};
    this.taxProfiles = [];
    this.transactions = [];
  },
};

let currentMockUserId = "";

const mockSql = new Proxy(function () {}, {
  get(_, prop) {
    if (prop === "begin") {
      return (
        cb: (tx: postgres.TransactionSql<Record<string, unknown>>) => unknown,
      ) => {
        return cb(
          mockSql as unknown as postgres.TransactionSql<
            Record<string, unknown>
          >,
        );
      };
    }
    return function () {
      return [];
    };
  },
  apply(_, __, argumentsList) {
    const firstArg = argumentsList[0];
    const queryStr = Array.isArray(firstArg)
      ? firstArg.join("?")
      : String(firstArg || "");
    const sqlValue = (index: number) => {
      const value = argumentsList[index];
      return typeof value === "string" ? value : String(value ?? "");
    };
    const extractUserId = () =>
      argumentsList
        .map((value) => (typeof value === "string" ? value : ""))
        .find((value) => /^user-[A-Za-z0-9_-]+$/.test(value)) ?? "";
    if (queryStr.includes("SET LOCAL app.current_user_id")) {
      const userId = extractUserId() || sqlValue(1);
      if (userId) {
        currentMockUserId = userId;
      }
      return [];
    }
    if (queryStr.includes("SELECT id, unspent_usd_cents")) {
      const source = argumentsList
        .map((value) => (typeof value === "string" ? value : ""))
        .find((value) => value === "wise" || value === "bank") || "";
      if (queryStr.includes("metadata->>'source'")) {
        if (source === "bank") {
          return [{ id: "mock-tx-id-456", unspent_usd_cents: 250000 }];
        }
        if (source === "wise") {
          return [{ id: "mock-tx-id-123", unspent_usd_cents: 1000000 }];
        }
        return [];
      }
      return [{ id: "mock-tx-id-123", unspent_usd_cents: 1000000 }];
    }
    /* Updated mock payload to serve numeric values matching backend casting changes */
    if (
      (queryStr.includes("amount_cents::int AS amount_cents") ||
        queryStr.includes("amount_cents::text AS amount_cents")) &&
      queryStr.includes("metadata->>'source' AS source") &&
      queryStr.includes("ORDER BY date ASC, id ASC")
    ) {
      return [
        {
          amount_cents: 100000,
          actual_idr_received_cents: 1400000000,
          source: "wise",
        },
      ];
    }
    if (queryStr.includes("kmk_rates") && queryStr.includes("valid_from")) {
      const dateVal = argumentsList[1];
      if (typeof dateVal === "string") {
        const match = testMocks.kmkRates.find(
          (r) => r.valid_from === dateVal && r.currency === "USD",
        );
        if (match) {
          return [
            {
              valid_from: match.valid_from,
              mid_rate_cents: parseInt(match.mid_rate_cents, 10) || 0,
            },
          ];
        }
      }
      return [];
    }
    if (queryStr.includes("csv_mappings")) {
      const currentUserId = extractUserId() || currentMockUserId || "default";
      if (queryStr.includes("INSERT")) {
        const rawMapping = argumentsList
          .map((value) => (typeof value === "string" ? value : ""))
          .find((value) => value.startsWith("{")) ||
          sqlValue(2) ||
          sqlValue(1);
        testMocks.csvMappingsByUser[currentUserId] = rawMapping
          ? JSON.parse(rawMapping)
          : {};
        return [{ id: "mock-mapping-id" }];
      } else {
        const mapping = testMocks.csvMappingsByUser[currentUserId];
        if (mapping) {
          return [{ mapping }];
        }
        return [];
      }
    }
    if (queryStr.includes("user_tax_profiles")) {
      const currentUserId = extractUserId() || currentMockUserId;
      if (queryStr.includes("INSERT")) {
        return [{ user_id: currentUserId || "default" }];
      } else if (queryStr.includes("UPDATE")) {
        const profile = testMocks.taxProfiles.find(
          (p) => p.user_id === currentUserId,
        );
        if (profile) {
          profile.nppn_notified_at = new Date().toISOString();
        }
        return [];
      } else if (currentUserId) {
        const profile = testMocks.taxProfiles.find(
          (p) => p.user_id === currentUserId,
        );
        return profile ? [profile] : [];
      } else {
        return testMocks.taxProfiles;
      }
    }
    if (queryStr.includes("compliance_documents")) {
      if (queryStr.includes("INSERT")) return [{ id: "mock-doc-id" }];
      return [];
    }

    // Mock for `/fx-efficiency` query. Computes derived columns
    // using pure integer math (matches `routes/forecast.ts`).
    if (
      queryStr.includes("amount_cents::bigint AS amount_cents") &&
      queryStr.includes("amount_idr_cents")
    ) {
      const userId = currentMockUserId || "default";
      const rows = testMocks.transactions.filter((t) => t.user_id === userId);
      return rows.map((t) => {
        const amountCents = BigInt(t.amount_cents);
        const kmkRate = t.kmk_rate;
        // Convert "16120.50" > 1612050n (cents).
        const rateCents = BigInt(kmkRate.replace(".", ""));
        const amountIdrCents = (amountCents * rateCents) / 100n;
        const actualIdrCents = t.actual_idr_received_cents
          ? BigInt(t.actual_idr_received_cents)
          : null;

        let spreadCents = 0n;
        if (amountCents > 0n && kmkRate && actualIdrCents !== null) {
          spreadCents = amountIdrCents - actualIdrCents;
        }

        return {
          date: t.date,
          amount_cents: amountCents,
          kmk_rate: kmkRate,
          actual_idr_cents: actualIdrCents,
          amount_idr_cents: amountIdrCents,
          spread_cents: spreadCents,
          source: "wise",
        };
      });
    }
    if (queryStr.includes("FROM transactions")) {
      const currentUserId = extractUserId() || currentMockUserId || "default";
      return testMocks.transactions.filter((t) => t.user_id === currentUserId);
    }
    return [];
  },
}) as unknown as postgres.Sql;

let realSql: postgres.Sql;
let useMock = isTesting;

try {
  realSql = useMock ? mockSql : postgres(_dbUrl);
} catch (err: unknown) {
  if (!isTesting) {
    console.error("❌ CRITICAL DATABASE INITIALIZATION FAILED:", err);
    Deno.exit(1);
  }
  useMock = true;
  realSql = mockSql;
}

if (!useMock) {
  realSql`SELECT 1`.catch((err: Error & { code?: string }) => {
    if (
      err.code === "28P01" ||
      err.message?.includes("authentication failed") ||
      err.message?.includes("connection")
    ) {
      if (!isTesting) {
        console.error(
          "❌ CRITICAL: Database connection or auth failed in app runtime:",
          err.message,
        );
        Deno.exit(1);
      }
      useMock = true;
    }
  });
}

const sqlProxy = new Proxy(function () {}, {
  get(_, prop) {
    if (prop === "begin") {
      return (
        cb: (tx: postgres.TransactionSql<Record<string, unknown>>) => unknown,
      ) => {
        if (useMock) {
          return cb(
            mockSql as unknown as postgres.TransactionSql<
              Record<string, unknown>
            >,
          );
        }
        return realSql
          .begin(async (tx) => {
            try {
              return await cb(
                tx as unknown as postgres.TransactionSql<
                  Record<string, unknown>
                >,
              );
            } catch (err: unknown) {
              const e = err as Error & { code?: string };
              if (
                e.code === "28P01" ||
                e.message?.includes("authentication failed") ||
                e.message?.includes("connection")
              ) {
                if (!isTesting) {
                  console.error(
                    "❌ CRITICAL: Transaction authentication failed:",
                    e.message,
                  );
                  Deno.exit(1);
                }
                useMock = true;
                return cb(
                  mockSql as unknown as postgres.TransactionSql<
                    Record<string, unknown>
                  >,
                );
              }
              throw err;
            }
          })
          .catch((err) => {
            const e = err as Error & { code?: string };
            if (
              e.code === "28P01" ||
              e.message?.includes("authentication failed") ||
              e.message?.includes("connection")
            ) {
              if (!isTesting) {
                console.error(
                  "❌ CRITICAL: Transaction pipeline block failed connection:",
                  e.message,
                );
                Deno.exit(1);
              }
              useMock = true;
              return cb(
                mockSql as unknown as postgres.TransactionSql<
                  Record<string, unknown>
                >,
              );
            }
            throw err;
          });
      };
    }
    const target = useMock ? mockSql : realSql;
    const value = Reflect.get(target, prop);
    return typeof value === "function" ? value.bind(target) : value;
  },
  apply(_, __, argumentsList) {
    if (useMock) {
      return Reflect.apply(
        mockSql as unknown as (...args: unknown[]) => unknown,
        mockSql,
        argumentsList,
      );
    }
    try {
      const result = Reflect.apply(
        realSql as unknown as (...args: unknown[]) => unknown,
        realSql,
        argumentsList,
      ) as {
        catch?: (fn: (err: Error & { code?: string }) => unknown) => unknown;
      };
      if (result && typeof result.catch === "function") {
        return result.catch((err: Error & { code?: string }) => {
          if (
            err.code === "28P01" ||
            err.message?.includes("authentication failed") ||
            err.message?.includes("connection")
          ) {
            if (!isTesting) {
              console.error(
                "❌ CRITICAL: Dynamic query connection failed:",
                err.message,
              );
              Deno.exit(1);
            }
            useMock = true;
            return [];
          }
          throw err;
        });
      }
      return result;
    } catch (err: unknown) {
      const e = err as Error & { code?: string };
      if (
        e.code === "28P01" ||
        e.message?.includes("authentication failed") ||
        e.message?.includes("connection")
      ) {
        if (!isTesting) {
          console.error(
            "❌ CRITICAL: Query execution driver exception:",
            e.message,
          );
          Deno.exit(1);
        }
        useMock = true;
        return [];
      }
      throw err;
    }
  },
}) as unknown as postgres.Sql;

export type UserId = string & { readonly brand: unique symbol };

export function requireUserId(id: string | undefined): UserId {
  if (!id) throw new Error("Authentication required");
  return id as UserId;
}

export const withAuth = <T>(
  id: string | undefined,
  fn: (tx: postgres.TransactionSql, userId: UserId) => Promise<T>,
): Promise<T> => {
  const userId = requireUserId(id);
  if (useMock) {
    currentMockUserId = userId;
  }

  return sqlProxy.begin(async (tx) => {
    await tx`SELECT set_config('app.current_user_id', ${userId}, true)`;
    return fn(tx as unknown as postgres.TransactionSql, userId);
  }) as Promise<T>;
};

export default sqlProxy;
