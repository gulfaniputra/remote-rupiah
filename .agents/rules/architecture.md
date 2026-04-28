---
trigger: always_on
---

---

## trigger: "\*"

# Architectural Guidelines: Remote Rupiah

**Context:** You are an AI coding assistant working on Remote Rupiah, an edge-native financial compliance engine for Indonesian remote professionals. Our standards align with April 2026 production best practices.

**Tech Stack:**

- **Frontend:** Elm 0.19.1
- **Backend:** Deno 2.2+ with Hono 4.x
- **Database:** PostgreSQL 17

## 1. The Money Rule (Zero-Float Protocol)

This is a financial application. **You are strictly forbidden from using `Float` or `Number` types for currency calculations.**

- **Frontend:** Always use the opaque `Money` type defined in `frontend/src/Money.elm`. Internal representation must be `Int` (cents).
- **Backend/DB:** Always store financial values as `BIGINT` (cents).
- _Exception:_ Exchange rates (e.g., KMK rates) or tax percentages may use floats, but must be converted via integer division/multiplication before final currency calculation.

## 2. Tax Logic Isolation (UU HPP Compliance)

- All calculation logic for DJP compliance (including KLU 62010 Norma and PPh 24 limits) must exist **only** as pure functions within `frontend/src/TaxLogic.elm`.
- Do not mix tax calculations into View modules, Backend routes, or SQL triggers.
- Tax brackets and rates must be treated as injectable data, not hardcoded constants.

## 3. Database Security & Multi-Tenancy

- **Row-Level Security (RLS) is immutable.** Do not write application-level `WHERE user_id = ?` filters to enforce tenant isolation.
- Multi-tenancy is enforced exclusively via `withAuth` setting `app.current_user_id` inside PostgreSQL transaction blocks. Never suggest removing or bypassing RLS.

## 4. Edge-Native Deno Standard

- Prefer JSR (`jsr:`) over NPM (`npm:`) for all Deno dependencies to ensure maximum edge compatibility and type safety.
- Write standard web-compatible TypeScript. Avoid legacy Node.js APIs (`node:fs`, `node:crypto`) unless absolutely no web-standard equivalent exists.

## 5. Agent Constraints

- **Do not guess:** If a tax formula or Elm type constraint is unclear, stop and ask the developer for clarification.
- **Do not rewrite history:** Never modify executed SQL migrations in `db/`. Create new `.sql` files for schema updates.
- **STRICT PROHIBITION:** Never use `Float` for currency. If you see a `Float` in a financial calculation, stop and refactor to `Money.elm`.
- **STRICT PROHIBITION:** Do not add `WHERE user_id = ...` to SQL queries. Trust the PostgreSQL 17 RLS layer. Adding application-level filtering is considered redundancy slop.
