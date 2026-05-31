import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app, { serializeTx, txOutputSchema } from "./transactions.ts";

const SECRET = "test-jwt-secret-12345678901234567890";

const makeToken = async (userId: string) =>
  await sign(
    {
      sub: userId,
      iss: "your-app",
      aud: "your-users",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET,
    "HS256",
  );

// ──────────────────────────────────────────────────────
// Step 1 RED/GREEN: Serialization Boundary
// ──────────────────────────────────────────────────────

const validRow: Record<string, unknown> = {
  id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  user_id: "u-001",
  date: "2026-05-18",
  currency: "USD",
  amount_cents: "5420000",
  withholding_cents: "542000",
  actual_idr_received_cents: null,
  kmk_rate: "16120.00",
  is_1042s_verified: false,
  metadata: null,
};

Deno.test("serializeTx — BIGINT fields are strictly typed as JSON strings", () => {
  const out = serializeTx(validRow);
  assertEquals(typeof out.amount_cents, "string");
  assertEquals(typeof out.withholding_cents, "string");
  assertEquals(out.amount_cents, "5420000");
  assertEquals(out.withholding_cents, "542000");
});

Deno.test("serializeTx — user_id is stripped from output", () => {
  const out = serializeTx(validRow);
  assertEquals("user_id" in out, false);
});

Deno.test("serializeTx — Date objects are coerced to ISO-8601 string", () => {
  const row = { ...validRow, date: new Date("2026-05-18T00:00:00Z") };
  assertEquals(serializeTx(row).date, "2026-05-18");
});

Deno.test("txOutputSchema — rejects number for amount_cents (Zero-Float Protocol)", () => {
  const invalid = { ...validRow, amount_cents: 5420000 };
  const result = txOutputSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("txOutputSchema — rejects number for withholding_cents", () => {
  const invalid = { ...validRow, withholding_cents: 542000 };
  const result = txOutputSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

Deno.test("txOutputSchema — rejects float for amount_cents", () => {
  const invalid = { ...validRow, amount_cents: 1250.50 };
  const result = txOutputSchema.safeParse(invalid);
  assertEquals(result.success, false);
});

// ──────────────────────────────────────────────────────
// Existing Integration Tests
// ──────────────────────────────────────────────────────

Deno.test("Transactions Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/");
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body, { error: "Unauthorized" });
});

Deno.test("Transactions Route - GET / returns empty transactions list (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { success: true, transactions: [] });
});

Deno.test("Transactions Route - POST / returns 400 when body input is invalid", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date: "invalid-date",
    }),
  });
  assertEquals(res.status, 400);
});

Deno.test("Transactions Route - POST / returns 201 with undefined data (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      date: "2026-05-18",
      currency: "USD",
      amountCents: "100000",
      withholdingCents: "10000",
    }),
  });
  assertEquals(res.status, 201);
  const body = await res.json();
  assertEquals(body, { success: true });
});

Deno.test("Transactions Route - GET /:id returns 400 when ID is not a UUID", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/12345", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assertEquals(res.status, 400);
});

Deno.test("Transactions Route - GET /:id returns 404 when ID is a valid UUID but not found (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const uuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
  const res = await app.request(`http://localhost/${uuid}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body, { error: "Not found" });
});

Deno.test("Transactions Route - PATCH /:id/verify returns 400 when ID is invalid", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/12345/verify", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body, { error: "Invalid ID" });
});

Deno.test("Transactions Route - PATCH /:id/verify returns 404 when ID is valid but fail (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const uuid = "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d";
  const res = await app.request(`http://localhost/${uuid}/verify`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body, { error: "Not found" });
});
