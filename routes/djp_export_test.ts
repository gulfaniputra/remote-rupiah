import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./export_djp.ts";
import { testMocks } from "../db/client.ts";

const SECRET = "test-jwt-secret-12345678901234567890";

const makeToken = async (userId: string) => {
  return await sign(
    {
      sub: userId,
      iss: "your-app",
      aud: "your-users",
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET,
    "HS256",
  );
};

Deno.test("DJP Export Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ year: 2026 }),
  });
  assertEquals(res.status, 401);
});

Deno.test("DJP Export Route - POST / returns 400 when body input is invalid", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      year: "invalid-year",
    }),
  });
  assertEquals(res.status, 400);
});

Deno.test("DJP Export Route - POST / returns 404 when no profile exists", async () => {
  testMocks.clear();
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ year: 2026 }),
  });
  assertEquals(res.status, 404);
  const body = await res.json();
  assertEquals(body.error, "Tax profile not found");
});

Deno.test("DJP Export Route - POST / returns correct Coretax CSV format and data", async () => {
  testMocks.clear();
  const token = await makeToken("test-user-id-123");

  // Setup tax profile mock
  testMocks.taxProfiles.push({
    user_id: "test-user-id-123",
    npwp: "123456789012345",
    nik: "1234567890123456",
    address: "123 Sudirman, Jakarta",
    klu_code: 62010,
  });

  // Setup transactions
  // Verified transaction: 1000.00 USD, 100.00 USD withholding, KMK rate 16120.00
  testMocks.transactions.push({
    user_id: "test-user-id-123",
    date: "2026-05-18",
    amount_cents: "100000",
    withholding_cents: "10000",
    kmk_rate: "16120.00",
    is_1042s_verified: true,
  });

  // Unverified transaction: PPh 24 Credit must be 0
  testMocks.transactions.push({
    user_id: "test-user-id-123",
    date: "2026-05-19",
    amount_cents: "200000",
    withholding_cents: "20000",
    kmk_rate: "16120.00",
    is_1042s_verified: false,
  });

  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ year: 2026 }),
  });

  assertEquals(res.status, 200);
  assertEquals(res.headers.get("Content-Type"), "text/csv");

  const csvText = await res.text();
  const lines = csvText.trim().split("\n");

  // Check header
  assertEquals(
    lines[0],
    "NPWP,NIK,KLU,Tanggal,Bruto_Valas,Kurs_KMK,Bruto_IDR,Netto_IDR,PPh_24_Kredit_IDR",
  );

  // Check verified row
  assertEquals(
    lines[1],
    "123456789012345,1234567890123456,62010,2026-05-18,1000.00,16120.00,16120000,8060000,1612000",
  );

  // Check unverified row (PPh 24 Credit is 0)
  assertEquals(
    lines[2],
    "123456789012345,1234567890123456,62010,2026-05-19,2000.00,16120.00,32240000,16120000,0",
  );
});
