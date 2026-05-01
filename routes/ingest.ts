import { Hono } from "hono";
import { parseCsvFromStream } from "../services/csv_parser.ts";

const app = new Hono();

app.post("/preview", async (c) => {
  try {
    const size = parseInt(c.req.header("Content-Length") || "0", 10);
    if (size > 5 * 1024 * 1024) return c.json({ success: false, error: "Payload too large (max 5MB)" }, 413);
    
    const ct = c.req.header("Content-Type") || "";
    if (ct.includes("multipart/form-data")) {
      const file = (await c.req.formData()).get("file");
      if (!file || !(file instanceof File)) return c.json({ success: false, error: "Missing 'file' field" }, 400);
      if (!file.name.endsWith(".csv")) return c.json({ success: false, error: "File must be .csv" }, 400);
      return c.json({ success: true, ...(await parseCsvFromStream(file.stream())) });
    }
    if (ct.includes("text/csv") || ct.includes("text/plain")) {
      if (!c.req.raw.body) return c.json({ success: false, error: "Empty body" }, 400);
      return c.json({ success: true, ...(await parseCsvFromStream(c.req.raw.body)) });
    }
    return c.json({ success: false, error: "Use multipart/form-data or text/csv" }, 415);
  } catch (e: unknown) {
    return c.json({ success: false, error: `Parse error: ${e instanceof Error ? e.message : e}` }, 500);
  }
});

export default app;
