import { assertEquals, assertRejects } from "@std/assert";
import { Hono } from "hono";
import { sign } from "hono/jwt";
import { authMiddleware, generateDevToken, getJwtSecret } from "./auth_middleware.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = "test-jwt-secret-12345678901234567890";

const makeToken = (overrides = {}) =>
  sign(
    {
      sub: "user-1",
      iss: "your-app",
      aud: "your-users",
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...overrides,
    },
    TEST_SECRET,
    "HS256",
  );

// ---------------------------------------------------------------------------
// getJwtSecret
// ---------------------------------------------------------------------------

Deno.test("getJwtSecret returns a non-empty string in test mode", () => {
  const secret = getJwtSecret();
  assertEquals(typeof secret, "string");
  assertEquals(secret!.length > 0, true);
});

// ---------------------------------------------------------------------------
// generateDevToken
// ---------------------------------------------------------------------------

Deno.test("generateDevToken returns a valid JWT string", async () => {
  const token = await generateDevToken("test-user");
  assertEquals(typeof token, "string");
  assertEquals(token.split(".").length, 3);
});

Deno.test("generateDevToken rejects empty userId", async () => {
  await assertRejects(
    () => generateDevToken(""),
    Error,
    "userId must be non-empty",
  );
});

// ---------------------------------------------------------------------------
// authMiddleware — via Hono app.request integration
// ---------------------------------------------------------------------------

const createTestApp = () => {
  const app = new Hono();
  app.use("*", authMiddleware);
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
};

Deno.test("authMiddleware — 401 without Authorization header", async () => {
  const app = createTestApp();
  const res = await app.request("/test");
  assertEquals(res.status, 401);
});

Deno.test("authMiddleware — 401 with malformed Authorization header", async () => {
  const app = createTestApp();
  const res = await app.request("/test", {
    headers: { Authorization: "NotBearer token" },
  });
  assertEquals(res.status, 401);
});

Deno.test("authMiddleware — 401 with empty token", async () => {
  const app = createTestApp();
  const res = await app.request("/test", {
    headers: { Authorization: "Bearer " },
  });
  assertEquals(res.status, 401);
});

Deno.test("authMiddleware — 401 with expired token", async () => {
  const app = createTestApp();
  const token = await makeToken({ exp: 0 });
  const res = await app.request("/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(res.status, 401);
});

Deno.test("authMiddleware — 401 with wrong issuer", async () => {
  const app = createTestApp();
  const token = await makeToken({ iss: "evil-app" });
  const res = await app.request("/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(res.status, 401);
});

Deno.test("authMiddleware — 401 with wrong audience", async () => {
  const app = createTestApp();
  const token = await makeToken({ aud: "evil-users" });
  const res = await app.request("/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(res.status, 401);
});

Deno.test("authMiddleware — 401 with garbage token", async () => {
  const app = createTestApp();
  const res = await app.request("/test", {
    headers: { Authorization: "Bearer this.is.garbage" },
  });
  assertEquals(res.status, 401);
});

Deno.test("authMiddleware — 200 with valid token", async () => {
  const app = createTestApp();
  const token = await makeToken();
  const res = await app.request("/test", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.ok, true);
});

Deno.test("authMiddleware — sets c.get('userId') to the token sub", async () => {
  const app = new Hono();
  app.use("*", authMiddleware);
  app.get(
    "/me",
    (c) =>
      c.json({
        userId: (c.get as (key: string) => unknown)("userId") as string,
      }),
  );
  const token = await makeToken({ sub: "specific-user" });
  const res = await app.request("/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.userId, "specific-user");
});
