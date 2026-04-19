# Agent Directives: remote-rupiah

## Tech Stack

- Frontend: Elm 0.19.1 ONLY. No React, Vue, or raw JS frameworks.
- Backend: Deno 2.2+ with Hono 4.x.
- Database: PostgreSQL 17+

## Hard Rules

1. **Opaque Types:** When writing Elm, never use `Float` for currency. Always use an opaque `Money` type wrapping an `Int` (cents).
2. **Pure Logic:** All tax and financial logic must live in pure Elm modules (e.g., `TaxLogic.elm`) without side effects.
3. **Security:** PostgreSQL must use Row-Level Security (RLS) for all tables.
4. **Validation:** Use `Zod` on the Deno backend for all incoming payloads.
5. **No Placeholders:** Write production-ready code. Do not leave `// TODO: implement logic` comments.
