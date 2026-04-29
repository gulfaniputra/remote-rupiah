export const parseAmount = (s: string): bigint => {
  const [i, f = ""] = s.replace(/,/g, "").split(".");
  return BigInt((i || "0") + f.padEnd(2, "0").slice(0, 2));
};

export const toIdr = (c: bigint, r: bigint): bigint => (c * r) / 100n;
