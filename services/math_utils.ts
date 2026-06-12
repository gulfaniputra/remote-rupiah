export type Currency = bigint;

export const parseAmount = (s: string): Currency => {
  // Detect format by checking which separator comes last (that's the decimal)
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  const normalized = lastComma > lastDot
    // European: . is thousands sep, , is decimal → remove ., replace , with .
    ? s.replace(/\./g, "").replace(",", ".")
    // US or plain: , is thousands sep (or absent) → just remove commas
    : s.replace(/,/g, "");
  const [i, f = ""] = normalized.split(".");
  return BigInt((i || "0") + f.padEnd(2, "0").slice(0, 2));
};

export const parseSafeRate = (rate: string): Currency => {
  const normalized = rate.trim();
  if (!/^-?[\d.,]+$/.test(normalized)) {
    throw new Error(`Invalid rate format: ${rate}`);
  }

  const value = normalized.includes(",") && normalized.includes(".")
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized.includes(",")
    ? normalized.replace(",", ".")
    : normalized;

  if ((value.match(/\./g) ?? []).length > 1) {
    throw new Error(`Invalid rate format: ${rate}`);
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  if (!/^\d+(\.\d+)?$/.test(unsigned)) {
    throw new Error(`Invalid rate format: ${rate}`);
  }

  const [int = "0", frac = ""] = unsigned.split(".");
  const cents = BigInt((int || "0").replace(/^0+(?=\d)/, "") || "0") * 100n +
    BigInt(frac.padEnd(3, "0").slice(0, 2));
  const rounded = frac.padEnd(3, "0").slice(2, 3) >= "5" ? cents + 1n : cents;
  return negative ? -rounded : rounded;
};
