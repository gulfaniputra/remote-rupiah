import { assert, assertEquals, assertExists } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./wealth.ts";

const SECRET = "test-jwt-secret-12345678901234567890";

const makeToken = async (userId: string) => {
  return await sign(
    {
      sub: userId,
      iss: "your-app",
      aud: "your-users",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET,
    "HS256",
  );
};

Deno.test("Wealth Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/convert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amountUsdCents: 100 }),
  });
  assertEquals(res.status, 401);
});

Deno.test("Wealth Route - POST /convert returns success when conversion records successfully (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/convert", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amountUsdCents: 50000 }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
});

Deno.test("api shape", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/unrealized", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const json = await res.json();

  assertExists(json.fx_rate);
  assertExists(json.total_unrealized_idr_cents);
  assert(Array.isArray(json.positions));
});
