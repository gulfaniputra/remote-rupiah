import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import sql from "../db/client.ts";
import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono<{ Variables: { userId: string | undefined } }>();
app.use("*", authMiddleware);

const withAuth = (id: string | undefined, fn: (tx: any) => Promise<any>) => sql.begin(async (tx: any) => { await tx`SET LOCAL request.jwt.claim.sub = ${id || "00000000-0000-0000-0000-000000000000"}`; return fn(tx); });

app.post("/spt1770", zValidator("json", z.object({ year: z.string().regex(/^\d{4}$/).transform(v => parseInt(v, 10)) })), async (c) => {
  const { year } = c.req.valid("json");
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "Auth required" }, 401);
  const txs = await withAuth(userId, (tx: any) => tx`SELECT date, amount_cents, kmk_rate, withholding_cents FROM transactions WHERE EXTRACT(YEAR FROM date) = ${year}`);
  if (!txs.length) return c.json({ error: "Empty" }, 404);

  return c.body(new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(new TextEncoder().encode("Bulan,Bruto_Valas,Kurs_KMK,Bruto_IDR,Netto_IDR,PPh_24_Kredit_IDR\n"));
      let [tg, tn, tw] = [0n, 0n, 0n];
      for (const t of txs) {
        const rate = BigInt(Math.round(Number(t.kmk_rate || 0) * 100));
        const g = (BigInt(t.amount_cents) * rate) / 100n, n = (g * 50n) / 100n, w = (BigInt(t.withholding_cents) * rate) / 100n;
        tg += g; tn += n; tw += w;
        ctrl.enqueue(new TextEncoder().encode(`${t.date.toISOString().split('T')[0]},${t.amount_cents},${t.kmk_rate},${g},${n},${w}\n`));
      }
      ctrl.enqueue(new TextEncoder().encode(`TOTAL,,,${tg},${tn},${tw}\n`));
      ctrl.close();
    }
  }), 200, { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="SPT_${year}.csv"` });
});

export default app;
