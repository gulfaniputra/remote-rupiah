import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./transactions.ts";

const SECRET = "test-jwt-secret-12345678901234567890";

Deno.env.set("JWT_SECRET", SECRET);

const makeToken = async (userId: string) => {
  return await sign(
    {
      sub: userId,
      iss: "your-app",
      aud: "your-users",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET,
    "HS256"
  );
};

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
  assertEquals(body, { error: "Fail" });
});
