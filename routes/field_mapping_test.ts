import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./field_mapping.ts";

const SECRET = "test-jwt-secret-12345678901234567890";

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

Deno.test("Field Mapping Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/suggest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sourceFields: ["email"], targetFields: ["email"] }),
  });
  assertEquals(res.status, 401);
});

Deno.test("Field Mapping Route - POST /suggest returns suggestions with correct structures", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/suggest", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sourceFields: ["email", "signUpDate"],
      targetFields: ["email", "signup_date"],
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.length, 2);
  assertEquals(body[0].source, "email");
  assertEquals(body[1].source, "signUpDate");
});

Deno.test("Field Mapping Route - POST /confirm returns 400 when body input is invalid", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/confirm", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mappings: [],
    }),
  });
  assertEquals(res.status, 400);
});

Deno.test("Field Mapping Route - POST /confirm returns success when mappings are valid (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/confirm", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mappings: [
        {
          source: "email",
          target: "email",
          confidence: 1.0,
          userVerified: true,
        },
      ],
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { success: true });
});
