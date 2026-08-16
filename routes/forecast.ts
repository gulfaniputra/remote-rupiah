import { Hono } from "hono";
import { withAuth } from "../db/client.ts";
import { authMiddleware } from "../services/auth_middleware.ts";

const app = new Hono();

app.use("*", authMiddleware);

// `GET /api/forecast/`  (YTD aggregation)
app.get("/", (c) => {
  const year = Number(c.req.query("year")) || new Date().getFullYear();
  return withAuth(
    (c.get as (key: string) => unknown)("userId") as string | undefined,
    (tx) =>
      tx`
    SELECT
      COALESCE(SUM(amount_cents), 0)::bigint AS ytd_gross_cents,
      COALESCE(SUM(withholding_cents), 0)::bigint AS ytd_withholding_cents,
      COALESCE(SUM(actual_idr_received_cents), 0)::bigint AS ytd_actual_idr_cents,
      COUNT(*)::int AS transaction_count,
      COUNT(*) FILTER (WHERE is_1042s_verified = TRUE)::int AS verified_count,
      -- ✅ Pure integer average
      COALESCE(
        (SUM(CASE WHEN kmk_rate IS NOT NULL AND actual_idr_received_cents IS NOT NULL AND amount_cents > 0
          THEN ((amount_cents * (kmk_rate * 100)::bigint) / 100) - actual_idr_received_cents
          ELSE 0 END)
          / NULLIF(COUNT(*) FILTER (WHERE kmk_rate IS NOT NULL AND actual_idr_received_cents IS NOT NULL AND amount_cents > 0), 0)
        ),
        0
      )::bigint AS avg_fx_spread_cents,
      EXTRACT(MONTH FROM MAX(date))::int AS latest_month
    FROM transactions
    WHERE date_part('year', date) = ${year}
      AND amount_cents > 0`,
  ).then(([r]) =>
    c.json({
      success: true,
      forecast: {
        year,
        ytdGrossCents: Number(r.ytd_gross_cents),
        ytdWithholdingCents: Number(r.ytd_withholding_cents),
        ytdActualIdrCents: Number(r.ytd_actual_idr_cents),
        transactionCount: r.transaction_count,
        verifiedCount: r.verified_count,
        avgFxSpreadCents: Number(r.avg_fx_spread_cents),
        latestMonth: r.latest_month || 0,
      },
    }),
  );
});

// `GET /api/forecast/fx-efficiency`
app.get("/fx-efficiency", (c) => {
  const year = Number(c.req.query("year")) || new Date().getFullYear();
  return withAuth(
    (c.get as (key: string) => unknown)("userId") as string | undefined,
    (tx) =>
      tx`
    SELECT date,
      amount_cents::bigint AS amount_cents,
      kmk_rate::text AS kmk_rate,
      actual_idr_received_cents::bigint AS actual_idr_cents,
      -- ✅ Pure integer
      (amount_cents * (kmk_rate * 100)::bigint) / 100 AS amount_idr_cents,
      CASE WHEN amount_cents > 0 AND kmk_rate IS NOT NULL AND actual_idr_received_cents IS NOT NULL
        THEN ((amount_cents * (kmk_rate * 100)::bigint) / 100) - actual_idr_received_cents::bigint
        ELSE 0
      END AS spread_cents,
      metadata->>'source' AS source
    FROM transactions
    WHERE date_part('year', date) = ${year}
      AND kmk_rate IS NOT NULL
      AND amount_cents > 0
    ORDER BY date ASC`,
  ).then((res) =>
    c.json({
      success: true,
      fxData: res.map((row) => ({
        date: row.date,
        source: row.source,
        kmk_rate: row.kmk_rate,
        amount_cents: String(row.amount_cents),
        actual_idr_cents: row.actual_idr_cents
          ? String(row.actual_idr_cents)
          : null,
        spread_cents: String(row.spread_cents),
        amount_idr_cents: String(row.amount_idr_cents),
      })),
    }),
  );
});

export default app;
