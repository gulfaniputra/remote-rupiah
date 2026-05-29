---
trigger: always_on
---

---

## trigger: "frontend/src/TaxLogic.elm, docs/spec.md"

# Rule: Indo-US Tax Compliance (UU HPP 2026)

**Context:** You are implementing high-stakes financial logic. Errors in these
formulas result in legal non-compliance.

## 1. Currency Conversion (KMK)

- **Rate Source:** Use the weekly Kurs Menteri Keuangan (KMK) rate associated
  with the transaction date.
- **Calculation:** Convert Foreign Currency to IDR using integer multiplication
  _before_ any tax deduction.

## 2. PPh 24 (Foreign Tax Credit)

- **The "Lesser of" Rule:** The deductible credit is the minimum of:
  1. Actual tax paid to the foreign country (e.g., 10% US WHT).
  2. The PPh 24 Cap: `(ForeignNetIncome / TotalTaxableIncome) * TotalTaxDue`.
- **Rounding:** Use `Basics.floor` for the cap result. We never round up tax
  credits to avoid over-claiming.
- **Safety:** If `TotalTaxableIncome` is zero, return a `Result.Err` or handle
  as 0; never allow division by zero.

## 3. NPPN (Norma KLU 62010)

- **Software Development:** Use a fixed 50% multiplier on Bruto income to
  determine Net Income.
- **Zero-Float:** Perform this using `(income * 50) // 100` to ensure no
  floating-point drift.

## 4. Compliance Evidence

- **Verification:** All income from US sources must have the `1042s_verified`
  boolean set to `True` before it is included in final PPh 24 calculations.

## 5. References

- Ground all logic in **UU HPP (Harmonisasi Peraturan Perpajakan)**. If a
  formula deviates from the spec.md, alert the developer immediately.
