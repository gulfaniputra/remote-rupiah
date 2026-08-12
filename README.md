# remote-rupiah

[![CI Verification](https://github.com/gulfaniputra/remote-rupiah/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/gulfaniputra/remote-rupiah/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
![Elm](https://img.shields.io/badge/Elm-0.19.1-1293D8?logo=elm&logoColor=white)
![Deno](https://img.shields.io/badge/Deno-2.2%2B-black?logo=deno&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-4.4-E36009?logo=hono&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Frontend-F38020?logo=cloudflarepages&logoColor=white)

![demo](./docs/demo.gif)

[![Live Demo](https://img.shields.io/badge/Live_Demo-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://remote-rupiah.pages.dev/)

**remote-rupiah** is a tax compliance dashboard for Indonesian software developers billing U.S. clients. Computes FX conversion spreads, NPPN net income deductions (KLU 62010), and PPh 24 foreign tax credit caps.

> **Status:** Core tax engine, RLS database schema, and CSV ingestion pipelines are operational and tested. Production auth, provider auto-parsers, and CD automation are partial.

## Repository Structure

```text
.
├── main.ts                   # Hono app entry point (Deno edge runtime)
├── deno.json                 # Deno tasks, import maps, & compiler flags
├── routes/                   # Core Hono API route handlers
├── backend/src/              # Ingestion domain models, Zod schemas, & CSV mapper
├── services/                 # Tax logic, KMK rate fetcher/cron, & compliance
├── db/                       # PostgreSQL schema, seeds, & RLS wrapper (withAuth)
├── frontend/                 # Elm 0.19.1 SPA source (TEA architecture)
├── mocks/                    # Provider CSV test fixtures
└── .github/workflows/ci.yml
```

## Tech Stack & Environment

| Layer        | Technology           | Description                                    |
| ------------ | -------------------- | ---------------------------------------------- |
| **Frontend** | Elm 0.19.1           | Pure functional SPA (`frontend/dist/main.js`)  |
| **Backend**  | Deno 2.2+ + Hono 4.4 | Edge API runtime with Zod validation           |
| **Database** | PostgreSQL 17 + Neon | Tenant isolation via `app.current_user_id` RLS |

### Configuration (`.env`)

| Variable         | Purpose                              | Default                                             |
| ---------------- | ------------------------------------ | --------------------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string         | `postgres://user:pass@localhost:5432/remote_rupiah` |
| `JWT_SECRET`     | Secret key for JWT auth verification | `YOUR_SECURE_JWT_SECRET`                            |
| `ALLOW_DEV_AUTH` | Enable local JWT generator endpoint  | `true`                                              |
| `PORT`           | Local API server port                | `8000`                                              |

## Domain Logic & Core Guarantees

- **Zero-Float Money Arithmetic:** Elm `Money.decoder` enforces `amount_cents` as `String`. Ingestion normalizes input directly to `BigInt` micro-units (`"1,234.56"` → `123456n`) to prevent `IEEE 754` rounding loss.
- **Phantom Currency Types:** `Money USD` and `Money IDR` are distinct phantom types in Elm preventing currency mismatches at compile time.
- **Tenant RLS Isolation:** PostgreSQL Row-Level Security (RLS) isolates tenant rows using transaction-scoped session configuration (`SET LOCAL app.current_user_id`).
- **NPPN Net Income (KLU 62010):** $\text{Net Taxable Income} = \text{Gross IDR} \times 0.50$ (PER-17/PJ/2015).
- **PPh 24 Credit Cap:** $\text{Cap} = \min\left(\text{US Tax Paid}, \frac{\text{Foreign Net Income}}{\text{Total Taxable Income}} \times \text{Total ID Tax Due}\right)$. Requires `is_1042s_verified = true`.
- **FX Spread Measurement:** Surfacing conversion leakage via $(\text{USD Amount} \times \text{KMK Mid-Market Rate}) - \text{Actual IDR Received}$.

## Architecture & API Surface

```mermaid
graph LR
    Elm[Elm SPA] -->|JWT Bearer| Hono[Hono API / Deno]
    Hono -->|Zod Ingest| Pipeline[CSV Mapper]
    Hono -->|Cron Jobs| KMK[KMK FX Sync]
    Hono -->|Scoped RLS| Postgres[(PostgreSQL 17)]

```

| Route               | Method        | Purpose                                                  |
| ------------------- | ------------- | -------------------------------------------------------- |
| `/api/transactions` | `GET`, `POST` | Transaction management & KMK rate attachment             |
| `/api/v1/ingest`    | `POST`        | Import provider CSV files                                |
| `/api/csv/map`      | `GET`, `POST` | Tenant column mapping configuration                      |
| `/api/tax-profile`  | `GET`, `POST` | NPWP/NIK & KLU taxpayer parameters                       |
| `/api/forecast`     | `GET`         | Compute YTD tax liability, NPPN net income, & FX leakage |
| `/api/wealth`       | `GET`         | FIFO lot accounting for unrealized FX gains              |
| `/api/export/djp`   | `GET`         | Export report formatted for DJP Coretax / SPT CSV import |
| `/api/auth/token`   | `GET`         | Development JWT generator (`ALLOW_DEV_AUTH=true`)        |

---

## Setup & Testing

```bash
# Setup & Seed
cp .env.example .env
createdb remote_rupiah
psql -d remote_rupiah -f db/schema.sql -f db/seed.sql

# Build & Run
deno task build:frontend
deno task serve:backend       # http://localhost:8000
deno task serve:frontend      # http://localhost:8010

# Tests
deno task validate:backend    # API integration & Zod mapper tests
deno task validate:frontend   # Elm unit & property fuzz tests

```

## Known Limitations

- Production OAuth flow is pending (uses `ALLOW_DEV_AUTH` JWT route).
- Provider auto-parsers cover Wise, Revolut, and PayPal.
- Compliance cron alerts log to stdout.

## License

[GNU GPL v3.0](LICENSE)
