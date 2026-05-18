import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./export.ts";

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

Deno.test("Export Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/spt1770", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ year: "2026" }),
  });
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body, { error: "Authorization required" });
});

Deno.test("Export Route - POST /spt1770 returns 400 when body input is invalid", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/spt1770", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      year: "not-a-year",
    }),
  });
  assertEquals(res.status, 400);
});

Deno.test("Export Route - POST /spt1770 returns 404 Empty when database returns no transactions (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/spt1770", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      year: "2026",
    }),
  });
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body, { error: "Empty" });
});
