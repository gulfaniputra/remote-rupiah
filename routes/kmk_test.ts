import { assertEquals } from "@std/assert";
import app from "./kmk.ts";

Deno.test("KMK Route - GET /latest returns 404 when rates are not synced/mocked", async () => {
  const res = await app.request("http://localhost/latest");
  // Under test, since database is fallback Proxy, lookup returns null and thus 404
  assertEquals(res.status, 404);
});

Deno.test("KMK Route - GET /lookup validation failure on invalid date format", async () => {
  const res = await app.request("http://localhost/lookup?date=2026/05/18");
  assertEquals(res.status, 400);
});

Deno.test("KMK Route - POST /sync unauthorized when x-api-key / Authorization is missing", async () => {
  const res = await app.request("http://localhost/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assertEquals(res.status, 401);
});
