import { Hono, Context } from "hono";
import transactions from "./routes/transactions.ts";

const app = new Hono();

app.get("/", (c: Context) => {
  return c.text("Remote Rupiah API");
});

app.route("/api/transactions", transactions);

Deno.serve(app);
