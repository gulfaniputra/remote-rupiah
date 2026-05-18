import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./tax_profile.ts";

const SECRET = "test-jwt-secret-12345678901234567890";

// Ensure a consistent secret is in Deno.env for testing
Deno.env.set("JWT_SECRET", SECRET);

const makeToken = async (userId: string) => {
  return await sign(
    {
      sub: userId,
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET,
    "HS256"
  );
};

Deno.test("Tax Profile Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/");
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body, { error: "Authorization required" });
});

Deno.test("Tax Profile Route - Unauthorized when token is invalid", async () => {
  const res = await app.request("http://localhost/", {
    headers: {
      Authorization: "Bearer invalid-token-string",
    },
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body, { error: "Invalid token" });
});

Deno.test("Tax Profile Route - GET / returns success with null (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { success: true, data: null });
});

Deno.test("Tax Profile Route - POST / returns 400 when body input is invalid", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // npwp missing, nik missing, address missing
      kluCode: "not-a-number",
    }),
  });
  assertEquals(res.status, 400);
});

Deno.test("Tax Profile Route - POST / returns success with undefined data (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      npwp: "12.345.678.9-012.000",
      nik: "1234567890123456",
      address: "123 Sudirman, Jakarta",
      kluCode: 62010,
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  // Since db mock returns [], res[0] is undefined, so the route returns { success: true, data: undefined }
  assertEquals(body, { success: true });
});
