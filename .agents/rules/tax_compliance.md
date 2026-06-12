---
trigger: "frontend/src/TaxLogic.elm, docs/spec.md"
---

# Tax Compliance Governance: Indo-US UU HPP (2026 Edition)

**Context:** You are generating or modifying calculations within the core
financial compliance domain. Errors in these rules lead directly to systemic
non-compliance with the Directorate General of Taxes (DJP). Follow these rules
defensively.

## 1. Currency Conversion (Kurs Menteri Keuangan)

- **Conversion Precedence:** Convert all Foreign Currency (e.g., USD from
  Wise/PayPal) to IDR using the exact integer weekly KMK rate _before_ running
  any tax deduction calculations.
- **Zero Drift Protection:** Use precise integer math for the rate exchange
  scale factor. All final currency values must remain anchored in the opaque
  `Money` integer cents/subunits representation.

## 2. PPh 24 (Foreign Tax Credit Limits)

- **The "Lesser of" Invariant:** The maximum deductible credit allowed under PPh
  24 must always be computed as the minimum of:
  1. The actual tax withheld by the foreign country (e.g., 10% or 30% US WHT on
     Form 1042-S).
  2. The statutory PPh 24 maximum cap formula:
     `(Foreign Net Income / Total Taxable Income) * Total Tax Due`.
- **Defensive Math:** You must explicitly prevent division-by-zero errors. If
  `TotalTaxableIncome` is `<= 0`, bypass the ratio computation and return an
  explicit `Result` wrapper (e.g., `Ok 0` or a type-safe
  `Result TaxError Money`).
- **Conservative Rounding:** Apply `Basics.floor` to the final PPh 24 maximum
  cap calculation. Never round tax credits up; over-claiming credits violates
  DJP compliance.

## 3. NPPN Execution (Norma KLU 62010)

- **Multiplier Constraint:** For Indonesian remote software development
  contractors (KLU 62010), the net income calculation utilizes a fixed 50% Norma
  multiplier on Gross (Bruto) revenues.
- **Pure Integer Execution:** Never use a float multiplier (like `0.5`). Compute
  this exclusively using integer operations: `(grossIncomeInCents * 50) // 100`.

## 4. Progressive Brackets & PTKP Injection

- **No Hardcoded Constants:** You are strictly forbidden from hardcoding static
  numeric thresholds for Penghasilan Tidak Kena Pajak (PTKP) limits (e.g., TK/0,
  K/0 values) or PPh Pasal 17 progressive brackets directly inside functions.
- **Injectable Context:** Always pass structural record configurations
  containing current thresholds and historical rates as input arguments to
  computation handlers to preserve multi-year validity.
- **TER Compliance:** When calculating monthly interim tax obligations, utilize
  the mandatory progressive TER (Tarif Efektif Rata-Rata) tables categorized
  strictly by the user's formal PTKP status.

## 5. Compliance Verification Verification

- **Form 1042-S Match:** Income originating from US counterparties cannot be
  factored into PPh 24 calculations unless its companion record explicitly has
  the `is_1042s_verified` status flag set to `True`. Treat unverified
  withholding strictly as uncredited gross foreign revenue.

## 6. Discrepancy Reporting

- Ground all transactional logic directly in **UU HPP**. If any requested
  feature change or user instruction contradicts the implementation formulas
  listed in `docs/spec.md`, immediately halt execution and request a human
  confirmation.
