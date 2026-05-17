import { assertEquals } from "@std/assert";
import {
  normalizeHeaders,
  validateMappingConfig,
  schema,
  mapAndDecodeRow,
  ingestCsvStream,
  stringToStream,
  MemoryPersistenceStore,
  MappingConfig,
} from "./pipeline.ts";

// 1. UNIT TESTS: normalizeHeaders
Deno.test("Unit - normalizeHeaders basic and edge cases", () => {
  assertEquals(
    normalizeHeaders([" First Name ", "Last-Name", "Email Address", "signupDate", "status!!"]),
    ["first_name", "last_name", "email_address", "signupdate", "status"]
  );
});

// 2. UNIT TESTS: Decoder per field
Deno.test("Unit - Email Decoder", () => {
  assertEquals(schema.email("user@example.com"), { ok: true, value: "user@example.com" });
  assertEquals(schema.email("invalid-email"), { ok: false, error: "INVALID_FORMAT" });
  assertEquals(schema.email(""), { ok: false, error: "INVALID_FORMAT" });
});

Deno.test("Unit - First/Last Name Decoder", () => {
  assertEquals(schema.firstName("John"), { ok: true, value: "John" });
  assertEquals(schema.firstName(""), { ok: false, error: "INVALID_FORMAT" });
  assertEquals(schema.firstName("   "), { ok: false, error: "INVALID_FORMAT" });

  assertEquals(schema.lastName("Doe"), { ok: true, value: "Doe" });
  assertEquals(schema.lastName(""), { ok: false, error: "INVALID_FORMAT" });
});

Deno.test("Unit - Signup Date Decoder", () => {
  assertEquals(
    (schema.signupDate("2026-05-17T14:30:00.000Z") as any).value?.toISOString(),
    "2026-05-17T14:30:00.000Z"
  );
  assertEquals(
    (schema.signupDate("2026-05-17") as any).value?.toISOString().startsWith("2026-05-17"),
    true
  );

  assertEquals(schema.signupDate("17-05-2026"), { ok: false, error: "INVALID_FORMAT" });
  assertEquals(schema.signupDate("2026/05/17"), { ok: false, error: "INVALID_FORMAT" });
  assertEquals(schema.signupDate("2026-02-31"), { ok: false, error: "TRANSFORM_FAILED" });
  assertEquals(schema.signupDate("2026-02-29"), { ok: false, error: "TRANSFORM_FAILED" });
});

Deno.test("Unit - Status Decoder", () => {
  assertEquals(schema.status("active"), { ok: true, value: "active" });
  assertEquals(schema.status("inactive"), { ok: true, value: "inactive" });
  assertEquals(schema.status("pending"), { ok: true, value: "pending" });
  assertEquals(schema.status("suspended"), { ok: false, error: "INVALID_FORMAT" });
  assertEquals(schema.status(""), { ok: false, error: "INVALID_FORMAT" });
});

// 3. UNIT TESTS: Mapping and Decode success, missing, invalid
const sampleConfig: MappingConfig = {
  version: 1,
  fields: [
    { source: "email", target: "email", required: true },
    { source: "first_name", target: "firstName", required: true },
    { source: "last_name", target: "lastName", required: false },
    { source: "signup_date", target: "signupDate", required: true },
    { source: "status", target: "status", required: false },
  ],
};

Deno.test("Unit - mapAndDecodeRow success", () => {
  assertEquals(
    mapAndDecodeRow(
      {
        email: "john.doe@example.com",
        first_name: "John",
        last_name: "Doe",
        signup_date: "2026-05-17T12:00:00Z",
        status: "active",
      },
      sampleConfig,
      1,
      "lenient"
    ),
    {
      ok: true,
      value: {
        email: "john.doe@example.com",
        firstName: "John",
        lastName: "Doe",
        signupDate: new Date("2026-05-17T12:00:00Z"),
        status: "active",
      },
    }
  );
});

Deno.test("Unit - mapAndDecodeRow required missing fails", () => {
  assertEquals(
    mapAndDecodeRow(
      {
        email: "",
        first_name: "John",
        signup_date: "2026-05-17T12:00:00Z",
      },
      sampleConfig,
      2,
      "lenient"
    ),
    {
      ok: false,
      error: [
        {
          row: 2,
          field: "email",
          code: "REQUIRED_MISSING",
          input: "",
        },
      ],
    }
  );
});

Deno.test("Unit - mapAndDecodeRow invalid format fails", () => {
  assertEquals(
    mapAndDecodeRow(
      {
        email: "john.doe.at.example.com",
        first_name: "John",
        signup_date: "2026-05-17T12:00:00Z",
      },
      sampleConfig,
      3,
      "lenient"
    ),
    {
      ok: false,
      error: [
        {
          row: 3,
          field: "email",
          code: "INVALID_FORMAT",
          input: "john.doe.at.example.com",
        },
      ],
    }
  );
});

