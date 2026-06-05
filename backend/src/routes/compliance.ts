import { Context, Hono } from "hono";
import { authMiddleware } from "../../../services/auth_middleware.ts";
import {
  getComplianceStatus,
  upsertDocument,
  type UpsertPayload,
} from "../../../services/compliance.ts";

const app = new Hono();

app.use("*", authMiddleware);

const getUid = (c: Context): string => (c.get("userId") as string) ?? "";

// ---------------------------------------------------------------------------
// POST /compliance/upload
// ---------------------------------------------------------------------------

app.post("/upload", async (c) => {
  const uid = getUid(c);
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
      id: (await upsertDocument(uid, {
        documentType: documentType as UpsertPayload["documentType"],
        taxYear,
        storageKey,
        mimeType,
        sizeBytes: BigInt(Math.trunc(sizeBytes)),
      })).id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    console.error("[compliance] upload failed:", msg);
    return c.json(
      { error: "Invalid upload payload" },
      msg.startsWith("Invalid MIME") || msg.startsWith("File exceeds")
        ? 400
        : 500,
    );
  }
});

// ---------------------------------------------------------------------------
// GET /compliance/status
// ---------------------------------------------------------------------------

app.get("/status", async (c) => {
  const uid = getUid(c);
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

export default app;
