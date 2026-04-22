# remote-rupiah

Remote Rupiah is an automated financial compliance engine tailored for the Indonesian Digital Nomad and Remote Professional markets.

It solves the high-friction problem of international double-taxation (US/ID) and FX leakage for high-income Indonesian remote workers.

## Table of Contents

- [Strategic Value Proposition](#strategic-value-proposition)
- [Industrial-Grade Tech Stack](#industrial-grade-tech-stack)
- [Financial Protocols](#financial-protocols)
- [Interactive Demo & Local Setup](#interactive-demo--local-setup)
  - [Prerequisites](#prerequisites)
  - [Environment & DB](#environment--db)

## Strategic Value Proposition

- **The Compliance Engine:** Deep implementation of Indonesian Tax Law (UU HPP), including KLU 62010 (Norma) and PPh 24 credit caps.
- **Architectural Safety:** Built with **Elm** and **PostgreSQL RLS** to ensure that financial calculations are mathematically perfect and data is cryptographically isolated by design.
- **Market Niche:** Directly targets the growing segment of Indonesian talent working for US entities. A high-LTV user base with specific legal reporting requirements.

## Industrial-Grade Tech Stack

| Layer        | Technology    | Rationale                                                |
| :----------- | :------------ | :------------------------------------------------------- |
| **Frontend** | Elm 0.19.1    | Opaque types ensure 100% precision in financial logic    |
| **Backend**  | Deno 2.2+     | Native JSR support and secure-by-default sandbox         |
| **DB**       | PostgreSQL 17 | Enterprise-tier RLS for multi-tenant data isolation      |
| **API**      | Hono 4.x      | Lightweight middleware for Deno Deploy/Edge environments |

## Financial Protocols

1.  **Precision:** `Float` is banned for currency calculations. All values are stored and manipulated as `Int` (cents).
2.  **Compliance:** Automatic application of **KLU 62010 (50%)** for software development (Norma Penghitungan Penghasilan Netto).
3.  **PPh 24 Logic:** Implements the "Lesser of" rule to prevent double-taxation on US-source income: `(ForeignNet / TotalTaxable) * TotalTaxDue`.
4.  **Audit Trail:** Every transaction is timestamped with the official **KMK (Kurs Menteri Keuangan)** rate valid for that week.

## Interactive Demo & Local Setup

### Prerequisites

- **Deno 2.2+**
- **Elm 0.19.1**
- **PostgreSQL 17**

### Environment & DB

```bash
# Setup environment variables
cp .env.example .env

# Initialize schema and RLS policies
psql -d remote_rupiah -f db/schema.sql

# Populate with mock US 1042-S transaction data for testing
psql -d remote_rupiah -f db/seed.sql
```
