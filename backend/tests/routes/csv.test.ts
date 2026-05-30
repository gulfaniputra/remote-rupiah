import { assertEquals } from "@std/assert";
import { app } from "../../../main.ts";
import { testMocks } from "../../../db/client.ts";
import { sign } from "hono/jwt";

const secret = "test-jwt-secret-12345678901234567890";

async function makeToken(overrides = {}) {
  return await sign(
    {
      sub: "user-1",
      iss: "your-app",
      aud: "your-users",
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    },
    secret,
    "HS256",
  );
}

Deno.test("API - POST /api/csv/map success lifecycle", async () => {
  testMocks.clear();
  const token = await makeToken();
  const res = await app.request("/api/csv/map", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "Tx Date": "date",
      "Net Value": "amount",
      "Curr": "currency",
    }),
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
});

Deno.test("API - GET /api/csv/map returns stored mapping", async () => {
  testMocks.clear();
  const token = await makeToken();
  testMocks.csvMappingsByUser["user-1"] = {
    "Tx Date": "date",
    "Net Value": "amount",
    "Curr": "currency",
  };

  const res = await app.request("/api/csv/map", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.mapping, {
    "Tx Date": "date",
    "Net Value": "amount",
    "Curr": "currency",
  });
});

Deno.test("API - mappings are isolated per user", async () => {
  testMocks.clear();
  const userOneToken = await makeToken({ sub: "user-1" });
  const userTwoToken = await makeToken({ sub: "user-2" });

  await app.request("/api/csv/map", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userOneToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "Tx Date": "date",
      "Net Value": "amount",
      "Curr": "currency",
    }),
  });

  const response = await app.request("/api/csv/map", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${userTwoToken}`,
    },
  });

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body.mapping, null);
});

Deno.test("API - POST /api/csv/map invalid payload rejected", async () => {
  const token = await makeToken();
  const res = await app.request("/api/csv/map", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "Tx Date": "date",
      "Net Value": 123, // Invalid: should be a string ("amount")
      "Curr": "currency",
    }),
  });

  assertEquals(res.status, 400);
});

Deno.test("API - POST /api/csv/map missing fields rejected", async () => {
  const token = await makeToken();
  const res = await app.request("/api/csv/map", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "Tx Date": "date",
      "Curr": "currency",
      // Missing amount mapping
    }),
  });

  assertEquals(res.status, 400);
});
