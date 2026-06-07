import sql from "../db/client.ts";

export interface W8BENScanResult {
  expired: string[];
  expiringSoon: string[];
}

export interface NppnDeadlineResult {
  missing: string[];
}

const WARN_DAYS_MS = 30 * 86_400_000;

export const scanExpiredW8BEN = async (): Promise<W8BENScanResult> => {
  const rows = await sql`
    SELECT user_id::text, w8ben_expiry_date::text
    FROM user_tax_profiles
    WHERE w8ben_expiry_date IS NOT NULL
  `;

  const now = new Date();
  return rows.reduce<W8BENScanResult>(
    (acc, r) => {
      const expiry = r.w8ben_expiry_date ?? null;
      if (!expiry) return acc;
      const diffMs = new Date(expiry).getTime() - now.getTime();
      return diffMs < 0
        ? { ...acc, expired: [...acc.expired, r.user_id] }
        : diffMs <= WARN_DAYS_MS
        ? { ...acc, expiringSoon: [...acc.expiringSoon, r.user_id] }
        : acc;
    },
    { expired: [], expiringSoon: [] },
  );
};

export const scanNppnDeadline = async (): Promise<NppnDeadlineResult> => {
  const rows = await sql`
    SELECT user_id::text, nppn_notified_at::text
    FROM user_tax_profiles
  `;

  const now = new Date();
  const currentMonth = now.getMonth(); // 0-based: Jan=0, Mar=2

  return {
    missing: rows
      .filter((r) => (r.nppn_notified_at ?? null) === null && currentMonth >= 2)
      .map((r) => r.user_id),
  };
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

  Deno.cron(
    "nppn-deadline-scan",
    "0 9 * * *",
    () =>
      scanNppnDeadline().then((result) => {
        if (result.missing.length > 0) {
          console.warn(
            "[compliance-cron] NPPN deadline scan found profiles missing notification",
          );
        }
      }),
  );
};
