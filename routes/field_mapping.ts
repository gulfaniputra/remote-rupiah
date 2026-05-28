import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { Suggestion, match } from "../services/matcher.ts";
import { authMiddleware } from "../services/auth_middleware.ts";
import sql, { withAuth } from "../db/client.ts";
import postgres from "postgres";

const app = new Hono();

// All field mapping routes require authentication
app.use("*", authMiddleware);

const suggestSchema = z.object({
  sourceFields: z.array(z.string().min(1)).min(1).max(100),
  targetFields: z.array(z.string().min(1)).min(1).max(100),
});

app.post("/suggest", zValidator("json", suggestSchema), async (c) => {
  const { sourceFields, targetFields } = c.req.valid("json");
  return c.json(
    sourceFields.map((source) => match(source, [...new Set(targetFields)]))
  );
});

const confirmSchema = z.object({
  mappings: z.array(z.object({
    source: z.string(),
    target: z.string(),
    confidence: z.number(),
    userVerified: z.boolean(),
  })).min(1).max(100),
});

app.post("/confirm", zValidator("json", confirmSchema), async (c) => {
  const uid = (c.get as (key: string) => unknown)("userId") as string;
  if (!uid) return c.json({ success: false, error: "Unauthorized" }, 401);

  try {
    await withAuth(uid, async (t, userId) => {
      await t`
        INSERT INTO field_mappings ${t(
          c.req.valid("json").mappings.map((m) => ({
            user_id: userId,
            source_field: m.source,
            target_field: m.target,
            confidence: m.confidence,
            user_verified: m.userVerified,
            matcher_version: "1.0.0",
          }))
        )}
        ON CONFLICT (user_id, source_field, target_field) 
        DO UPDATE SET 
          confidence = EXCLUDED.confidence,
          user_verified = EXCLUDED.user_verified,
          matcher_version = EXCLUDED.matcher_version,
          created_at = CURRENT_TIMESTAMP
      `;
    });
    return c.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: `Database error: ${message}` }, 500);
  }
});

export default app;
