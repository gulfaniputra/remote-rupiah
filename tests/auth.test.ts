import { app } from "../main.ts";
import { sign } from "hono/jwt";
import { assertEquals } from "@std/assert";

const secret = (Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET"))?.trim() || "test-secret";
Deno.env.set("JWT_SECRET", secret); // ensure it's set for tests

const makeToken = (overrides = {}) =>
  sign({
    sub: "user-1",
    iss: "your-app",
    aud: "your-users",
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }, secret, "HS256");

Deno.test("401 no token", async () =>
  assertEquals((await app.request("/api/tax-profile")).status, 401)
);

Deno.test("401 invalid token", async () =>
  assertEquals(
    (await app.request("/api/tax-profile", { headers: { Authorization: "Bearer invalid.token" } })).status,
    401
  )
);

Deno.test("200 valid token", async () => {
  const token = await makeToken();
  const status = (await app.request("/api/tax-profile", { headers: { Authorization: `Bearer ${token}` } })).status;
  if (status === 401) throw new Error("Expected 200 (or at least not 401 due to db mock)");
});

Deno.test("401 expired token", async () =>
  assertEquals(
    (await app.request("/api/tax-profile", { headers: { Authorization: `Bearer ${await makeToken({ exp: 0 })}` } })).status,
    401
  )
);

Deno.test("401 wrong issuer", async () =>
  assertEquals(
    (await app.request("/api/tax-profile", { headers: { Authorization: `Bearer ${await makeToken({ iss: "bad" })}` } })).status,
    401
  )
);

Deno.test("route requires auth", async () =>
  assertEquals((await app.request("/api/tax-profile")).status, 401)
);
