import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql, { withAuth } from "../db/client.ts";
import { authMiddleware } from "../services/auth_middleware.ts";
import { calculateNppn } from "../services/tax_logic.ts";
import postgres from "postgres";

const app = new Hono();
app.use("*", authMiddleware);

app.post("/spt1770", zValidator("json", z.object({ year: z.string().regex(/^\d{4}$/).transform(v => parseInt(v, 10)) })), c => {
  const { year } = c.req.valid("json");
  const userId = (c.get as (key: string) => unknown)("userId") as string | undefined;
  return withAuth(userId, (tx) => tx`SELECT date, amount_cents, kmk_rate, withholding_cents FROM transactions WHERE EXTRACT(YEAR FROM date) = ${year}`)
        .then(txs => !txs.length
          ? c.json({ error: "Empty" }, 404)
          : c.body(new ReadableStream({
              start(ctrl) {
                ctrl.enqueue(new TextEncoder().encode("Bulan,Bruto_Valas,Kurs_KMK,Bruto_IDR,Netto_IDR,PPh_24_Kredit_IDR\n"));
                let [tg, tn, tw] = [0n, 0n, 0n];
                for (const t of txs) {
                  const rateStr = String(t.kmk_rate || "0");
                  const [ri, rf = ""] = rateStr.split(".");
                  const rate = BigInt(ri) * 100n + BigInt(rf.padEnd(2, "0").slice(0, 2));
                  const g = (BigInt(t.amount_cents) * rate) / 100n;
                  const n = calculateNppn(g);
                  const w = (BigInt(t.withholding_cents) * rate) / 100n;
                  tg += g; tn += n; tw += w;
                  ctrl.enqueue(new TextEncoder().encode(`${t.date.toISOString().split('T')[0]},${t.amount_cents},${t.kmk_rate},${g},${n},${w}\n`));
                }
                ctrl.enqueue(new TextEncoder().encode(`TOTAL,,,${tg},${tn},${tw}\n`));
                ctrl.close();
              }
            }), 200, { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="SPT_${year}.csv"` }));
});

export default app;
