import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./forecast.ts";

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

Deno.test("Forecast Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/");
  assertEquals(res.status, 401);
  const body = await res.json();
  assertEquals(body, { error: "Unauthorized" });
});

Deno.test("Forecast Route - GET /fx-efficiency returns empty data when DB returns empty list (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/fx-efficiency?year=2026", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { success: true, fxData: [] });
});
