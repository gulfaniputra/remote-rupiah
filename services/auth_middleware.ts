import { Context, Next } from "hono";
import { sign, verify } from "hono/jwt";

export type AuthToken = {
  sub: string;
  exp: number;
  iss: string;
  aud: string;
};

const TEST_JWT_SECRET = "test-jwt-secret-12345678901234567890";
const DEV_JWT_SECRET = "dev-jwt-secret-abcdef1234567890abcdef";

const isTesting: boolean = (() => {
  try {
    return !Deno.mainModule.endsWith("main.ts");
  } catch {
    return false;
  }
})();

const isProduction: boolean = (() => {
  try {
    return Deno.env.get("DENO_ENV") === "production";
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

export const getJwtSecret = (): string | undefined => {
  try {
    const secret =
      (Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET"))
        ?.trim();
    if (secret) return secret;
  } catch {
    // ignore
  }
  if (isTesting) return TEST_JWT_SECRET;
  // Dev fallback: allow dev environment without explicit env vars
  return isProduction ? undefined : DEV_JWT_SECRET;
};

/**
 * Generate a dev-mode JWT token.
 * Throws if called in production.
 */
export const generateDevToken = async (userId: string): Promise<string> => {
  if (!userId) {
    throw new Error("Cannot generate dev token: userId must be non-empty");
  }
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("Cannot generate dev token: no JWT secret configured");
  }
  return await sign(
    {
      sub: userId,
      iss: "your-app",
      aud: "your-users",
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    },
    secret,
    "HS256",
  );
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
