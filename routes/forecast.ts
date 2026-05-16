import { Hono } from "hono";
import sql from "../db/client.ts";
import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono<{ Variables: { userId: string | undefined } }>();

app.use("*", authMiddleware);

// deno-lint-ignore no-explicit-any
const withAuth = (id: string | undefined, fn: (tx: any) => Promise<any>) =>
  sql.begin(async (tx: any) => { 
    if (!id) throw new Error("Authentication required for DB transaction");
    await tx`SET LOCAL app.current_user_id = ${id}`; 
    return fn(tx); 
  });

app.get("/", async c => {
  const year = Number(c.req.query("year")) || new Date().getFullYear();
  // deno-lint-ignore no-explicit-any
  const res = await withAuth(c.get("userId"), (tx: any) => tx`
    SELECT
      COALESCE(SUM(amount_cents), 0)::text AS ytd_gross_cents,
      COALESCE(SUM(withholding_cents), 0)::text AS ytd_withholding_cents,
      COALESCE(SUM(actual_idr_received_cents), 0)::text AS ytd_actual_idr_cents,
      COUNT(*)::int AS transaction_count,
      COUNT(*) FILTER (WHERE is_1042s_verified = TRUE)::int AS verified_count,
      COALESCE(AVG(CASE WHEN kmk_rate IS NOT NULL AND actual_idr_received_cents IS NOT NULL AND amount_cents > 0
        THEN (amount_cents * (kmk_rate * 100)::bigint / 100) - actual_idr_received_cents ELSE NULL END), 0)::text AS avg_fx_spread_cents,
      EXTRACT(MONTH FROM MAX(date))::int AS latest_month
    FROM transactions WHERE date_part('year', date) = ${year}`);
  const r = res[0];
  return c.json({ success: true, forecast: { year, ytdGrossCents: r.ytd_gross_cents, ytdWithholdingCents: r.ytd_withholding_cents, ytdActualIdrCents: r.ytd_actual_idr_cents, transactionCount: r.transaction_count, verifiedCount: r.verified_count, avgFxSpreadCents: r.avg_fx_spread_cents, latestMonth: r.latest_month || 0 } });
});

app.get("/fx-efficiency", async c => {
  const year = Number(c.req.query("year")) || new Date().getFullYear();
  // deno-lint-ignore no-explicit-any
  const res = await withAuth(c.get("userId"), (tx: any) => tx`
    SELECT date, amount_cents::text AS amount_cents, kmk_rate::text AS kmk_rate,
      actual_idr_received_cents::text AS actual_idr_cents,
      CASE WHEN amount_cents > 0 AND kmk_rate IS NOT NULL AND actual_idr_received_cents IS NOT NULL
        THEN ((amount_cents * (kmk_rate * 100)::bigint / 100) - actual_idr_received_cents)::text ELSE '0' END AS spread_cents,
      metadata->>'source' AS source
    FROM transactions WHERE date_part('year', date) = ${year} AND kmk_rate IS NOT NULL ORDER BY date ASC`);
  return c.json({ success: true, fxData: res });
});

export default app;
