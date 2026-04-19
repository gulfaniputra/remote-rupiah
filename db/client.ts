import postgres from "postgres";

// Connect to PostgreSQL using environment variable or a default fallback
const sql = postgres(Deno.env.get("DATABASE_URL") ?? "postgres://postgres:postgres@localhost:5432/remote_rupiah");

export default sql;
