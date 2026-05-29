import { CsvParseStream } from "@std/csv";

/**
 * Deterministic Transaction Ingestion Pipeline with a Field Mapping Layer.
 * Follows strict pure-functional core constraints and minimalist code style.
 */

export interface Transaction {
  id: string;
  date: Date;
  amount: bigint;
  currency: string;
  actual_idr_received_cents?: bigint | null;
  metadata?: Record<string, any> | null;
}

export type CanonicalField =
  | "id"
  | "date"
  | "amount"
  | "currency"
  | "actual_idr_received_cents"
  | "source";

export type ErrorCode =
  | "REQUIRED_MISSING"
  | "INVALID_FORMAT"
  | "UNKNOWN_FIELD"
  | "TRANSFORM_FAILED";

export type Result<E, T> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export interface RowError {
  row: number;
  field: CanonicalField;
  code: ErrorCode;
  input?: string;
}

export interface IngestionReport {
  total: number;
  success: number;
  failed: number;
  errors: RowError[];
}

export interface FieldMapping {
  source: string;
  target: CanonicalField;
  required: boolean;
}

export interface MappingConfig {
  version: number;
  fields: readonly FieldMapping[];
}

export type Decoder<T> = (input: string) => Result<ErrorCode, T>;

export interface Schema {
  id: Decoder<string>;
  date: Decoder<Date>;
  amount: Decoder<bigint>;
  currency: Decoder<string>;
  actual_idr_received_cents: Decoder<bigint>;
  source: Decoder<string>;
}

const VALID_CANONICAL_FIELDS: CanonicalField[] = [
  "id",
  "date",
  "amount",
  "currency",
  "actual_idr_received_cents",
  "source",
];

/**
 * Strict schema-on-read decoders (SSOT).
 * No implicit coercion, explicit failures only.
 */
export const schema: Schema = {
  id: (input: string): Result<ErrorCode, string> =>
    input.trim() === ""
      ? { ok: false, error: "INVALID_FORMAT" }
      : { ok: true, value: input },

  date: (input: string): Result<ErrorCode, Date> => {
    if (
      !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:?\d{2})?)?$/
        .test(input)
    ) {
      return { ok: false, error: "INVALID_FORMAT" };
    }
    const date = new Date(input);
    if (isNaN(date.getTime())) {
      return { ok: false, error: "TRANSFORM_FAILED" };
    }
    const [y, m, d] = input.split("T")[0].split("-").map((s) =>
      parseInt(s, 10)
    );
    const utcDate = new Date(Date.UTC(y, m - 1, d));
    return utcDate.getUTCFullYear() === y &&
        utcDate.getUTCMonth() === m - 1 &&
        utcDate.getUTCDate() === d
      ? { ok: true, value: date }
      : { ok: false, error: "TRANSFORM_FAILED" };
  },

  amount: (input: string): Result<ErrorCode, bigint> => {
    const clean = input.replace(/,/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(clean)) {
      return { ok: false, error: "INVALID_FORMAT" };
    }
    try {
      const [i, f = ""] = clean.split(".");
      const centsStr = (i || "0") + f.padEnd(2, "0").slice(0, 2);
      return { ok: true, value: BigInt(centsStr) };
    } catch {
      return { ok: false, error: "INVALID_FORMAT" };
    }
  },

  currency: (input: string): Result<ErrorCode, string> =>
    /^[a-zA-Z]{3}$/.test(input)
      ? { ok: true, value: input.toUpperCase() }
      : { ok: false, error: "INVALID_FORMAT" },

  actual_idr_received_cents: (input: string): Result<ErrorCode, bigint> => {
    const clean = input.replace(/,/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(clean)) {
      return { ok: false, error: "INVALID_FORMAT" };
    }
    try {
      const [i, f = ""] = clean.split(".");
      const centsStr = (i || "0") + f.padEnd(2, "0").slice(0, 2);
      return { ok: true, value: BigInt(centsStr) };
    } catch {
      return { ok: false, error: "INVALID_FORMAT" };
    }
  },

  source: (input: string): Result<ErrorCode, string> =>
    input.trim() === ""
      ? { ok: false, error: "INVALID_FORMAT" }
      : { ok: true, value: input },
};

/**
 * Normalizes CSV headers.
 */
export const normalizeHeaders = (headers: string[]): string[] =>
  headers.map((h) =>
    h
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
  );

/**
 * Validates a MappingConfig object.
 */
export const validateMappingConfig = (
  config: unknown,
): Result<string, MappingConfig> => {
  if (!config || typeof config !== "object") {
    return { ok: false, error: "Config must be an object" };
  }
  const typed = config as Record<string, unknown>;
  if (typeof typed.version !== "number") {
    return { ok: false, error: "Config version must be a number" };
  }
  if (!Array.isArray(typed.fields)) {
    return { ok: false, error: "Config fields must be an array" };
  }

  const targets = new Set<CanonicalField>();

  for (let i = 0; i < typed.fields.length; i++) {
    const f = typed.fields[i];
    if (!f || typeof f !== "object") {
      return { ok: false, error: `Field at index ${i} must be an object` };
    }
    const fm = f as Record<string, unknown>;
    if (typeof fm.source !== "string" || fm.source.trim() === "") {
      return {
        ok: false,
        error: `Field at index ${i} has empty or non-string source`,
      };
    }
    const target = fm.target as CanonicalField;
    if (!VALID_CANONICAL_FIELDS.includes(target)) {
      return {
        ok: false,
        error: `Field at index ${i} has invalid target: ${target}`,
      };
    }
    if (typeof fm.required !== "boolean") {
      return {
        ok: false,
        error: `Field at index ${i} must have a boolean required field`,
      };
    }
    if (targets.has(target)) {
      return { ok: false, error: `Duplicate target field: ${target}` };
    }
    targets.add(target);
  }

  return { ok: true, value: config as MappingConfig };
};

