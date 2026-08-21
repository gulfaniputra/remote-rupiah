import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { withAuth } from "../db/client.ts";
import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono();
app.use("*", authMiddleware);

const bodySchema = z.object({
  year: z
    .union([z.string(), z.number()])
    .transform((v) => parseInt(String(v), 10))
    .pipe(z.number().int().min(1000).max(9999)),
});

app.post("/", zValidator("json", bodySchema), async (c) => {
  const { year } = c.req.valid("json");
  const userId = (c.get as (key: string) => unknown)("userId") as
    | string
    | undefined;

  try {
    const result = await withAuth(userId, async (tx, uid) => {
      // 1. Fetch user's tax profile
      const profiles = await tx`
        SELECT npwp, nik, klu_code
        FROM user_tax_profiles
        WHERE user_id = ${uid}
      `;
      if (!profiles || profiles.length === 0) {
        return { error: "Tax profile not found", status: 404 };
      }

      const profile = profiles[0];

      // 2. Fetch transactions for the given year
      const txs = await tx`
        SELECT date, amount_cents, withholding_cents, kmk_rate, is_1042s_verified
        FROM transactions
        WHERE EXTRACT(YEAR FROM date) = ${year}
        ORDER BY date ASC, id ASC
      `;

      return { profile, txs };
    });

    if ("error" in result) {
      return c.json({ error: result.error }, result.status as 404);
    }

    const { profile, txs } = result;

    // Construct CSV stream generator to prevent memory exhaustion
    const stream = new ReadableStream({
      start(ctrl) {
        // Enqueue header
        ctrl.enqueue(
          new TextEncoder().encode(
            "NPWP,NIK,KLU,Tanggal,Bruto_Valas,Kurs_KMK,Bruto_IDR,Netto_IDR,PPh_24_Kredit_IDR\n",
          ),
        );

        for (const t of txs) {
          const dateStr = t.date instanceof Date
            ? t.date.toISOString().split("T")[0]
            : String(t.date).split("T")[0];

          // Format Bruto Valas (USD) safely handling negative BigInt signs
          const amountCents = BigInt(t.amount_cents);
          const isNegative = amountCents < 0n;
          const absCents = isNegative ? -amountCents : amountCents;

          const valasInteger = absCents / 100n;
          const valasDecimals = absCents % 100n;
          const brutoValasStr = `${isNegative ? "-" : ""}${valasInteger}.${
            String(
              valasDecimals,
            ).padStart(2, "0")
          }`;

          // Format Kurs KMK
          const kmkRateStr = String(t.kmk_rate || "0.00");
          const [ri, rf = ""] = kmkRateStr.split(".");
          const rate = BigInt(ri) * 100n +
            BigInt(rf.padEnd(2, "0").slice(0, 2));

          // Calculate IDR values
          const brutoIdr = (amountCents * rate) / 10000n;
          const nettoIdr = (brutoIdr * 50n) / 100n; // NPPN 50%

          // PPh 24 Credit is 0 if not verified
          const withholdingCents = BigInt(t.withholding_cents || 0);
          const pph24Credit = t.is_1042s_verified ? (withholdingCents * rate) / 10000n : 0n;

          ctrl.enqueue(
            new TextEncoder().encode(
              `${profile.npwp},${profile.nik},${profile.klu_code},${dateStr},${brutoValasStr},${kmkRateStr},${brutoIdr},${nettoIdr},${pph24Credit}\n`,
            ),
          );
        }

        ctrl.close();
      },
    });

    return c.body(stream, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="DJP_Coretax_Export_${year}.csv"`,
    });
  } catch (err: unknown) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

export default app;
