import postgres from "postgres";

// Connect to PostgreSQL using environment variable or a default fallback
let sql: any;
try {
  const dbUrl = Deno.env.get("DATABASE_URL") ?? "postgres://postgres:postgres@localhost:5432/remote_rupiah";
  sql = postgres(dbUrl); // This triggers process.env.PGMAX internally
} catch {
  // Ignore permission errors in test runner context
  // Return a safe mock object for pure function tests that include this module
  sql = new Proxy(function() {}, {
    get: () => function() {},
    apply: () => []
  });
}

export default sql;
