import { CsvParseStream } from "@std/csv";

/**
 * Deterministic CSV Ingestion Pipeline with a Field Mapping Layer.
 * Follows strict pure-functional core constraints and minimalist code style.
 */

export type CanonicalField =
  | "email"
  | "firstName"
  | "lastName"
  | "signupDate"
  | "status";

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

export interface CanonicalRow {
  email?: string;
  firstName?: string;
  lastName?: string;
  signupDate?: Date;
  status?: string;
}

export type Decoder<T> = (input: string) => Result<ErrorCode, T>;

export interface Schema {
  email: Decoder<string>;
  firstName: Decoder<string>;
  lastName: Decoder<string>;
  signupDate: Decoder<Date>;
  status: Decoder<string>;
}

const VALID_CANONICAL_FIELDS: CanonicalField[] = [
  "email",
  "firstName",
  "lastName",
  "signupDate",
  "status",
];

/**
 * Strict schema-on-read decoders (SSOT).
 * No implicit coercion, explicit failures only.
 */
export const schema: Schema = {
  email: (input: string): Result<ErrorCode, string> =>
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input)
      ? { ok: true, value: input }
      : { ok: false, error: "INVALID_FORMAT" },

  firstName: (input: string): Result<ErrorCode, string> =>
    input === "" || input.trim() === ""
      ? { ok: false, error: "INVALID_FORMAT" }
      : { ok: true, value: input },

  lastName: (input: string): Result<ErrorCode, string> =>
    input === "" || input.trim() === ""
      ? { ok: false, error: "INVALID_FORMAT" }
      : { ok: true, value: input },

  signupDate: (input: string): Result<ErrorCode, Date> => {
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:?\d{2})?)?$/.test(input)) {
      return { ok: false, error: "INVALID_FORMAT" };
    }
    const date = new Date(input);
    if (isNaN(date.getTime())) {
      return { ok: false, error: "TRANSFORM_FAILED" };
    }
    // Prevent JavaScript Date silent coercion of out-of-range calendar dates (e.g. Feb 31)
    const [y, m, d] = input.split("T")[0].split("-").map((s) => parseInt(s, 10));
    const utcDate = new Date(Date.UTC(y, m - 1, d));
    return utcDate.getUTCFullYear() === y &&
      utcDate.getUTCMonth() === m - 1 &&
      utcDate.getUTCDate() === d
      ? { ok: true, value: date }
      : { ok: false, error: "TRANSFORM_FAILED" };
  },

  status: (input: string): Result<ErrorCode, string> =>
    ["active", "inactive", "pending"].includes(input)
      ? { ok: true, value: input }
      : { ok: false, error: "INVALID_FORMAT" },
};

/**
 * Normalizes CSV headers.
 * Converts to lowercase, trims whitespace, and replaces spaces/dashes with underscores.
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
 * Enforces non-empty source, valid CanonicalField target, and unique target mapping.
 */
export const validateMappingConfig = (
  config: unknown
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
      return { ok: false, error: `Field at index ${i} has empty or non-string source` };
    }
    const target = fm.target as CanonicalField;
    if (!VALID_CANONICAL_FIELDS.includes(target)) {
      return { ok: false, error: `Field at index ${i} has invalid target: ${target}` };
    }
    if (typeof fm.required !== "boolean") {
      return { ok: false, error: `Field at index ${i} must have a boolean required field` };
    }
    if (targets.has(target)) {
      return { ok: false, error: `Duplicate target field: ${target}` };
    }
    targets.add(target);
  }

  return { ok: true, value: config as MappingConfig };
};

/**
 * Maps and decodes a single parsed CSV row.
 * Pure functional core logic with zero side-effects.
 */
export const mapAndDecodeRow = (
  row: Record<string, string>,
  config: MappingConfig,
  rowNumber: number,
  mode: "strict" | "lenient"
): Result<RowError[], CanonicalRow> => {
  const errors: RowError[] = [];
  const sourceKeys = new Set(config.fields.map((f) => f.source));

  // In strict mode, verify if there are any unknown fields in the CSV row
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

  const decoded: CanonicalRow = {};

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
        decoded[field.target] = decodeResult.value as any;
      } else {
        errors.push({
          row: rowNumber,
          field: field.target,
          code: decodeResult.error,
          input: value,
        });
      }
    }
  }

  return errors.length > 0
    ? { ok: false, error: errors }
    : { ok: true, value: decoded };
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
 * Ensures the memory footprint remains small during execution.
 */
export async function* parseCsvStreamToRows(
  stream: ReadableStream<Uint8Array>
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
 * Persistence layer interface with hash-based and/or unique field idempotency.
 */
export interface PersistenceStore {
  save(row: CanonicalRow): Promise<void>;
  exists(row: CanonicalRow): Promise<boolean>;
  clear(): Promise<void>;
  getAll(): Promise<CanonicalRow[]>;
}

/**
 * An in-memory implementation of the PersistenceStore.
 * Guarantees idempotency by using a unique deterministic hash or unique field.
 */
export class MemoryPersistenceStore implements PersistenceStore {
  private rows = new Map<string, CanonicalRow>();

  private hashRow(row: CanonicalRow): string {
    return row.email
      ? `email:${row.email.trim().toLowerCase()}`
      : [
          row.firstName ?? "",
          row.lastName ?? "",
          row.signupDate?.toISOString() ?? "",
          row.status ?? "",
        ].join("|");
  }

  async save(row: CanonicalRow): Promise<void> {
    const key = this.hashRow(row);
    this.rows.set(key, row);
  }

  async exists(row: CanonicalRow): Promise<boolean> {
    return this.rows.has(this.hashRow(row));
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }

  async getAll(): Promise<CanonicalRow[]> {
    return Array.from(this.rows.values());
  }
}

/**
 * Streaming CSV Ingestion Service.
 * Evaluates records row-by-row and persists only completely valid rows.
 */
export const ingestCsvStream = async (
  stream: ReadableStream<Uint8Array>,
  config: MappingConfig,
  store: PersistenceStore,
  mode: "strict" | "lenient"
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

