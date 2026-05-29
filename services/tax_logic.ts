/**
 * DJP Compliance Logic (UU HPP 2026)
 *
 * NOTE: These formulas MUST match frontend/src/TaxLogic.elm exactly.
 * All currency values are in cents (BIGINT).
 */

/**
 * NPPN (Norma Penghitungan Penghasilan Netto) for KLU 62010 (Software Development).
 * Fixed 50% multiplier on Bruto income.
 */
export function calculateNppn(brutoCents: bigint): bigint {
  return (brutoCents * 50n) / 100n;
}

/**
 * PPh 24 Foreign Tax Credit Limit.
 * (ForeignNetIncome / TotalTaxableIncome) * TotalTaxDue
 */
export function calculatePPh24Cap(
  foreignNetIncomeCents: bigint,
  totalTaxableIncomeCents: bigint,
  totalTaxDueCents: bigint,
): bigint {
  if (totalTaxableIncomeCents === 0n) return 0n;
  return (foreignNetIncomeCents * totalTaxDueCents) / totalTaxableIncomeCents;
}
