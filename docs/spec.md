# MASTER SPECIFICATION: REMOTE-RUPIAH (APRIL 2026)

## 1. MISSION CRITICAL GOAL

- [ ] Build a personal finance and tax dashboard for an **Indonesian Individual
      Remote Developer (NPWP Pribadi)** with **100% US-based clients**.
      <!-- Core dashboard exists (Main.elm, Dashboard.elm) with transaction listing, tax logic, FX tracking, and compliance status. Missing: user onboarding flow, authentication UI (token stored in localStorage with no login screen), production deployment config, and end-to-end integration tests. -->
- [x] **Primary Value:** Identify "monetary leaks" (FX spreads) and automate
      Indonesian tax reporting using **NPPN (Norma)** and **PPh 24 (Foreign Tax
      Credit)**.
      <!-- Confirmed: FX leak calculation in TaxLogic.elm (calculateFXLeakage), forecast route computes avg_fx_spread_cents, Dashboard.elm displays FX leakage. NPPN and PPh 24 logic in TaxLogic.elm and services/tax_logic.ts. -->
- [ ] **Compliance Target:** DJP (Indonesia) **Coretax Portal** alignment and
      US-Indonesia Tax Treaty (W-8BEN) monitoring.
      <!-- Coretax CSV export exists (routes/export_djp.ts, DJPCsvExporter.elm) with streaming CSV generation. W-8BEN status tracking exists (compliance.ts getComplianceStatus reads w8ben_expiry_date and derives Valid/Expired/Missing). compliance_cron.ts scans for expired/expiring W-8BENs. Dashboard.elm evidence locker displays document status. Missing: automated treaty monitoring workflows (no notification delivery), Coretax portal direct API integration, and W-8BEN renewal reminder system (cron only logs to console, no push/email). -->

## 2. ARCHITECTURAL STACK & CONSTRAINTS

- [x] **Frontend:** Elm 0.19.1.
      <!-- Confirmed: elm.json specifies "elm-version": "0.19.1". Also verified via elm.json (root-level) which mirrors the same version. -->
- [x] **Backend:** Deno 2.2+ with Hono 4.x (Strict TypeScript 5.8+).
      <!-- Confirmed: deno.json imports "hono": "npm:hono@^4.2.1". TypeScript strict mode implied by Deno defaults. -->
- [x] **Database:** PostgreSQL 17+ with Row-Level Security (RLS).
      <!-- Confirmed: db/client.ts uses postgres npm package. Migration 005_create_transactions.sql enables RLS. withAuth() sets app.current_user_id for RLS context via SET LOCAL. All operational tables (transactions, user_tax_profiles, field_mappings, csv_mappings, compliance_documents) have ENABLE ROW LEVEL SECURITY. -->
- [ ] **Constraint (The "Money" Rule):** \* **DO NOT USE `Float`** for currency.
      <!-- Currency math is predominantly BigInt-based (Money.elm wraps BigInt, services use bigint). However, routes/forecast.ts line 22 uses `(kmk_rate * 100)::bigint` in SQL — the `kmk_rate` column in the DB is NUMERIC(15,2), so this involves implicit float multiplication before the cast to bigint. routes/export_djp.ts line 85 uses `(amountCents * rate) / 10000n` which is safe. The forecast route's `AVG(...)` SQL function returns a float that gets cast to text — this is a potential float boundary issue at the SQL level. services/matcher.ts uses Float (Double) for confidence scores and Jaro-Winkler distance (correct, as these aren't currency values). -->
  - [x] Create an **Opaque `Money` Type** in Elm wrapping a `BIGINT`
        (Cents/Unit).
        <!-- Confirmed: Money.elm defines `type Money c = Money BigInt` with encode/decode using string serialization. All monetary JSON values are transmitted as strings. -->
  - [ ] Logic must reside in a pure `TaxLogic.elm` module with 100% unit test
        coverage (`elm-test`).
        <!-- TaxLogic.elm exists with NPPN, PPh 24, progressive tax brackets. Tests exist (TaxLogicTests.elm, TaxLogicFuzzTest.elm, SPTLogicTests.elm, TaxTests.elm) but 100% coverage is not proven. Missing tests for: calculateFXLeakage (only 2 unit tests, no fuzz), calculateFinalPayable (only 2 tests), generateTaxReport (only 2 tests — "neg" and "cap"), projectYearEndLiability edge cases. The `.clinerules` file requires "exhaustive property-based Fuzz testing" for TaxLogic.elm. -->

## 3. FINANCIAL & TAX LOGIC (APRIL 2026 RULES)

### A. Income & NPPN Logic

- [x] **NPPN (KLU 62010):** Taxable Profit = `Gross_IDR * 0.50`.
      <!-- Confirmed: TaxLogic.elm calculateNppn = Money.divide (Money.multiply m 50) 100. services/tax_logic.ts calculateNppn = (brutoCents * 50n) / 100n. Both align exactly. -->
