---
trigger: "db/**, *.sql"
---

# Database Governance: PostgreSQL 17

**Context:** You are generating or modifying database schemas, migrations, or
queries for Remote Rupiah. Follow these structural constraints strictly to
preserve multi-tenancy and edge data integrity.

## 1. Append-Only Schema Migrations

- **Never Overwrite History:** Do not modify, rename, or delete any executed
  `.sql` migration files located in `db/`.
- **Sequential Execution:** All structural changes, index additions, or seeding
  adjustments must be written as a completely new, sequentially numbered
  migration file (e.g., `db/migrations/000X_your_feature.sql`).
- **Transaction Safety:** Wrap all migration scripts explicitly inside a
  `BEGIN;` and `COMMIT;` block to ensure atomic rollbacks on failure.

## 2. Multi-Tenant Row-Level Security (RLS)

- **RLS Guardrails:** You are strictly forbidden from executing
  `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` or dropping isolation policies on
  any production tables.
- **Tenant Context Isolation:** Every tenant table must have an RLS policy tied
  to transaction local memory via
  `current_setting('app.current_user_id', true)`.
- **Anti-Slop Querying:** Do not add explicit `WHERE user_id = ...` conditions
  to standard queries if it is already handled by the database RLS engine. Let
  the RLS layer handle data scoping natively.

## 3. Strict Data-Type Discipline

- **The Currency Metric:** Always use `BIGINT` to store currency values as
  cents/subunits. Never use `NUMERIC`, `DECIMAL`, `REAL`, or `FLOAT` for cash
  balances.
- **Exchange Rates & Ratios:** Use `NUMERIC(12, 4)` or equivalent precision
  _only_ for intermediate multipliers such as currency exchange rates (Kurs
  Menteri Keuangan / KMK) or tax percentages.
- **Modern Primary Keys:** Avoid legacy `SERIAL` or `BIGSERIAL` type
  constraints. Use modern PostgreSQL 17 compliant identity columns:
  `GENERATED ALWAYS AS IDENTITY`.

## 4. Query & Indexing Guardrails

- **Index Requirement:** Every foreign key column must have an explicitly
  declared index (`CREATE INDEX CONCURRENTLY` if applicable) to optimize
  relational lookups on large multi-tenant collections.
- **Lowercase Enforcement:** Write all database identifiers (table names, column
  names, constraints, and schemas) using strict lowercase snake_case format.
