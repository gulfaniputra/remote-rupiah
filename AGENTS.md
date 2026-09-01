# remote-rupiah — Agent Guide

## Stack

- **Backend:** Deno 2.2+ / Hono 4.4 (TypeScript, no `package.json` — uses `deno.json` import maps)
- **Frontend:** Elm 0.19.1 SPA (`frontend/src/Main.elm`)
- **Database:** PostgreSQL 17 with RLS tenant isolation via `SET LOCAL app.current_user_id`
- **Deploy:** Cloudflare Pages (frontend) + Deno (backend)

## Key Commands

| Command                       | What it does                                               |
| ----------------------------- | ---------------------------------------------------------- |
| `deno task dev`               | Run backend with watch (`localhost:8000`)                  |
| `deno task build:frontend`    | Compile Elm SPA (clears elm-stuff first)                   |
| `deno task serve:frontend`    | Static file server for frontend (`localhost:8010`)         |
| `deno task validate:backend`  | `deno fmt --check && deno lint && deno check && deno test` |
| `deno task validate:frontend` | `elm-format --validate src/ && elm-test`                   |

## Testing

- **Backend tests** use an in-memory mock SQL proxy (`db/client.ts`). No real DB needed —
  `testMocks` object controls all query responses. Tests auto-use mocks when `Deno.mainModule` is
  not `main.ts`.
- **Frontend tests** use `elm-test` in `frontend/tests/`. Run via `deno task validate:frontend`.
- CI runs both validations in parallel (backend needs `DATABASE_URL` secret; frontend needs Node for
  Elm tooling).

## Architecture

- `main.ts` — Hono app entrypoint, CORS, route mounting, cron init
- `routes/` — API route handlers (transactions, ingest, forecast, wealth, export, etc.)
- `services/` — Business logic (tax, KMK rates, CSV parsing, auth, compliance, wealth)
- `backend/src/` — Ingestion domain models, Zod schemas, CSV mapper, additional routes
- `db/` — Schema, migrations, seed, and `client.ts` (Postgres connection + mock proxy)
- `frontend/src/` — Elm source (TEA architecture: `Main.elm`, `Api.elm`, `Money.elm`,
  `TaxLogic.elm`)

## Critical Conventions

- **No floats for money.** All currency values are `BigInt` micro-units (cents). Elm `Money` type
  wraps `BigInt` with phantom currency types (`USD`/`IDR`). JSON serialization uses strings.
- **RLS isolation.** All DB access goes through `withAuth(userId, fn)` which sets
  `app.current_user_id` in a transaction. Every table has `ENABLE ROW LEVEL SECURITY`.
- **JWT auth.** `authMiddleware` verifies Bearer tokens. Dev mode: `GET /api/auth/token` (requires
  `ALLOW_DEV_AUTH=true`). Test secret: `test-jwt-secret-12345678901234567890`.
- **Pre-commit hooks** via lefthook: `deno fmt --check`, `deno lint`, `deno check`,
  `elm-format --validate`, `deno fmt --check` for JSON.

## Setup

```bash
cp .env.example .env
# DB setup (if running locally):
createdb remote_rupiah
psql -d remote_rupiah -f db/schema.sql -f db/seed.sql
```

## CI Pipeline

Two parallel jobs in `.github/workflows/ci.yml`:

1. **Backend:** `deno task validate:backend` (circuit-breaker checks `DENO_DEPLOYMENT_ID` is unset)
2. **Frontend:** Install Elm tooling via npm, cache elm-stuff, run `validate:frontend`, then verify
   `elm make --optimize`
