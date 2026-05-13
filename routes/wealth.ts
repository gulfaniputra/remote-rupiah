import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../services/auth_middleware.ts";
import { recordConversion } from "../services/wealth/fifo_manager.ts";

const app = new Hono();

app.use("*", authMiddleware);

app.post("/convert", zValidator("json", z.object({
  amountUsdCents: z.union([z.number().int(), z.bigint()]).transform(v => BigInt(v))
})), async (c) => {
  const { amountUsdCents } = c.req.valid("json");
  const userId = c.get("userId");

  try {
    await recordConversion(userId!, amountUsdCents);
    return c.json({ success: true, message: "Conversion recorded and USD depleted (FIFO)" });
  } catch (e: unknown) {
    return c.json({ success: false, error: e instanceof Error ? e.message : String(e) }, 400);
  }
});

export default app;
