import { Hono, Context } from "hono";
import transactions from "./routes/transactions.ts";
import kmk from "./routes/kmk.ts";
import ingest from "./routes/ingest.ts";
import exportSpt from "./routes/export.ts";
import taxProfile from "./routes/tax_profile.ts";
import forecast from "./routes/forecast.ts";
import wealth from "./routes/wealth.ts";
import fieldMapping from "./routes/field_mapping.ts";
import { registerKmkCron } from "./services/kmk_cron.ts";

const app = new Hono();

app.get("/", (c: Context) => {
  return c.text("Remote Rupiah API");
});

app.route("/api/transactions", transactions);
app.route("/api/kmk", kmk);
app.route("/api/v1/ingest", ingest);
app.route("/api/export", exportSpt);
app.route("/api/tax-profile", taxProfile);
app.route("/api/forecast", forecast);
app.route("/api/wealth", wealth);
app.route("/api/v1/field-mapping", fieldMapping);

// Register Deno.cron jobs for automated KMK rate sync
// Requires --unstable-cron flag or Deno Deploy runtime
registerKmkCron();

Deno.serve(app.fetch);