- [x] **KMK Rate Precision:** Every transaction must fetch the **Kurs Menteri
      Keuangan** valid for the specific week of receipt. (Note: KMK rates rotate
      every Wednesday).
      <!-- Confirmed: services/kmk.ts lookupKmkRate queries by date range between valid_from and valid_until. kmk_cron.ts schedules primary sync Tue 18:00 UTC, fallback Wed 06:00 UTC, and weekly backfill. routes/transactions.ts auto-fetches KMK midRate on POST via lookupKmkRate(). services/kmk_resolver.ts resolveKmkWeek() correctly computes the Wednesday anchor. -->
- [x] **2026 Progressive Brackets:**
  - [x] 5% (0 - 60M) | 15% (60M - 250M) | 25% (250M - 500M) | 30% (500M - 5B) |
        35% (> 5B).
        <!-- Confirmed: TaxLogic.elm defaultBrackets uses fromCentsStr values: 60,000,000.00 IDR, 250,000,000.00 IDR, 500,000,000.00 IDR, 5,000,000,000.00 IDR with rates 500, 1500, 2500, 3000, 3500 basis points (i.e., 5%, 15%, 25%, 30%, 35%). -->

### B. The PPh 24 (Foreign Tax Credit) Cap

- [x] The agent MUST implement the "Lesser of" rule for US Withholding (10% via
      W-8BEN). The allowed credit is the **minimum** of:
  1. Actual US Tax Paid (10% of Gross USD).
  2. The specific Indonesian Tax due on that foreign income.
  3. The total Indonesian Tax liability for the year.
  <!-- Confirmed: TaxLogic.elm calculatePPh24 implements min of foreignTaxPaid vs proportion(totalTax, foreignIncome, totalIncome). The clinerules adds a further safeguard: if is_1042s_verified is FALSE, PPh_24_Kredit_IDR evaluates to 0n (enforced in export_djp.ts line 90-92). -->
- [x] **Formula for Cap:**
      $CreditLimit = \frac{ForeignNetIncome}{TotalTaxableIncome} \times TotalIndonesianTaxDue$
      <!-- Confirmed: TaxLogic.elm calculatePPh24 uses Money.proportion (BigInt.div (BigInt.mul b n) d). services/tax_logic.ts line 26: (foreignNetIncomeCents * totalTaxDueCents) / totalTaxableIncomeCents. Both match. -->

### C. FX Efficiency Tracking

- [x] **Leak Calculation:**
      `Leak = (USD * Mid-Market Rate) - Actual IDR Received`.
      <!-- Confirmed: TaxLogic.elm calculateFXLeakage = nonNegative (subtract expectedIdr act). routes/forecast.ts computes spread_cents as ((amount_cents * (kmk_rate * 100)::bigint / 100) - actual_idr_received_cents). -->
- [ ] Compare Wise, Revolut, Payoneer, and PayPal performance over time.
      <!-- Wise, Revolut, and PayPal parsers exist (services/ingestion/wise_parser.ts, revolut_parser.ts, paypal_parser.ts). Payoneer parser is not present. The FX efficiency route (forecast.ts /fx-efficiency) includes metadata->>'source' in the response, and Dashboard.elm aggregates total FX leakage, but there is no aggregated comparison chart or per-provider breakdown view across providers in either the API or the frontend. -->

## 4. FEATURE SPECIFICATIONS

- [ ] **Smart CSV Ingestion:** Auto-map CSVs from Wise, Revolut, Payoneer,
      PayPal, BCA, Mandiri, and BNI.
      <!-- Wise, Revolut, and PayPal are supported (services/ingestion/detector.ts, wise_parser.ts, revolut_parser.ts, paypal_parser.ts). Payoneer, BCA, Mandiri, and BNI parsers are not implemented. The detector.ts only checks for Wise, Revolut, and PayPal header patterns. -->
- [x] **Fuzzy Field Mapper:** If a CSV header is unknown, provide a UI to map
      fields to the internal schema.
      <!-- Confirmed: CsvMapper.elm provides a UI for mapping unknown headers. routes/ingest.ts returns 428 with headers array when mapping is required and no saved mapping exists. backend/src/services/ingestion/csv-mapper.ts handles mapping logic for unknown CSVs routes. backend/src/routes/csv.ts provides GET /api/csv/map and POST /api/csv/map endpoints. services/matcher.ts provides Jaro-Winkler fuzzy matching for field suggestions. -->
