import { assertEquals } from "@std/assert";
import { app } from "../main.ts";
import { sign } from "hono/jwt";
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

// Unauthorized when Authorization header is missing.
Deno.test(
  "Forecast Route - Unauthorized when Authorization header is missing",
  async () => {
    testMocks.clear(); // Start fresh

    const res = await app.request("http://localhost/api/forecast");
    assertEquals(res.status, 401);
    const body = await res.json();
    assertEquals(body, { error: "Unauthorized" });
  },
);

// `GET /fx-efficiency` returns empty data when db empty.
Deno.test(
  "Forecast Route - GET /fx-efficiency returns empty data when DB returns empty list (mocked database)",
  async () => {
    testMocks.clear();

    const token = await makeToken("test-user-id-123");
    const res = await app.request(
      "http://localhost/api/forecast/fx-efficiency?year=2026",
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body, { success: true, fxData: [] });
  },
);

// Integer math. No floating-point rounding errors.
Deno.test(
  "GET /forecast/fx-efficiency uses integer math, no float rounding",
  async () => {
    testMocks.clear();

    const token = await makeToken("test-user");

    // Seed a transaction with a rate that has a fractional cent.
    testMocks.transactions.push({
      user_id: "test-user",
      date: "2026-01-15",
      amount_cents: "1000",
      withholding_cents: "0",
      kmk_rate: "16120.50",
      is_1042s_verified: true,
      actual_idr_received_cents: "16120500",
    });

    const res = await app.request("/api/forecast/fx-efficiency?year=2026", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const first = json.fxData[0];

    // amount_idr_cents = 1000 * (16120.50 * 100) / 100
    //                   = 1000 * 1,612,050 / 100 = 16,120,500
    assertEquals(first.amount_idr_cents, "16120500");

    // spread_cents = amount_idr_cents - actual_idr_received_cents = 0
    assertEquals(first.spread_cents, "0");
  },
);
