import sql from "../db/client.ts";

export interface W8BENScanResult {
  expired: string[];
  expiringSoon: string[];
}

const WARN_DAYS_MS = 30 * 86_400_000;

const classify = (
  expiryDate: string | null,
  now: Date,
): "expired" | "soon" | "ok" => {
  if (!expiryDate) return "ok";
  const diffMs = new Date(expiryDate).getTime() - now.getTime();
  return diffMs < 0 ? "expired" : diffMs <= WARN_DAYS_MS ? "soon" : "ok";
};

export const scanExpiredW8BEN = async (): Promise<W8BENScanResult> => {
  const rows = await sql`
    SELECT user_id::text, w8ben_expiry_date::text
    FROM user_tax_profiles
    WHERE w8ben_expiry_date IS NOT NULL
  `;

  const now = new Date();
  return rows.reduce<W8BENScanResult>(
    (acc, r) => {
      const verdict = classify(r.w8ben_expiry_date ?? null, now);
      return verdict === "expired"
        ? { ...acc, expired: [...acc.expired, r.user_id] }
        : verdict === "soon"
        ? { ...acc, expiringSoon: [...acc.expiringSoon, r.user_id] }
        : acc;
    },
    { expired: [], expiringSoon: [] },
  );
};

/** Register a daily Deno cron to scan W-8BEN expiry (requires --unstable-cron). */
export const registerComplianceCron = (): void => {
  Deno.cron(
    "w8ben-expiry-scan",
    "0 9 * * *",
    () =>
      scanExpiredW8BEN().then((result) => {
        if (result.expired.length > 0 || result.expiringSoon.length > 0) {
          console.warn(
            "[compliance-cron] W-8BEN scan found expired or expiring profiles",
          );
        }
      }),
  );
};
