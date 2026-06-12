/**
 * NPPN (Norm Penghitungan Penghasilan Netto) calculation for software
 * engineering freelance income (KLU 62010).
 *
 * Per DJP regulation, the effective business overhead norm is 50%,
 * meaning Net Income = Bruto × 50 / 100.
 */

/**
 * Calculate net income using NPPN 50% norm.
 * @param grossCents - Gross income in IDR cents (as bigint)
 * @returns Net income in IDR cents (as bigint)
 */
export function calculateNppn(grossCents: bigint): bigint {
  return (grossCents * 50n) / 100n;
}
