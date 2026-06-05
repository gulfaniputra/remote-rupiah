import { assertEquals, assertRejects } from "@std/assert";
import {
  type ComplianceDocument,
  type ComplianceStatus,
  getComplianceStatus,
  upsertDocument,
} from "../compliance.ts";
import { testMocks } from "../../db/client.ts";

// ---------------------------------------------------------------------------
// Schema integrity
// ---------------------------------------------------------------------------

Deno.test("ComplianceDocument contract: required fields typed correctly", () => {
  const doc: ComplianceDocument = {
    userId: "user-abc",
    documentType: "1042s",
    taxYear: 2025,
    storageKey: "user-abc/1042s/2025/file.pdf",
    mimeType: "application/pdf",
    sizeBytes: 102400n,
  };

  assertEquals(doc.documentType, "1042s");
  assertEquals(typeof doc.storageKey, "string");
  assertEquals(typeof doc.sizeBytes, "bigint");
});

// ---------------------------------------------------------------------------
// MIME type validation
// ---------------------------------------------------------------------------

Deno.test("upsertDocument rejects disallowed MIME type", async () => {
  testMocks.clear();
  await assertRejects(
    () =>
      upsertDocument("user-abc", {
        documentType: "1042s",
        taxYear: 2025,
        storageKey: "key",
        mimeType: "application/x-msdownload",
        sizeBytes: 1024n,
      }),
    Error,
    "Invalid MIME type",
  );
});

// ---------------------------------------------------------------------------
// File size enforcement (max 10 MB = 10_485_760 bytes)
// ---------------------------------------------------------------------------

Deno.test("upsertDocument rejects files exceeding 10 MB", async () => {
  testMocks.clear();
  await assertRejects(
    () =>
      upsertDocument("user-abc", {
        documentType: "w8ben",
        taxYear: 2025,
        storageKey: "key",
        mimeType: "application/pdf",
        sizeBytes: 10_485_761n,
      }),
    Error,
    "File exceeds maximum size",
  );
});

// ---------------------------------------------------------------------------
// Auth / RLS — unauthenticated call must throw
// ---------------------------------------------------------------------------

Deno.test("upsertDocument throws on missing userId", async () => {
  testMocks.clear();
  await assertRejects(
    () =>
      upsertDocument("", {
        documentType: "1042s",
        taxYear: 2025,
        storageKey: "key",
        mimeType: "application/pdf",
        sizeBytes: 4096n,
      }),
    Error,
    "Authentication required",
  );
});

// ---------------------------------------------------------------------------
// Compliance status derivation
// ---------------------------------------------------------------------------

Deno.test("getComplianceStatus returns Expired for past w8ben_expiry_date", async () => {
  testMocks.clear();
  // Seed mock: profile with expired W-8BEN
  testMocks.taxProfiles.push(
    {
      user_id: "user-expired",
      npwp: "123",
      nik: "456",
      address: "Jl. Test",
      klu_code: 62010,
      w8ben_expiry_date: "2023-12-31",
    } as Parameters<typeof testMocks.taxProfiles.push>[0],
  );

  const status: ComplianceStatus = await getComplianceStatus("user-expired");
  assertEquals(status.w8benStatus, "Expired");
});

Deno.test("getComplianceStatus returns Valid for future w8ben_expiry_date", async () => {
  testMocks.clear();
  testMocks.taxProfiles.push(
    {
      user_id: "user-valid",
      npwp: "123",
      nik: "456",
      address: "Jl. Test",
      klu_code: 62010,
      w8ben_expiry_date: "2099-12-31",
    } as Parameters<typeof testMocks.taxProfiles.push>[0],
  );

  const status: ComplianceStatus = await getComplianceStatus("user-valid");
  assertEquals(status.w8benStatus, "Valid");
});

Deno.test("getComplianceStatus returns Missing when no expiry on record", async () => {
  testMocks.clear();
  testMocks.taxProfiles.push(
    {
      user_id: "user-missing",
      npwp: "",
      nik: "",
      address: "",
      klu_code: 62010,
    } as Parameters<typeof testMocks.taxProfiles.push>[0],
  );

  const status: ComplianceStatus = await getComplianceStatus("user-missing");
  assertEquals(status.w8benStatus, "Missing");
});
