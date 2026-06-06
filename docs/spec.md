# MASTER SPECIFICATION: REMOTE-RUPIAH (APRIL 2026)

## 1. MISSION CRITICAL GOAL

- [ ] Build a personal finance and tax dashboard for an **Indonesian Individual
      Remote Developer (NPWP Pribadi)** with **100% US-based clients**.
      <!-- Core dashboard exists, but the end-to-end product goal is not fully verified from the codebase -->
- [x] **Primary Value:** Identify "monetary leaks" (FX spreads) and automate
      Indonesian tax reporting using **NPPN (Norma)** and **PPh 24 (Foreign Tax
      Credit)**.
- [ ] **Compliance Target:** DJP (Indonesia) **Coretax Portal** alignment and
      US-Indonesia Tax Treaty (W-8BEN) monitoring.
      <!-- Coretax export and W-8BEN status exist, but treaty monitoring and compliance workflows are only partially implemented -->

## 2. ARCHITECTURAL STACK & CONSTRAINTS

- [x] **Frontend:** Elm 0.19.1.
- [x] **Backend:** Deno 2.2+ with Hono 4.x (Strict TypeScript 5.8+).
- [x] **Database:** PostgreSQL 17+ with Row-Level Security (RLS).
- [ ] **Constraint (The "Money" Rule):** \* **DO NOT USE `Float`** for currency.
      <!-- Currency math is mostly BigInt-based, but there are still numeric conversions and generated JS paths that still need stricter verification -->
  - [x] Create an **Opaque `Money` Type** in Elm wrapping a `BIGINT`
        (Cents/Unit).
  - [ ] Logic must reside in a pure `TaxLogic.elm` module with 100% unit test
        coverage (`elm-test`).
        <!-- TaxLogic.elm and tests exist, but 100% coverage is not proven here -->

## 3. FINANCIAL & TAX LOGIC (APRIL 2026 RULES)

### A. Income & NPPN Logic

- [x] **NPPN (KLU 62010):** Taxable Profit = `Gross_IDR * 0.50`.
- [x] **KMK Rate Precision:** Every transaction must fetch the **Kurs Menteri
      Keuangan** valid for the specific week of receipt. (Note: KMK rates rotate
      every Wednesday).
- [x] **2026 Progressive Brackets:**
  - [x] 5% (0 - 60M) | 15% (60M - 250M) | 25% (250M - 500M) | 30% (500M - 5B) |
        35% (> 5B).

### B. The PPh 24 (Foreign Tax Credit) Cap

- [x] The agent MUST implement the "Lesser of" rule for US Withholding (10% via
      W-8BEN). The allowed credit is the **minimum** of:
  1. Actual US Tax Paid (10% of Gross USD).
  2. The specific Indonesian Tax due on that foreign income.
  3. The total Indonesian Tax liability for the year.
- [x] **Formula for Cap:**
      $CreditLimit = \frac{ForeignNetIncome}{TotalTaxableIncome} \times TotalIndonesianTaxDue$

### C. FX Efficiency Tracking

- [x] **Leak Calculation:**
      `Leak = (USD * Mid-Market Rate) - Actual IDR Received`.
- [ ] Compare Wise, Revolut, Payoneer, and PayPal performance over time.
      <!-- Wise, Revolut, and PayPal are wired; Payoneer comparison is not present -->

## 4. FEATURE SPECIFICATIONS

- [ ] **Smart CSV Ingestion:** Auto-map CSVs from Wise, Revolut, Payoneer,
      PayPal, BCA, Mandiri, and BNI.
      <!-- Wise, Revolut, and PayPal are supported; the remaining sources are not -->
- [x] **Fuzzy Field Mapper:** If a CSV header is unknown, provide a UI to map
      fields to the internal schema.
- [ ] **Compliance Checklist:** \* NPPN Notification Deadline: **March 31st**.
      <!-- No dedicated deadline workflow or reminder automation is present in the codebase -->
  - [x] Evidence Locker: Store metadata for **Form 1042-S** (US Tax Document).
- [x] **Unrealized Gain Tracker:** Calculate IDR gain/loss on USD balances held
      in foreign wallets (Wise/Paypal) at current market rates.

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

## 6. AGENT EXECUTION PROTOCOL

- [x] **Step 1:** Generate the PostgreSQL schema and Hono API boilerplate for
      transaction CRUD.
- [x] **Step 2:** Build the `Money.elm` and `TaxLogic.elm` modules. Write unit
      tests for the PPh 24 cap logic.
- [ ] **Step 3:** Implement the KMK Rate Fetcher (Deno Cron) and the CSV
      Ingestion Engine.
      <!-- KMK syncing exists, but CSV ingestion is only partial across the full list of providers -->
- [x] **Step 4:** Build the "Forecasting" dashboard using Elm's strict types.
