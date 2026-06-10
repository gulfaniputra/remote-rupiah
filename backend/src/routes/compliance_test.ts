import { assertEquals } from "@std/assert";
import app from "./compliance.ts";
import { sign } from "hono/jwt";
import { testMocks } from "../../../db/client.ts";

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

const makeUploadReq = (token: string, body: Record<string, unknown>) =>
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

const makeNppnNotifyReq = (token: string, body?: Record<string, unknown>) =>
  new Request("http://localhost/nppn/notify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
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
  const res = await app.fetch(new Request("http://localhost/status", {}));
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

// ---------------------------------------------------------------------------
// NPPN Deadline Routes
// ---------------------------------------------------------------------------

Deno.test(
  "GET /compliance/status → response body contains nppnStatus with notified + daysRemaining",
  async () => {
    testMocks.clear();
    testMocks.taxProfiles.push(
      {
        user_id: "user-1",
        npwp: "",
        nik: "",
        address: "",
        klu_code: 62010,
      } as Parameters<typeof testMocks.taxProfiles.push>[0],
    );

    const res = await app.fetch(makeStatusReq(await makeToken()));
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(typeof body.nppnStatus, "object");
    assertEquals(typeof body.nppnStatus.notified, "boolean");
    assertEquals(typeof body.nppnStatus.daysRemaining, "number");
  },
);

Deno.test(
  "POST /compliance/nppn/notify with token → 200, nppnStatus.notified: true",
  async () => {
    testMocks.clear();
    testMocks.taxProfiles.push(
      {
        user_id: "user-1",
        npwp: "",
        nik: "",
        address: "",
        klu_code: 62010,
      } as Parameters<typeof testMocks.taxProfiles.push>[0],
    );

    const token = await makeToken();
    const res = await app.fetch(
      new Request("http://localhost/nppn/notify", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      }),
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.nppnStatus.notified, true);
    assertEquals(typeof body.w8benStatus, "string");
  },
);

Deno.test("POST /compliance/nppn/notify without token → 401", async () => {
  const res = await app.fetch(
    new Request("http://localhost/nppn/notify", { method: "POST" }),
  );
  assertEquals(res.status, 401);
});

// ---------------------------------------------------------------------------
// NPPN Notify — Zod validation (RED: these tests should fail initially)
// ---------------------------------------------------------------------------

Deno.test(
  "POST /compliance/nppn/notify — 400 when body contains invalid fields",
  async () => {
    const token = await makeToken();
    const res = await app.fetch(
      makeNppnNotifyReq(token, { invalidField: "should-not-be-here" }),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
  },
);

Deno.test(
  "POST /compliance/nppn/notify — 400 when body contains non-object value",
  async () => {
    const token = await makeToken();
    const res = await app.fetch(
      makeNppnNotifyReq(
        token,
        "not-an-object" as unknown as Record<string, unknown>,
      ),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assertEquals(body.success, false);
  },
);
