import { Hono } from "hono";
import { authMiddleware } from "../../../services/auth_middleware.ts";
import {
  getComplianceStatus,
  markNppnNotified,
  upsertDocument,
  type UpsertPayload,
} from "../../../services/compliance.ts";

const app = new Hono();

app.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// POST /compliance/upload
// ---------------------------------------------------------------------------

const userId = (c: { get: unknown }) =>
  (c.get as (key: string) => unknown)("userId") as string | undefined;

app.post("/upload", async (c) => {
  const uid = userId(c) ?? "";
  if (!uid) return c.json({ error: "Unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const documentType = body.documentType;
  const taxYear = Number(body.taxYear);
  const storageKey = body.storageKey;
  const mimeType = body.mimeType;
  const sizeBytes = Number(body.sizeBytes);

  if (documentType !== "1042s" && documentType !== "w8ben") {
    return c.json({ error: "Invalid upload payload" }, 400);
  }
  if (!Number.isFinite(taxYear) || !Number.isInteger(taxYear)) {
    return c.json({ error: "Invalid upload payload" }, 400);
  }
  if (typeof storageKey !== "string" || storageKey.length === 0) {
    return c.json({ error: "Invalid upload payload" }, 400);
  }
  if (typeof mimeType !== "string" || mimeType.length === 0) {
    return c.json({ error: "Invalid upload payload" }, 400);
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return c.json({ error: "Invalid upload payload" }, 400);
  }

  try {
    return c.json({
      success: true,
      id: (
        await upsertDocument(uid, {
          documentType: documentType as UpsertPayload["documentType"],
          taxYear,
          storageKey,
          mimeType,
          sizeBytes: BigInt(Math.trunc(sizeBytes)),
        })
      ).id,
    });
  } catch (err) {
    const e = err instanceof Error ? err.message : "Upload failed";
    console.error("[compliance] upload failed:", e);
    return c.json(
      { error: "Invalid upload payload" },
      e.startsWith("Invalid MIME") || e.startsWith("File exceeds") ? 400 : 500,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /compliance/status
// ---------------------------------------------------------------------------

app.get("/status", async (c) => {
  const uid = userId(c) ?? "";
  if (!uid) return c.json({ error: "Unauthorized" }, 401);

  try {
    return c.json(await getComplianceStatus(uid));
  } catch (err) {
    console.error(
      "[compliance] status fetch failed:",
      err instanceof Error ? err.message : String(err),
    );
    return c.json({ error: "Status unavailable" }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /compliance/nppn/notify
// ---------------------------------------------------------------------------

app.post("/nppn/notify", async (c) => {
  const uid = userId(c) ?? "";
  if (!uid) return c.json({ error: "Unauthorized" }, 401);

  try {
    const nppnStatus = await markNppnNotified(uid);
    return c.json({ nppnStatus });
  } catch (err) {
    console.error(
      "[compliance] nppn notify failed:",
      err instanceof Error ? err.message : String(err),
    );
    return c.json({ error: "NPPN notification failed" }, 500);
  }
});

export default app;
