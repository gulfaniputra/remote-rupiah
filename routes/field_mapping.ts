import { Hono, Context, Env } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { match } from "../services/matcher.ts";
import { authMiddleware } from "../services/auth_middleware.ts";
import { withAuth } from "../db/client.ts";

// Define custom context schema to explicitly map properties set by middleware
interface AppEnv extends Env {
  Variables: {
    userId: string;
  };
}

const app = new Hono();

// Explicit contextual environment accessor
const getUserId = (c: Context<AppEnv>) => c.get("userId") as string | undefined;

// All field mapping routes require authentication
app.use("*", authMiddleware);

const suggestSchema = z.object({
  sourceFields: z.array(z.string().min(1)).min(1).max(100),
  targetFields: z.array(z.string().min(1)).min(1).max(100),
});

app.post("/suggest", zValidator("json", suggestSchema), (c) => {
  const { sourceFields, targetFields } = c.req.valid("json");
  return c.json(
    sourceFields.map((source) => match(source, [...new Set(targetFields)])),
  );
});

const confirmSchema = z.object({
  mappings: z
    .array(
      z.object({
        source: z.string(),
        target: z.string(),
        confidence: z.number(),
        userVerified: z.boolean(),
      }),
    )
    .min(1)
    .max(100),
});

app.post("/confirm", zValidator("json", confirmSchema), async (c) => {
  const uid = getUserId(c as unknown as Context<AppEnv>);
  if (!uid) return c.json({ success: false, error: "Unauthorized" }, 401);

  try {
    const payload = c.req.valid("json");

    await withAuth(uid, async (t, userId) => {
      const rows = payload.mappings.map((m) => ({
        user_id: userId,
        source_field: m.source,
        target_field: m.target,
        confidence: m.confidence,
        user_verified: m.userVerified,
        matcher_version: "1.0.0",
      }));

      await t`
        INSERT INTO field_mappings ${t(rows, "user_id", "source_field", "target_field", "confidence", "user_verified", "matcher_version")}
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
