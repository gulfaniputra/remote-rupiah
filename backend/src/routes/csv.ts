import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../../../services/auth_middleware.ts";
import { withAuth } from "../../../db/client.ts";
import { CsvMappingSchema } from "../db/schema/csv-mappings.ts";

const app = new Hono();

// Apply authentication middleware
app.use("*", authMiddleware);

// GET /csv/map -> Returns the current stored mapping for this tenant
app.get("/map", async (c) => {
  const uid = (c.get as (key: string) => unknown)("userId") as string;
  if (!uid) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const mapping = await withAuth(uid, async (t) => {
      const rows = await t`
        SELECT mapping FROM csv_mappings 
        ORDER BY created_at DESC 
        LIMIT 1
      `;
      return rows[0]?.mapping ?? null;
    });

    return c.json({ success: true, mapping });
  } catch {
    return c.json({ success: false, error: "Failed to load CSV mapping" }, 500);
  }
});

// POST /csv/map -> Validates and stores a new mapping for this tenant
app.post("/map", zValidator("json", CsvMappingSchema), async (c) => {
  const uid = (c.get as (key: string) => unknown)("userId") as string;
  if (!uid) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  const mapping = c.req.valid("json");

  try {
    await withAuth(uid, async (t, userId) => {
      await t`
        INSERT INTO csv_mappings (user_id, mapping)
        VALUES (${userId}, ${JSON.stringify(mapping)})
      `;
    });

    return c.json({ success: true });
  } catch {
    return c.json({ success: false, error: "Failed to save CSV mapping" }, 500);
  }
});

export default app;
