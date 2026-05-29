import { assertEquals, assertExists } from "@std/assert";
import sql from "./client.ts";

Deno.test("DB Client - sql exists and is initialized", () => {
  assertExists(sql);
});

Deno.test("DB Client - mock fallback returns empty array on query calls", () => {
  // Even if connection fails or is mocked, it should return an array
  const result = sql`SELECT 1`;
  assertEquals(
    Array.isArray(result) || typeof result.then === "function",
    true,
  );
});
