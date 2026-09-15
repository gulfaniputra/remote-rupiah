import { assertEquals, assertThrows } from "@std/assert";
import { mapMandiriRow } from "./mandiri_parser.ts";

Deno.test("mapMandiriRow maps standard format with Debet and Kredit columns", () => {
  const result = mapMandiriRow({
    Tanggal: "01/06/2026",
    Keterangan: "TRANSFER FROM CLIENT",
    Cabang: "JAKARTA",
    Debet: "",
    Kredit: "10000000",
    Saldo: "10000000",
  });

  assertEquals(result.external_id, "2026-06-01-TRANSFER FROM CLIENT-10000000");
  assertEquals(result.date, "2026-06-01");
  assertEquals(result.currency, "IDR");
  assertEquals(result.amount_cents, 1000000000n); // 10,000,000 IDR in cents
  assertEquals(result.actual_idr_received_cents, null);
  assertEquals(result.metadata.Keterangan, "TRANSFER FROM CLIENT");
});

Deno.test("mapMandiriRow handles Debet (outgoing) as negative amount", () => {
  const result = mapMandiriRow({
    Tanggal: "02/06/2026",
    Keterangan: "BI ADMIN",
    Cabang: "JAKARTA",
    Debet: "5000",
    Kredit: "",
    Saldo: "9995000",
  });

  assertEquals(result.date, "2026-06-02");
  assertEquals(result.amount_cents, -500000n); // -5,000 IDR in cents
  assertEquals(result.currency, "IDR");
});

Deno.test("mapMandiriRow handles Jumlah column as fallback", () => {
  const result = mapMandiriRow({
    Tanggal: "15/03/2026",
    Keterangan: "TRANSFER IN",
    Jumlah: "2500000",
    Saldo: "12500000",
  });

  assertEquals(result.date, "2026-03-15");
  assertEquals(result.amount_cents, 250000000n); // 2,500,000 IDR in cents
  assertEquals(result.currency, "IDR");
});

Deno.test("mapMandiriRow handles negative Jumlah (debit)", () => {
  const result = mapMandiriRow({
    Tanggal: "20/03/2026",
    Keterangan: "PAYMENT",
    Jumlah: "-75000",
    Saldo: "12425000",
  });

  assertEquals(result.date, "2026-03-20");
  assertEquals(result.amount_cents, -7500000n); // -75,000 IDR in cents
});

Deno.test("mapMandiriRow supports English column names as fallback", () => {
  const result = mapMandiriRow({
    Date: "2026-07-01",
    Description: "SALARY",
    Amount: "15000000",
  });

  assertEquals(result.date, "2026-07-01");
  assertEquals(result.amount_cents, 1500000000n);
  assertEquals(result.currency, "IDR");
});

Deno.test("mapMandiriRow rejects an invalid transaction date", () => {
  assertThrows(
    () =>
      mapMandiriRow({
        Tanggal: "not-a-date",
        Keterangan: "TEST",
        Debet: "",
        Kredit: "10000",
      }),
    Error,
    "Invalid Mandiri transaction date",
  );
});

Deno.test("mapMandiriRow rejects row with no amount columns", () => {
  assertThrows(
    () =>
      mapMandiriRow({
        Tanggal: "01/01/2026",
        Keterangan: "TEST",
      }),
    Error,
    "Cannot determine amount",
  );
});

Deno.test("mapMandiriRow uses Transaction ID when available", () => {
  const result = mapMandiriRow({
    Tanggal: "10/12/2026",
    Keterangan: "TRANSFER",
    "Transaction ID": "mandiri-txn-001",
    Kredit: "500000",
  });

  assertEquals(result.external_id, "mandiri-txn-001");
  assertEquals(result.amount_cents, 50000000n);
});

Deno.test("mapMandiriRow handles ISO date format fallback", () => {
  const result = mapMandiriRow({
    Tanggal: "2026-06-15",
    Keterangan: "SALARY",
    Kredit: "8000000",
  });

  assertEquals(result.date, "2026-06-15");
  assertEquals(result.amount_cents, 800000000n);
});
