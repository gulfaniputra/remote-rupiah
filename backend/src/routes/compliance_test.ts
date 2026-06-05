import { assertEquals } from "@std/assert";
import app from "./compliance.ts";
import { sign } from "hono/jwt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = "test-jwt-secret-12345678901234567890";

async function makeToken(overrides = {}) {
  return await sign(
    {
      sub: "user-1",
      iss: "your-app",
      aud: "your-users",
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    },
    TEST_SECRET,
    "HS256",
  );
}

const makeUploadReq = (
  token: string,
  body: Record<string, unknown>,
) =>
  new Request("http://localhost/upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

const makeStatusReq = (token: string) =>
  new Request("http://localhost/status", {
    headers: { Authorization: `Bearer ${token}` },
  });

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

Deno.test("POST /compliance/upload — 401 without token", async () => {
  const res = await app.fetch(
    new Request("http://localhost/upload", { method: "POST" }),
  );
  assertEquals(res.status, 401);
});

Deno.test("GET /compliance/status — 401 without token", async () => {
  const res = await app.fetch(
    new Request("http://localhost/status", {}),
  );
  assertEquals(res.status, 401);
});

// ---------------------------------------------------------------------------
// MIME type validation
// ---------------------------------------------------------------------------

Deno.test("POST /compliance/upload — 400 on disallowed MIME type", async () => {
  const token = await makeToken();
  const res = await app.fetch(
    makeUploadReq(token, {
      documentType: "1042s",
      taxYear: 2025,
      storageKey: "key",
      mimeType: "application/x-msdownload",
      sizeBytes: 1024,
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(typeof body.error, "string");
});

// ---------------------------------------------------------------------------
// File size enforcement
// ---------------------------------------------------------------------------

Deno.test("POST /compliance/upload — 400 when sizeBytes > 10 MB", async () => {
  const token = await makeToken();
  const res = await app.fetch(
    makeUploadReq(token, {
      documentType: "w8ben",
      taxYear: 2025,
      storageKey: "key",
      mimeType: "application/pdf",
      sizeBytes: 10_485_761,
    }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(typeof body.error, "string");
});

// ---------------------------------------------------------------------------
// Happy path shape
// ---------------------------------------------------------------------------

Deno.test("POST /compliance/upload — 200 with valid payload", async () => {
  const token = await makeToken();
  const res = await app.fetch(
    makeUploadReq(token, {
      documentType: "1042s",
      taxYear: 2025,
      storageKey: "user-abc/1042s/2025/file.pdf",
      mimeType: "application/pdf",
      sizeBytes: 204800,
    }),
  );
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
});

Deno.test("GET /compliance/status — 200 with w8benStatus field", async () => {
  const res = await app.fetch(makeStatusReq(await makeToken()));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(typeof body.w8benStatus, "string");
});
