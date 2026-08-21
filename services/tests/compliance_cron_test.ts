import { assertEquals } from "@std/assert";
import { scanExpiredW8BEN, scanNppnDeadline, type W8BENScanResult } from "../compliance_cron.ts";
import { testMocks } from "../../db/client.ts";

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

const seedProfile = (userId: string, expiryDate: string | null) => {
  testMocks.taxProfiles.push(
    {
      user_id: userId,
      npwp: "",
      nik: "",
      address: "",
      klu_code: 62010,
      ...(expiryDate ? { w8ben_expiry_date: expiryDate } : {}),
    } as Parameters<typeof testMocks.taxProfiles.push>[0],
  );
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

Deno.test("scanExpiredW8BEN: empty DB returns empty result", async () => {
  testMocks.clear();
  const result: W8BENScanResult = await scanExpiredW8BEN();
  assertEquals(result.expired, []);
  assertEquals(result.expiringSoon, []);
});

Deno.test("scanExpiredW8BEN: past expiry date flags as expired", async () => {
  testMocks.clear();
  seedProfile("user-old", "2023-01-01");
  const result = await scanExpiredW8BEN();
  assertEquals(result.expired.includes("user-old"), true);
});

Deno.test(
  "scanExpiredW8BEN: future expiry beyond 30d is not flagged",
  async () => {
    testMocks.clear();
    seedProfile("user-fresh", "2099-12-31");
    const result = await scanExpiredW8BEN();
    assertEquals(result.expired.includes("user-fresh"), false);
    assertEquals(result.expiringSoon.includes("user-fresh"), false);
  },
);

Deno.test(
  "scanExpiredW8BEN: expiry within 30 days flags expiringSoon",
  async () => {
    testMocks.clear();
    // 15 days from now
    const soon = new Date(Date.now() + 15 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    seedProfile("user-soon", soon);
    const result = await scanExpiredW8BEN();
    assertEquals(result.expiringSoon.includes("user-soon"), true);
  },
);

Deno.test("scanExpiredW8BEN: null expiry is not in either list", async () => {
  testMocks.clear();
  seedProfile("user-null", null);
  const result = await scanExpiredW8BEN();
  assertEquals(result.expired.includes("user-null"), false);
  assertEquals(result.expiringSoon.includes("user-null"), false);
});

// ---------------------------------------------------------------------------
// NPPN Deadline Scan
// ---------------------------------------------------------------------------

Deno.test(
  "scanNppnDeadline: nppn_notified_at IS NULL + month >= March → missing array contains userId",
  async () => {
    testMocks.clear();
    testMocks.taxProfiles.push(
      {
        user_id: "user-unnotified",
        npwp: "",
        nik: "",
        address: "",
        klu_code: 62010,
      } as Parameters<typeof testMocks.taxProfiles.push>[0],
    );

    const result = await scanNppnDeadline();
    assertEquals(result.missing.includes("user-unnotified"), true);
  },
);

Deno.test(
  "scanNppnDeadline: All profiles have nppn_notified_at → missing empty",
  async () => {
    testMocks.clear();
    testMocks.taxProfiles.push(
      {
        user_id: "user-notified-1",
        npwp: "",
        nik: "",
        address: "",
        klu_code: 62010,
        nppn_notified_at: "2026-03-15T10:00:00Z",
      } as Parameters<typeof testMocks.taxProfiles.push>[0],
    );
    testMocks.taxProfiles.push(
      {
        user_id: "user-notified-2",
        npwp: "",
        nik: "",
        address: "",
        klu_code: 62010,
        nppn_notified_at: "2026-03-20T10:00:00Z",
      } as Parameters<typeof testMocks.taxProfiles.push>[0],
    );

    const result = await scanNppnDeadline();
    assertEquals(result.missing, []);
  },
);
