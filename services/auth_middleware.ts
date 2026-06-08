import { Context, Next } from "hono";
import { verify } from "hono/jwt";

export type AuthToken = {
  sub: string;
  exp: number;
  iss: string;
  aud: string;
};

const TEST_JWT_SECRET = "test-jwt-secret-12345678901234567890";
const isTesting: boolean = (() => {
  try {
    if (Deno.env.get("DENO_ENV") === "test") return true;
    return !Deno.mainModule.endsWith("main.ts");
  } catch {
    return false;
  }
})();

function isAuthToken(x: unknown): x is AuthToken {
  if (typeof x !== "object" || x === null) return false;
  const token = x as Record<string, unknown>;
  return typeof token.sub === "string" &&
    typeof token.exp === "number" &&
    typeof token.iss === "string" &&
    typeof token.aud === "string";
}

const unauthorized = () =>
  new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

const getJwtSecret = () => {
  try {
    const secret =
      (Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET"))
        ?.trim();
    return secret || (isTesting ? TEST_JWT_SECRET : undefined);
  } catch {
    return isTesting ? TEST_JWT_SECRET : undefined;
  }
};

export const authMiddleware = async (c: Context, next: Next) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return unauthorized();

  const secret = getJwtSecret();
  if (!secret) return unauthorized();

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
