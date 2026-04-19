---
trigger: always_on
---

# Rule: Architecture & Safety

- **Logic Isolation:** All financial logic MUST live in pure Elm modules (e.g., `TaxLogic.elm`).
- **Currency Safety:** Never use `Float` for money. Use the opaque `Money` type wrapping an `Int`.
- **Backend Validation:** Use `Zod` for all Deno/Hono request schemas.
- **Database:** All SQL must be compatible with PostgreSQL 17.