/**
 * Deterministic ID generation for Transaction (pure)
 */
export const generateDeterministicId = (t: Omit<Transaction, "id">): string => {
  const str = `${
    t.date instanceof Date ? t.date.toISOString() : t.date
  }|${t.amount}|${t.currency.toUpperCase()}|${t.metadata?.source ?? ""}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + (hash << 6) + (hash << 16) - hash;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

/**
 * Maps and decodes a single parsed CSV row.
 */
export const mapAndDecodeRow = (
  row: Record<string, string>,
  config: MappingConfig,
  rowNumber: number,
  mode: "strict" | "lenient",
): Result<RowError[], Transaction> => {
  const errors: RowError[] = [];
  const sourceKeys = new Set(config.fields.map((f) => f.source));

  if (mode === "strict") {
    for (const key of Object.keys(row)) {
      if (!sourceKeys.has(key)) {
        errors.push({
          row: rowNumber,
          field: key as CanonicalField,
          code: "UNKNOWN_FIELD",
          input: key,
        });
      }
    }
  }

  let id: string | undefined;
  let date: Date | undefined;
  let amount: bigint | undefined;
  let currency: string | undefined;
  let actualIdrReceivedCents: bigint | null = null;
  let source: string | undefined;

  for (const field of config.fields) {
    const value = row[field.source];

    if (value === undefined || value === null || value === "") {
      if (field.required) {
        errors.push({
          row: rowNumber,
          field: field.target,
          code: "REQUIRED_MISSING",
          input: value ?? undefined,
        });
      }
    } else {
      const decodeResult = schema[field.target](value);
      if (decodeResult.ok) {
        if (field.target === "id") id = decodeResult.value as string;
        else if (field.target === "date") date = decodeResult.value as Date;
        else if (field.target === "amount") {
          amount = decodeResult.value as bigint;
        } else if (field.target === "currency") {
          currency = decodeResult.value as string;
        } else if (field.target === "actual_idr_received_cents") {
          actualIdrReceivedCents = decodeResult.value as bigint;
        } else if (field.target === "source") {
          source = decodeResult.value as string;
        }
      } else {
        errors.push({
          row: rowNumber,
          field: field.target,
          code: decodeResult.error as ErrorCode,
          input: value,
        });
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, error: errors };
  }

  if (date === undefined || amount === undefined || currency === undefined) {
    const missing: RowError[] = [];
    if (date === undefined) {
      missing.push({ row: rowNumber, field: "date", code: "REQUIRED_MISSING" });
    }
    if (amount === undefined) {
      missing.push({
        row: rowNumber,
        field: "amount",
        code: "REQUIRED_MISSING",
      });
    }
    if (currency === undefined) {
      missing.push({
        row: rowNumber,
        field: "currency",
        code: "REQUIRED_MISSING",
      });
    }
    return { ok: false, error: missing };
  }

  const txWithoutId = {
    date,
    amount,
    currency,
    actual_idr_received_cents: actualIdrReceivedCents,
    metadata: source ? { ...row, source } : { ...row },
  };

  return {
    ok: true,
    value: {
      id: id || generateDeterministicId(txWithoutId),
      ...txWithoutId,
    },
  };
};

/**
 * Helper to convert a string to a ReadableStream of Uint8Array for streaming compatibility.
 */
export const stringToStream = (csv: string): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(csv));
      controller.close();
    },
  });

/**
 * Pure generator to stream rows from a ReadableStream of bytes.
 */
export async function* parseCsvStreamToRows(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, string>, void, unknown> {
  const lineStream = stream
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new CsvParseStream());

  let headers: string[] = [];
  let isFirst = true;

  for await (const record of lineStream) {
    if (isFirst) {
      headers = normalizeHeaders(record);
      isFirst = false;
    } else {
      const row: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = record[i] ?? "";
      }
      yield row;
    }
  }
}

/**
 * Persistence layer interface.
 */
export interface PersistenceStore {
  save(row: Transaction): Promise<void>;
  exists(row: Transaction): Promise<boolean>;
  clear(): Promise<void>;
  getAll(): Promise<Transaction[]>;
}

/**
 * An in-memory implementation of the PersistenceStore.
 */
export class MemoryPersistenceStore implements PersistenceStore {
  private rows = new Map<string, Transaction>();

  async save(row: Transaction): Promise<void> {
    this.rows.set(row.id, row);
  }

  async exists(row: Transaction): Promise<boolean> {
    return this.rows.has(row.id);
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }

  async getAll(): Promise<Transaction[]> {
    return Array.from(this.rows.values());
  }
}

/**
 * Streaming CSV Ingestion Service.
 */
export const ingestCsvStream = async (
  stream: ReadableStream<Uint8Array>,
  config: MappingConfig,
  store: PersistenceStore,
  mode: "strict" | "lenient",
): Promise<IngestionReport> => {
  const configVal = validateMappingConfig(config);
  if (!configVal.ok) {
    throw new Error(`INVALID_CONFIG: ${configVal.error}`);
  }

  const report: IngestionReport = {
    total: 0,
    success: 0,
    failed: 0,
    errors: [],
  };

  const rowsGen = parseCsvStreamToRows(stream);
  let rowNum = 1;

  for await (const row of rowsGen) {
    report.total++;
    const decodeResult = mapAndDecodeRow(row, config, rowNum, mode);
    if (decodeResult.ok) {
      await store.save(decodeResult.value);
      report.success++;
    } else {
      report.errors.push(...decodeResult.error);
      report.failed++;
    }
    rowNum++;
  }

  return report;
};
