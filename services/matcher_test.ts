import { assertEquals } from "jsr:@std/assert@1";
import { match } from "./matcher.ts";

Deno.test("Matcher - exact match", () => {
  const source = "email";
  const targets = ["email", "name", "date"];
  const result = match(source, targets);
  assertEquals(result.method, "exact");
  assertEquals(result.target, "email");
  assertEquals(result.confidence, 1.0);
});

Deno.test("Matcher - normalized match", () => {
  const source = "First Name";
  const targets = ["first_name", "last_name"];
  const result = match(source, targets);
  assertEquals(result.method, "normalized");
  assertEquals(result.target, "first_name");
  assertEquals(result.confidence, 1.0);
});

Deno.test("Matcher - fuzzy match", () => {
  const source = "phonenumber";
  const targets = ["phone_number", "email"];
  const result = match(source, targets);
  assertEquals(result.method, "fuzzy");
  assertEquals(result.target, "phone_number");
  // Confidence should be high but < 1.0
  assertEquals(result.confidence > 0.85, true);
});

Deno.test("Matcher - no match (low confidence)", () => {
  const source = "something_random";
  const targets = ["email", "first_name"];
  const result = match(source, targets);
  assertEquals(result.method, "none");
  assertEquals(result.target, null);
});

Deno.test("Matcher - ambiguity case", () => {
  // If scores are too close (diff < 0.1), return none
  const source = "test";
  const targets = ["test1", "test2"];
  // Assume these will have very close fuzzy scores if not exact/normalized
  const result = match(source, targets);
  assertEquals(result.method, "none");
  assertEquals(result.target, null);
});

Deno.test("Matcher - empty input", () => {
  const source = "";
  const targets: string[] = ["email"];
  const result = match(source, targets);
  assertEquals(result.method, "none");
  assertEquals(result.target, null);
});

Deno.test("Matcher - duplicate targets", () => {
  // Should handle duplicates gracefully, though targets should ideally be unique
  const source = "email";
  const targets = ["email", "email"];
  const result = match(source, targets);
  assertEquals(result.method, "exact");
  assertEquals(result.target, "email");
});
