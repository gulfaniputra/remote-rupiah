---
trigger: "*"
---

# Architectural Guidelines: Remote Rupiah

**Context:** You are an AI coding assistant working on Remote Rupiah, an
edge-native financial compliance engine for Indonesian remote professionals. Our
standards align with June 2026 production best practices.

**Tech Stack:**

- **Frontend:** Elm 0.19.1 (Pure functional, immutable architecture)
- **Backend:** Deno 2.2+ with Hono 4.x (TypeScript)
- **Database:** PostgreSQL 17

---

## 1. The Money Rule (Zero-Float Protocol)

This is a financial application. **You are strictly forbidden from using `Float`
or `Number` types for currency calculations.**

- **Frontend:** Always use the opaque `Money` type defined in
  `frontend/src/Money.elm`. Internal representation must be `Int` (representing
  cents/subunit).
- **Backend/DB:** Always store and transmit financial values as `BIGINT`
  (cents/subunit).
- _Exception:_ Exchange rates (e.g., Kurs Menteri Keuangan / KMK rates) or tax
  percentages may use floats during intermediate operations, but final results
  must be converted via integer division/multiplication before final currency
  representation.

## 2. Tax Logic Isolation (UU HPP Compliance)

- All calculation logic for DJP compliance (including KLU 62010 Norma and PPh 24
  foreign tax credit limits) must exist **exclusively** as pure functions within
  `frontend/src/TaxLogic.elm`.
- Do not mix tax calculations, brackets, or logic into View modules, Backend
  routes, or SQL triggers.
- Tax brackets, rates, and PTKP thresholds must be treated as injectable data
  payloads, never hardcoded constants.

## 3. Database Security & Multi-Tenancy

- **Row-Level Security (RLS) is immutable.** Do not write application-level
  `WHERE user_id = ?` filters to enforce tenant isolation.
- Multi-tenancy is enforced exclusively via `withAuth` setting
  `app.current_user_id` inside PostgreSQL transaction blocks.
- Never suggest removing, bypassing, or disabling RLS.

## 4. Edge-Native Deno & Hono Standards

- **Dependency Resolution:** Prefer JSR (`jsr:`) over NPM (`npm:`) for all Deno
  dependencies. Manage all imports via the root `deno.json` import map. Never
  use raw HTTPS imports or legacy `deps.ts` files.
- **Web Standards:** Write standard web-compatible TypeScript. Avoid legacy
  Node.js APIs (`node:fs`, `node:crypto`) unless absolutely no web-standard
  equivalent exists.
- **Hono Context:** When accessing environment variables or context state (e.g.,
  `c.get("user")`), ensure proper type casting or leverage Hono's generic
  Context definition `Context<{ Variables: Env }>` to preserve full type safety.

## 5. Agent Constraints & Guardrails

- **Do not guess:** If an Indonesian tax formula (e.g., PPh 21 TER rates) or Elm
  type constraint is ambiguous, stop immediately and ask the developer for
  clarification.
- **Immutable Schema:** Never modify executed SQL migrations in `db/`. Always
  create new sequentially numbered `.sql` files for schema updates.
- **Elm Architecture Purity:** Keep the Elm `update` loop completely free of
  side-effects. All external communications must go explicitly through `Cmd`
  ports or `Http` requests.
- **STRICT PROHIBITION:** Never use `Float` for currency. If you detect a
  `Float` in an accounting routine, stop and refactor to use `Money.elm`.
- **STRICT PROHIBITION:** Do not add `WHERE user_id = ...` to SQL queries. Trust
  the PostgreSQL 17 RLS layer. Adding application-level filtering is considered
  redundancy slop.
