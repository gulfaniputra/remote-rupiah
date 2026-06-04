import { Context, Hono } from "hono";
import transactions from "./routes/transactions.ts";
import kmk from "./routes/kmk.ts";
import ingest from "./routes/ingest.ts";
import exportSpt from "./routes/export.ts";
import exportDjp from "./routes/export_djp.ts";
import taxProfile from "./routes/tax_profile.ts";
import forecast from "./routes/forecast.ts";
import wealth from "./routes/wealth.ts";
import fieldMapping from "./routes/field_mapping.ts";
import { registerKmkCron } from "./services/kmk_cron.ts";
import { getKmkRateByDate } from "./services/kmk_resolver.ts";
import csv from "./backend/src/routes/csv.ts";

export const app = new Hono();

app.get("/", (c: Context) => {
  return c.text("Remote Rupiah API");
});

app.get("/kmk-rate", async (c: Context) => {
  const dateParam = c.req.query("date");
  if (!dateParam) return c.json({ error: "Missing date parameter" }, 400);
  if (isNaN(Date.parse(dateParam))) {
    return c.json({ error: "Invalid date format" }, 400);
  }

  try {
    return c.json(await getKmkRateByDate(new Date(dateParam)));
  } catch (err: unknown) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      404,
    );
  }
});

app.route("/api/transactions", transactions);
app.route("/api/kmk", kmk);
app.route("/api/v1/ingest", ingest);
app.route("/api/export", exportSpt);
app.route("/api/export/djp", exportDjp);

app.route("/api/tax-profile", taxProfile);

app.route("/api/forecast", forecast);
app.route("/api/wealth", wealth);
app.route("/api/v1/field-mapping", fieldMapping);
app.route("/api/csv", csv);

if (import.meta.main) {
  // Register Deno.cron jobs for automated KMK rate sync
  // Requires --unstable-cron flag or Deno Deploy runtime
  registerKmkCron();
  Deno.serve(app.fetch);
}
