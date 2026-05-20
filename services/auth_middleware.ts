import { Context, Next } from "hono";
import { verify } from "hono/jwt";

export type AuthToken = {
  sub: string;
  exp: number;
  iss: string;
  aud: string;
};

function isAuthToken(x: unknown): x is AuthToken {
  return typeof x === "object" &&
    x !== null &&
    typeof (x as any).sub === "string" &&
    typeof (x as any).exp === "number" &&
    typeof (x as any).iss === "string" &&
    typeof (x as any).aud === "string";
}

const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

export const authMiddleware = async (c: Context, next: Next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();
  
  const secret = (Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET"))?.trim();
  if (!secret) return c.json({ error: "Server misconfigured" }, 500);
  
  try {
    const decoded = await verify(auth.split(" ")[1], secret, "HS256");
    
    if (
      !isAuthToken(decoded) ||
      decoded.exp <= Math.floor(Date.now() / 1000) ||
      decoded.iss !== "your-app" ||
      decoded.aud !== "your-users"
    ) return unauthorized();
    
    c.set("user", decoded);
    c.set("userId", decoded.sub); // Keep for backwards compatibility
  } catch {
    return unauthorized();
  }
  return next();
};
