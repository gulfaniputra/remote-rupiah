import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./ingest.ts";

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

Deno.test("Ingest Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ rows: [] }),
  });
  assertEquals(res.status, 401);
});

Deno.test("Ingest Route - POST / returns success and ingests valid rows (mocked database)", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      rows: [
        {
          date: "2026-05-18",
          currency: "USD",
          amountStr: "$1,234.56",
          source_tx_id: "tx-12345",
        },
      ],
    }),
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body, { success: true, ingested: 1 });
});