- [ ] **Compliance Checklist:** \* NPPN Notification Deadline: **March 31st**.
      <!-- NPPN deadline tracking exists: compliance.ts getNppnStatus computes deadline as YYYY-03-31, checks nppn_notified_at, returns notified/overdue/daysRemaining. Dashboard.elm viewNppnAlert shows warnings with overdue/due-in states and a "Notify NPPN" button. compliance_cron.ts scanNppnDeadline scans for missing notifications (only warns via console, no push/email). Main.elm has NppnNotify/GotNppnNotify flow. Missing: automated reminder system with actual notification delivery (email/push), and explicit "NPPN filed" confirmation flow with tax year selection in the frontend. -->
  - [x] Evidence Locker: Store metadata for **Form 1042-S** (US Tax Document).
        <!-- Confirmed: compliance.ts upsertDocument stores 1042-s and w8ben documents. compliance_documents table exists in migration 20260605_add_compliance_tables.sql with UNIQUE (user_id, document_type, tax_year), RLS enabled. Dashboard.elm evidenceLockerPanel displays document status (type, year, verified). -->
- [x] **Unrealized Gain Tracker:** Calculate IDR gain/loss on USD balances held
      in foreign wallets (Wise/Paypal) at current market rates.
      <!-- Confirmed: services/wealth/unrealized.ts implements FIFO-based unrealized gain calculation with runFIFO, aggregate, computeUnrealized. routes/wealth.ts exposes GET /api/wealth/unrealized endpoint. Dashboard.elm displays unrealized gains via totalUnrealized. services/wealth/fifo_manager.ts handles conversion recording (spending USD from FIFO lots). -->

## 5. REFINED DATABASE SCHEMA (POSTGRESQL 17)

```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    currency CHAR(3) DEFAULT 'USD',
    amount_cents BIGINT NOT NULL, -- Opaque integer storage
    withholding_cents BIGINT DEFAULT 0,
    actual_idr_received_cents BIGINT,
    kmk_rate NUMERIC(15, 2), -- Official DJP rate for that week
    is_1042s_verified BOOLEAN DEFAULT FALSE,
    metadata JSONB -- Stores raw CSV headers for audit
);

-- RLS Guard
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_isolation_policy ON transactions
USING (user_id = auth.uid());
```

- [x] Schema implemented (with additional fields).
      <!-- The schema is implemented across multiple migrations (001_add_source_tx_id.sql, 005_create_transactions.sql, 008_add_verified_at.sql, 009_add_unrealized_gain_tracker.sql, 014_add_transactions_metadata_source_index.sql). The actual schema includes additional fields: source_tx_id (for idempotency with UNIQUE(user_id, source_tx_id)), verified_at timestamp, unspent_usd_cents (for FIFO), historical_kmk_rate_cents. RLS is enabled on all tables. The user_isolation_policy uses app.current_user_id set via withAuth() rather than auth.uid() directly — migration 007_unify_rls_context.sql bridges both contexts. Additional tables defined in schema.sql: field_mappings, user_tax_profiles. -->

## 6. AGENT EXECUTION PROTOCOL

- [x] **Step 1:** Generate the PostgreSQL schema and Hono API boilerplate for
      transaction CRUD.
      <!-- Confirmed: routes/transactions.ts implements full CRUD (GET list, POST create, GET by id, PATCH verify). DB migrations cover schema evolution (migrations 001-016). DB client (db/client.ts) implements withAuth() with RLS context. -->
- [x] **Step 2:** Build the `Money.elm` and `TaxLogic.elm` modules. Write unit
      tests for the PPh 24 cap logic.
      <!-- Confirmed: Money.elm and TaxLogic.elm exist with comprehensive functions. Tests exist (TaxLogicTests.elm with PPh24 Credit Matrix Tests, TaxLogicFuzzTest.elm, MoneyTest.elm, MoneySignTest.elm, PrecisionTest.elm, TaxTests.elm with detailed PPh24 edge cases). -->
- [ ] **Step 3:** Implement the KMK Rate Fetcher (Deno Cron) and the CSV
      Ingestion Engine.
      <!-- KMK syncing fully exists (services/kmk.ts with fetchKmkRates, upsertKmkRates, syncKmkRates, backfillKmkRates; services/kmk_cron.ts with primary/fallback/backfill schedules). CSV ingestion exists but is partial: only Wise, Revolut, and PayPal are auto-detected and parsed. Payoneer, BCA, Mandiri, BNI are missing. The CSV mapping engine (routes/ingest.ts + backend/src/services/ingestion/) handles unknown CSV formats via user-defined mappings. -->
- [x] **Step 4:** Build the "Forecasting" dashboard using Elm's strict types.
      <!-- Confirmed: routes/forecast.ts provides YTD aggregation (GET /) with ytd_gross_cents, ytd_withholding_cents, ytd_actual_idr_cents, avg_fx_spread_cents, and FX efficiency data (GET /fx-efficiency) with per-transaction spread_cents and source. Dashboard.elm displays tax projections (T.projectYearEndLiability), FX leakage total, and unrealized gains. -->
