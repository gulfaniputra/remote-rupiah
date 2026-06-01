import { assertRejects } from "@std/assert";
import { recordConversion } from "./fifo_manager.ts";

Deno.test("recordConversion only spends lots for the requested source", async () => {
  await recordConversion("test-user-id-123", "wise", 500000n);
});

Deno.test("recordConversion fails when the requested source has insufficient funds", async () => {
  await assertRejects(
    () => recordConversion("test-user-id-123", "bank", 300000n),
    Error,
    "Insufficient unspent USD",
  );
});