Deno.test("Unit - mapAndDecodeRow strict mode unknown field fails", () => {
  assertEquals(
    mapAndDecodeRow(
      {
        email: "john.doe@example.com",
        first_name: "John",
        signup_date: "2026-05-17T12:00:00Z",
        extra_field_1: "value1",
      },
      sampleConfig,
      4,
      "strict"
    ),
    {
      ok: false,
      error: [
        {
          row: 4,
          field: "extra_field_1" as any,
          code: "UNKNOWN_FIELD",
          input: "extra_field_1",
        },
      ],
    }
  );
});

// 4. CONFIG TESTS: validateMappingConfig fails fast
Deno.test("Config - invalid MappingConfig validations", () => {
  assertEquals(validateMappingConfig(null).ok, false);
  assertEquals(validateMappingConfig({}).ok, false);
  assertEquals(validateMappingConfig({ version: 1 }).ok, false);

  assertEquals(
    validateMappingConfig({
      version: 1,
      fields: [
        { source: "email1", target: "email", required: true },
        { source: "email2", target: "email", required: false },
      ],
    }),
    { ok: false, error: "Duplicate target field: email" }
  );

  assertEquals(
    validateMappingConfig({
      version: 1,
      fields: [{ source: "", target: "email", required: true }],
    }),
    { ok: false, error: "Field at index 0 has empty or non-string source" }
  );

  assertEquals(
    validateMappingConfig({
      version: 1,
      fields: [{ source: "mail", target: "email_address" as any, required: true }],
    }),
    { ok: false, error: "Field at index 0 has invalid target: email_address" }
  );
});

// 5. GOLDEN & INTEGRATION TESTS: Snapshot style exact matches
Deno.test("Golden & Integration - CSV ingestion with report and persistence", async () => {
  const store = new MemoryPersistenceStore();
  const report = await ingestCsvStream(
    stringToStream(
      "email,first_name,last_name,signup_date,status\n" +
        "alice@example.com,Alice,Smith,2026-01-10T08:00:00Z,active\n" +
        "bob@example.com,Bob,,2026-02-20T09:00:00Z,inactive\n" +
        "charlie.example.com,Charlie,Brown,2026-03-30T10:00:00Z,pending\n" +
        "dan@example.com,Dan,Jones,2026-02-31T11:00:00Z,active\n"
    ),
    sampleConfig,
    store,
    "lenient"
  );

  assertEquals(report.total, 4);
  assertEquals(report.success, 2);
  assertEquals(report.failed, 2);
  assertEquals(report.success + report.failed, report.total);

  assertEquals(report.errors.length, 2);
  assertEquals(report.errors[0], {
    row: 3,
    field: "email",
    code: "INVALID_FORMAT",
    input: "charlie.example.com",
  });
  assertEquals(report.errors[1], {
    row: 4,
    field: "signupDate",
    code: "TRANSFORM_FAILED",
    input: "2026-02-31T11:00:00Z",
  });

  const saved = await store.getAll();
  assertEquals(saved.length, 2);
  assertEquals(saved[0].email, "alice@example.com");
  assertEquals(saved[0].firstName, "Alice");
  assertEquals(saved[0].lastName, "Smith");
  assertEquals(saved[0].signupDate instanceof Date, true);
  assertEquals(saved[0].status, "active");

  assertEquals(saved[1].email, "bob@example.com");
  assertEquals(saved[1].firstName, "Bob");
  assertEquals(saved[1].lastName, undefined);
  assertEquals(saved[1].signupDate instanceof Date, true);
  assertEquals(saved[1].status, "inactive");
});

// 6. INVARIANT TESTS: run(csv) === run(csv) (Idempotency)
Deno.test("Invariant - Idempotency and Determinism", async () => {
  const csv =
    "email,first_name,last_name,signup_date,status\n" +
    "elena@example.com,Elena,Rostova,2026-05-01T00:00:00Z,active\n";

  const config: MappingConfig = {
    version: 1,
    fields: [
      { source: "email", target: "email", required: true },
      { source: "first_name", target: "firstName", required: true },
      { source: "last_name", target: "lastName", required: true },
      { source: "signup_date", target: "signupDate", required: true },
      { source: "status", target: "status", required: true },
    ],
  };

  const store = new MemoryPersistenceStore();

  const report1 = await ingestCsvStream(stringToStream(csv), config, store, "lenient");
  const count1 = (await store.getAll()).length;

  const report2 = await ingestCsvStream(stringToStream(csv), config, store, "lenient");
  const count2 = (await store.getAll()).length;

  assertEquals(report1, report2);
  assertEquals(count1, 1);
  assertEquals(count2, 1);
});

// 7. PROPERTY TESTS: no undefined fields & output keys ⊆ CanonicalField
Deno.test("Property - Decoded rows have no undefined fields and keys are subset of CanonicalField", async () => {
  const store = new MemoryPersistenceStore();
  await ingestCsvStream(
    stringToStream(
      "email,first_name,signup_date\n" + "frank@example.com,Frank,2026-04-12T15:00:00Z\n"
    ),
    sampleConfig,
    store,
    "lenient"
  );

  const records = await store.getAll();
  const validCanonicalKeys = new Set(["email", "firstName", "lastName", "signupDate", "status"]);

  for (const record of records) {
    for (const key of Object.keys(record)) {
      assertEquals(validCanonicalKeys.has(key), true);
      assertEquals((record as any)[key] !== undefined, true);
    }
  }
});
