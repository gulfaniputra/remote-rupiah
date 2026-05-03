import { Context, Next } from "hono";
import { verify } from "hono/jwt";

export const authMiddleware = async (c: Context, next: Next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Authorization required" }, 401);
  
  const secret = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET");
  if (!secret) return c.json({ error: "Server misconfigured" }, 500);
  
  try {
    const decoded = await verify(auth.split(" ")[1], secret, "HS256");
    c.set("userId", decoded.sub as string);
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
  await next();
};
