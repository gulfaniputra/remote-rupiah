import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authMiddleware } from "../services/auth_middleware.ts";
import { recordConversion } from "../services/wealth/fifo_manager.ts";

const app = new Hono();

app.use("*", authMiddleware);

app.post("/convert", zValidator("json", z.object({
  amountUsdCents: z.union([z.number().int(), z.bigint()]).transform(v => BigInt(v))
})), c =>
  recordConversion((c.get as (key: string) => unknown)("userId") as string, c.req.valid("json").amountUsdCents)
    .then(() => c.json({ success: true, message: "Conversion recorded and USD depleted (FIFO)" }))
    .catch((e: unknown) => c.json({ success: false, error: e instanceof Error ? e.message : String(e) }, 400))
);

export default app;
