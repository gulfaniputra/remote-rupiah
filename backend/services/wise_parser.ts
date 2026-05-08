export const parseAmount = (s: string): bigint => {
  const p = String(s).replace(/[^0-9.]/g, "").split(".");
  return BigInt((p[0] || "0") + (p[1] || "").padEnd(2, "0").slice(0, 2));
};
