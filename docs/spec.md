# MASTER SPECIFICATION: REMOTE-RUPIAH (APRIL 2026)

## 1. MISSION CRITICAL GOAL

- [ ] Build a personal finance and tax dashboard for an **Indonesian Individual
      Remote Developer (NPWP Pribadi)** with **100% US-based clients**.
      <!-- Core dashboard exists (Main.elm, Dashboard.elm) with transaction listing, tax logic, FX tracking, and compliance status. However, the end-to-end product goal is not fully verified from the codebase — missing: user onboarding flow, authentication UI, production deployment config, and end-to-end integration tests. -->
- [x] **Primary Value:** Identify "monetary leaks" (FX spreads) and automate
      Indonesian tax reporting using **NPPN (Norma)** and **PPh 24 (Foreign Tax
      Credit)**.
      <!-- Implemented: FX leak calculation in TaxLogic.elm (calculateFXLeakage), forecast route computes avg_fx_spread_cents, Dashboard.elm displays FX leakage. NPPN and PPh 24 logic in TaxLogic.elm and services/tax_logic.ts. -->
- [ ] **Compliance Target:** DJP (Indonesia) **Coretax Portal** alignment and
      US-Indonesia Tax Treaty (W-8BEN) monitoring.
      <!-- Coretax CSV export exists (routes/export_djp.ts, DJPCsvExporter.elm) with streaming CSV generation. W-8BEN status tracking exists (compliance.ts, compliance_cron.ts, Dashboard.elm evidence locker). Missing: automated treaty monitoring workflows, Coretax portal direct integration, and W-8BEN renewal reminders. -->

## 2. ARCHITECTURAL STACK & CONSTRAINTS

- [x] **Frontend:** Elm 0.19.1.
      <!-- Confirmed: elm.json specifies "elm-version": "0.19.1" -->
- [x] **Backend:** Deno 2.2+ with Hono 4.x (Strict TypeScript 5.8+).
      <!-- Confirmed: deno.json imports "hono": "npm:hono@^4.2.1". TypeScript strict mode implied by Deno defaults. -->
- [x] **Database:** PostgreSQL 17+ with Row-Level Security (RLS).
      <!-- Confirmed: db/client.ts uses postgres npm package. Migration 005_create_transactions.sql enables RLS. withAuth() sets app.current_user_id for RLS context. -->
- [ ] **Constraint (The "Money" Rule):** \* **DO NOT USE `Float`** for currency.
      <!-- Currency math is mostly BigInt-based (Money.elm wraps BigInt, services use bigint). However, routes/forecast.ts line 22 uses `(kmk_rate * 100)::bigint` which involves implicit numeric multiplication before cast. routes/export_djp.ts line 85 uses `(amountCents * rate) / 10000n` which is safe. The forecast route's `AVG(...)` SQL function returns a float that gets cast to text — this is a potential float boundary issue. -->
  - [x] Create an **Opaque `Money` Type** in Elm wrapping a `BIGINT`
        (Cents/Unit).
        <!-- Confirmed: Money.elm defines `type Money c = Money BigInt` with encode/decode using string serialization. -->
  - [ ] Logic must reside in a pure `TaxLogic.elm` module with 100% unit test
        coverage (`elm-test`).
        <!-- TaxLogic.elm exists with NPPN, PPh 24, progressive tax brackets. Tests exist (TaxLogicTests.elm, TaxLogicFuzzTest.elm, SPTLogicTests.elm, TaxTests.elm) but 100% coverage is not proven — missing tests for: calculateFXLeakage, calculateFinalPayable, generateTaxReport, projectYearEndLiability edge cases. -->

## 3. FINANCIAL & TAX LOGIC (APRIL 2026 RULES)

### A. Income & NPPN Logic

- [x] **NPPN (KLU 62010):** Taxable Profit = `Gross_IDR * 0.50`.
      <!-- Confirmed: TaxLogic.elm calculateNppn = Money.divide (Money.multiply m 50) 100. services/tax_logic.ts calculateNppn = (brutoCents * 50n) / 100n. -->
- [x] **KMK Rate Precision:** Every transaction must fetch the **Kurs Menteri
      Keuangan** valid for the specific week of receipt. (Note: KMK rates rotate
      every Wednesday).
      <!-- Confirmed: services/kmk.ts lookupKmkRate queries by date range. kmk_cron.ts schedules syncs around Wednesday rotation. routes/transactions.ts auto-fetches KMK rate on POST. -->
- [x] **2026 Progressive Brackets:**
  - [x] 5% (0 - 60M) | 15% (60M - 250M) | 25% (250M - 500M) | 30% (500M - 5B) |
        35% (> 5B).
        <!-- Confirmed: TaxLogic.elm defaultBrackets uses fromCentsStr values: 60,000,000.00 IDR, 250,000,000.00 IDR, 500,000,000.00 IDR, 5,000,000,000.00 IDR with rates 500, 1500, 2500, 3000, 3500 basis points. -->

### B. The PPh 24 (Foreign Tax Credit) Cap

