import { Hono, Context } from "hono";
import transactions from "./routes/transactions.ts";
import kmk from "./routes/kmk.ts";
import { registerKmkCron } from "./services/kmk_cron.ts";

const app = new Hono();

app.get("/", (c: Context) => {
  return c.text("Remote Rupiah API");
});

app.route("/api/transactions", transactions);
app.route("/api/kmk", kmk);

// Register Deno.cron jobs for automated KMK rate sync
// Requires --unstable-cron flag or Deno Deploy runtime
registerKmkCron();

Deno.serve(app.fetch);
