import { cors } from "hono/cors";
import { Hono } from "hono";
import type { Context, Env } from "hono";
// Import routes
import transactions from "./routes/transactions.ts";
import kmk from "./routes/kmk.ts";
import ingest from "./routes/ingest.ts";
import exportSpt from "./routes/export.ts";
import exportDjp from "./routes/export_djp.ts";
import taxProfile from "./routes/tax_profile.ts";
import forecast from "./routes/forecast.ts";
import wealth from "./routes/wealth.ts";
import fieldMapping from "./routes/field_mapping.ts";
import csv from "./backend/src/routes/csv.ts";
import compliance from "./backend/src/routes/compliance.ts";
// Import services
import { initKmkCron } from "./services/kmk_cron.ts";
import { registerComplianceCron } from "./services/compliance_cron.ts";
import { getKmkRateByDate } from "./services/kmk_resolver.ts";
import { generateDevToken, getJwtSecret } from "./services/auth_middleware.ts";

interface AppEnv extends Env {
  Variables: {
    userId: string;
  };
}

export const app = new Hono();

// 1. Determine origin
const allowedOrigin = (() => {
  try {
    return Deno.env.get("APP_ENV") === "production"
      ? "https://remote-rupiah.pages.dev"
      : "http://localhost:8010";
  } catch {
    return "http://localhost:8010";
  }
})();

// 2. CORS Middleware
app.use(
  "*",
  cors({
    origin: allowedOrigin,
    allowHeaders: ["Content-Type", "Authorization", "x-api-key"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
);

// --- Core & Auth Endpoints ---
app.get("/", (c) => c.text("Remote Rupiah API"));

app.get("/api/auth/token", async (c) => {
  const secret = getJwtSecret();
  if (!secret) return c.json({ error: "No JWT secret configured" }, 500);
  try {
    const token = await generateDevToken(
      "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    );
    return c.json({ token });
  } catch (err: unknown) {
    return c.json(
      { error: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

const handleKmkRateLookup = async (c: Context<AppEnv>) => {
  const dateParam = c.req.query("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return c.json({ success: false, error: "Invalid date format" }, 400);
  }
  try {
    const result = await getKmkRateByDate(new Date(dateParam));
    return c.json(result);
  } catch (err: unknown) {
    return c.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      404,
    );
  }
};

app.get("/api/kmk-rate", handleKmkRateLookup);
app.get("/kmk-rate", handleKmkRateLookup);

// --- Routes ---
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
app.route("/api/compliance", compliance);

// --- Runtime Initialization ---
if (Deno.env.has("DENO_DEPLOYMENT_ID")) {
  console.log("[System] Initializing production cron jobs...");
  initKmkCron();
  registerComplianceCron();
}

if (import.meta.main) {
  Deno.serve(app.fetch);
}

export default app;
