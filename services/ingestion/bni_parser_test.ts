import { assertEquals, assertThrows } from "@std/assert";
import { mapBniRow } from "./bni_parser.ts";

Deno.test("mapBniRow maps standard format with Debit and Kredit columns", () => {
  const result = mapBniRow({
    Tanggal: "01/06/2026",
    Keterangan: "TRANSFER FROM CLIENT",
    Cabang: "JAKARTA",
    Debit: "",
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

Deno.test("mapBniRow handles Debit (outgoing) as negative amount", () => {
  const result = mapBniRow({
    Tanggal: "02/06/2026",
    Keterangan: "BI ADMIN",
    Cabang: "JAKARTA",
    Debit: "5000",
    Kredit: "",
    Saldo: "9995000",
  });

  assertEquals(result.date, "2026-06-02");
  assertEquals(result.amount_cents, -500000n); // -5,000 IDR in cents
  assertEquals(result.currency, "IDR");
});

Deno.test("mapBniRow handles alternative Debet spelling", () => {
  const result = mapBniRow({
    Tanggal: "03/06/2026",
    Keterangan: "TRANSFER OUT",
    Debet: "250000",
    Kredit: "",
    Saldo: "9750000",
  });

  assertEquals(result.date, "2026-06-03");
  assertEquals(result.amount_cents, -25000000n); // -250,000 IDR in cents
  assertEquals(result.currency, "IDR");
});

Deno.test("mapBniRow handles Tgl. Transaksi column name", () => {
  const result = mapBniRow({
    "Tgl. Transaksi": "15/03/2026",
    Keterangan: "SALARY",
    Debit: "",
    Kredit: "5000000",
  });

  assertEquals(result.date, "2026-03-15");
  assertEquals(result.amount_cents, 500000000n);
});

Deno.test("mapBniRow handles Keterangan Transaksi column name", () => {
  const result = mapBniRow({
    Tanggal: "10/04/2026",
    "Keterangan Transaksi": "PAYMENT RECEIVED",
    Debit: "",
    Kredit: "3000000",
  });

  assertEquals(result.metadata["Keterangan Transaksi"], "PAYMENT RECEIVED");
  assertEquals(result.amount_cents, 300000000n);
});

Deno.test("mapBniRow handles Jumlah column as fallback", () => {
  const result = mapBniRow({
    Tanggal: "15/03/2026",
    Keterangan: "TRANSFER IN",
    Jumlah: "2500000",
    Saldo: "12500000",
  });

  assertEquals(result.date, "2026-03-15");
  assertEquals(result.amount_cents, 250000000n); // 2,500,000 IDR in cents
  assertEquals(result.currency, "IDR");
});

Deno.test("mapBniRow handles negative Jumlah (debit)", () => {
  const result = mapBniRow({
    Tanggal: "20/03/2026",
    Keterangan: "PAYMENT",
    Jumlah: "-75000",
    Saldo: "12425000",
  });

  assertEquals(result.date, "2026-03-20");
  assertEquals(result.amount_cents, -7500000n); // -75,000 IDR in cents
});

Deno.test("mapBniRow supports English column names as fallback", () => {
  const result = mapBniRow({
    Date: "2026-07-01",
    Description: "SALARY",
    Amount: "15000000",
  });

  assertEquals(result.date, "2026-07-01");
  assertEquals(result.amount_cents, 1500000000n);
  assertEquals(result.currency, "IDR");
});

Deno.test("mapBniRow rejects an invalid transaction date", () => {
  assertThrows(
    () =>
      mapBniRow({
        Tanggal: "not-a-date",
        Keterangan: "TEST",
        Debit: "",
        Kredit: "10000",
      }),
    Error,
    "Invalid BNI transaction date",
  );
});

Deno.test("mapBniRow rejects row with no amount columns", () => {
  assertThrows(
    () =>
      mapBniRow({
        Tanggal: "01/01/2026",
        Keterangan: "TEST",
      }),
    Error,
    "Cannot determine amount",
  );
});

Deno.test("mapBniRow uses Transaction ID when available", () => {
  const result = mapBniRow({
    Tanggal: "10/12/2026",
    Keterangan: "TRANSFER",
    "Transaction ID": "bni-txn-001",
    Kredit: "500000",
  });

  assertEquals(result.external_id, "bni-txn-001");
  assertEquals(result.amount_cents, 50000000n);
});

Deno.test("mapBniRow handles ISO date format fallback", () => {
  const result = mapBniRow({
    Tanggal: "2026-06-15",
    Keterangan: "SALARY",
    Kredit: "8000000",
  });

  assertEquals(result.date, "2026-06-15");
  assertEquals(result.amount_cents, 800000000n);
});
