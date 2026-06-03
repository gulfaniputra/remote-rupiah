import { assertEquals } from "@std/assert";
import { sign } from "hono/jwt";
import app from "./ingest.ts";
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

Deno.test("Ingest Route - Unauthorized when Authorization header is missing", async () => {
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "text/csv",
    },
    body:
      "Transfer ID,Created on,Source Currency,Amount Sent,Amount Received\n",
  });
  assertEquals(res.status, 401);
});

Deno.test("Ingest Route - POST / ingests Wise CSV rows", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/csv",
    },
    body:
      "Transfer ID,Created on,Source Currency,Amount Sent,Amount Received\n" +
      "tx-12345,2026-05-18T00:00:00Z,USD,1000.00,14000000.00\n",
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.ingested, 1);
  assertEquals(body.platform, "wise");
});

Deno.test("Ingest Route - POST / ingests PayPal CSV rows", async () => {
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/csv",
    },
    body:
      "Date,Currency,Amount,Transaction ID\n2026-05-18T00:00:00Z,USD,42.25,pp-123\n",
  });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.ingested, 1);
  assertEquals(body.platform, "paypal");
});

Deno.test("Ingest Route - unknown CSV without mapping returns 428", async () => {
  testMocks.clear();
  const token = await makeToken("test-user-id-123");
  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/csv",
    },
    body: "Posted At,Net Amount,Currency\n2026-05-18,42.25,USD\n",
  });

  assertEquals(res.status, 428);
  const body = await res.json();
  assertEquals(body.success, false);
  assertEquals(body.error, "CSV mapping required");
  assertEquals(body.headers, ["Posted At", "Net Amount", "Currency"]);
});

Deno.test("Ingest Route - unknown CSV with mapping returns 200", async () => {
  testMocks.clear();
  const token = await makeToken("test-user-id-123");
  testMocks.csvMappingsByUser["test-user-id-123"] = {
    "Posted At": "date",
    "Net Amount": "amount",
    Currency: "currency",
  };

  const res = await app.request("http://localhost/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/csv",
    },
    body: "Posted At,Net Amount,Currency\n2026-05-18,42.25,USD\n",
  });

  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.success, true);
  assertEquals(body.ingested, 1);
});
