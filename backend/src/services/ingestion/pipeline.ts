import { CanonicalTx } from "../../domain/canonical-tx.ts";

export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface Transaction extends CanonicalTx {
  id: string;
}

export interface PersistenceStore {
  save(tx: Transaction): Promise<void>;
}

/**
 * Strict type-guard to validate CanonicalTx at boundary, ensuring no implicit coercion.
 */
export function isCanonicalTx(tx: any): tx is CanonicalTx {
  return (
    tx !== null &&
    typeof tx === "object" &&
    tx.date instanceof Date &&
    !isNaN(tx.date.getTime()) &&
    typeof tx.amount === "bigint" &&
    typeof tx.currency === "string" &&
    /^[A-Z]{3}$/.test(tx.currency)
  );
}

/**
 * Pure helper for deterministic ID generation.
 */
export function generateDeterministicId(tx: CanonicalTx): string {
  const str = `${
    tx.date.toISOString().split("T")[0]
  }|${tx.amount}|${tx.currency}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Processes a CanonicalTx, generates a deterministic ID, and persists it.
 */
export async function processCanonicalTx(
  input: unknown,
  store: PersistenceStore,
): Promise<Result<Transaction, string>> {
  if (!isCanonicalTx(input)) {
    return { ok: false, error: "Invalid CanonicalTx boundary input" };
  }

  const transaction: Transaction = {
    ...input,
    id: generateDeterministicId(input),
  };

  try {
    await store.save(transaction);
    return { ok: true, value: transaction };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