- [x] The agent MUST implement the "Lesser of" rule for US Withholding (10% via
      W-8BEN). The allowed credit is the **minimum** of:
  1. Actual US Tax Paid (10% of Gross USD).
  2. The specific Indonesian Tax due on that foreign income.
  3. The total Indonesian Tax liability for the year.
  <!-- Confirmed: TaxLogic.elm calculatePPh24 implements min of foreignTaxPaid vs proportion(totalTax, foreignIncome, totalIncome). services/tax_logic.ts calculatePPh24Cap implements the proportional formula. -->
- [x] **Formula for Cap:**
      $CreditLimit = \frac{ForeignNetIncome}{TotalTaxableIncome} \times TotalIndonesianTaxDue$
      <!-- Confirmed: TaxLogic.elm calculatePPh24 uses Money.proportion. services/tax_logic.ts line 26: (foreignNetIncomeCents * totalTaxDueCents) / totalTaxableIncomeCents. -->

### C. FX Efficiency Tracking

- [x] **Leak Calculation:**
      `Leak = (USD * Mid-Market Rate) - Actual IDR Received`.
      <!-- Confirmed: TaxLogic.elm calculateFXLeakage = Money.subtract (calculateIdrValue m r) act. routes/forecast.ts computes spread_cents as ((amount_cents * (kmk_rate * 100)::bigint / 100) - actual_idr_received_cents). -->
- [ ] Compare Wise, Revolut, Payoneer, and PayPal performance over time.
      <!-- Wise, Revolut, and PayPal parsers exist (services/ingestion/). Payoneer parser is not present. The FX efficiency route (forecast.ts) includes source from metadata, but there is no aggregated comparison view across providers. -->

## 4. FEATURE SPECIFICATIONS

- [ ] **Smart CSV Ingestion:** Auto-map CSVs from Wise, Revolut, Payoneer,
      PayPal, BCA, Mandiri, and BNI.
      <!-- Wise, Revolut, and PayPal are supported (detector.ts, wise_parser.ts, revolut_parser.ts, paypal_parser.ts). Payoneer, BCA, Mandiri, and BNI parsers are not implemented. -->
- [x] **Fuzzy Field Mapper:** If a CSV header is unknown, provide a UI to map
      fields to the internal schema.
      <!-- Confirmed: CsvMapper.elm provides a UI for mapping unknown headers. routes/ingest.ts returns 428 with headers when mapping is required. backend/src/services/ingestion/csv-mapper.ts handles mapping logic. -->
- [ ] **Compliance Checklist:** \* NPPN Notification Deadline: **March 31st**.
      <!-- NPPN deadline tracking exists: compliance.ts getNppnStatus computes deadline, Dashboard.elm viewNppnAlert shows warnings. compliance_cron.ts scans for missing notifications. Missing: dedicated deadline workflow UI, automated reminder system (email/push), and explicit "NPPN filed" confirmation flow in the frontend. -->
  - [x] Evidence Locker: Store metadata for **Form 1042-S** (US Tax Document).
        <!-- Confirmed: compliance.ts upsertDocument stores 1042s documents. Dashboard.elm evidenceLockerPanel displays document status. compliance_documents table exists in migration 20260605_add_compliance_tables.sql. -->
- [x] **Unrealized Gain Tracker:** Calculate IDR gain/loss on USD balances held
      in foreign wallets (Wise/Paypal) at current market rates.
      <!-- Confirmed: services/wealth/unrealized.ts implements FIFO-based unrealized gain calculation. routes/wealth.ts exposes /unrealized endpoint. Dashboard.elm displays unrealized gains. -->

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

<!-- The schema is implemented across multiple migrations (005_create_transactions.sql, 008_add_verified_at.sql, 014_add_transactions_metadata_source_index.sql). The actual schema includes additional fields: source_tx_id (for idempotency), verified_at timestamp. RLS is enabled. The user_isolation_policy uses app.current_user_id set via withAuth() rather than auth.uid(). -->

## 6. AGENT EXECUTION PROTOCOL

- [x] **Step 1:** Generate the PostgreSQL schema and Hono API boilerplate for
      transaction CRUD.
      <!-- Confirmed: routes/transactions.ts implements full CRUD (GET list, POST create, GET by id, PATCH verify). DB migrations exist. -->
- [x] **Step 2:** Build the `Money.elm` and `TaxLogic.elm` modules. Write unit
      tests for the PPh 24 cap logic.
      <!-- Confirmed: Money.elm and TaxLogic.elm exist. Tests exist (TaxLogicTests.elm, TaxLogicFuzzTest.elm, MoneyTest.elm, MoneySignTest.elm, PrecisionTest.elm). -->
- [ ] **Step 3:** Implement the KMK Rate Fetcher (Deno Cron) and the CSV
      Ingestion Engine.
      <!-- KMK syncing exists (services/kmk.ts, kmk_cron.ts with primary/fallback/backfill schedules). CSV ingestion exists but is partial: only Wise, Revolut, and PayPal are supported. Payoneer, BCA, Mandiri, BNI are missing. -->
- [x] **Step 4:** Build the "Forecasting" dashboard using Elm's strict types.
      <!-- Confirmed: routes/forecast.ts provides YTD aggregation and FX efficiency data. Dashboard.elm displays tax projections, FX leakage, and unrealized gains. -->
