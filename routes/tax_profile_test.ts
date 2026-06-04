import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./tax_profile.ts";

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

Deno.test("Tax Profile Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/");
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body, { error: "Unauthorized" });
});

Deno.test("Tax Profile Route - Unauthorized when token is invalid", async () => {
  const res = await app.request("http://localhost/", {
    headers: {
      Authorization: "Bearer invalid-token-string",
    },
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body, { error: "Unauthorized" });
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
      kluCode: "not-a-number",
    }),
  });
  assertEquals(res.status, 400);
});

Deno.test("Tax Profile Route - POST / validates 15-digit and 16-digit NPWP & 16-digit NIK", async () => {
  const token = await makeToken("test-user-id-123");

  // Valid 15-digit NPWP with dashes/dots, valid 16-digit NIK
  const res1 = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      npwp: "12.345.678.9-012.000", // 15 digits when stripped
      nik: "1234567890123456", // 16 digits
      address: "123 Sudirman, Jakarta",
      kluCode: "62010",
    }),
  });
  assertEquals(res1.status, 200);

  // Invalid NIK (15 digits)
  const res2 = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      npwp: "12.345.678.9-012.000",
      nik: "123456789012345", // invalid 15 digits
      address: "123 Sudirman, Jakarta",
      kluCode: "62010",
    }),
  });
  assertEquals(res2.status, 400);

  // Invalid NPWP (14 digits)
  const res3 = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      npwp: "12.345.678.9-012.00", // 14 digits
      nik: "1234567890123456",
      address: "123 Sudirman, Jakarta",
      kluCode: "62010",
    }),
  });
  assertEquals(res3.status, 400);
});
