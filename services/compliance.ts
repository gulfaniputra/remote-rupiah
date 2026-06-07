import { withAuth } from "../db/client.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DocumentType = "1042s" | "w8ben";
export type W8BenStatus = "Valid" | "Expired" | "Missing";

export interface ComplianceDocument {
  userId: string;
  documentType: DocumentType;
  taxYear: number;
  storageKey: string;
  mimeType: string;
  sizeBytes: bigint;
}

export interface UpsertPayload {
  documentType: DocumentType;
  taxYear: number;
  storageKey: string;
  mimeType: string;
  /** Accepts number (from JSON) or bigint (from internal callers) */
  sizeBytes: bigint | number;
}

export interface ComplianceStatus {
  w8benStatus: W8BenStatus;
  w8benExpiryDate: string | null;
  documents: { documentType: string; taxYear: number; isVerified: boolean }[];
  nppnStatus: NppnStatus;
}

export interface NppnStatus {
  notified: boolean;
  notifiedAt: string | null;
  deadline: string;
  daysRemaining: number;
  isOverdue: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
]);

const MAX_SIZE_BYTES = 10_485_760n; // 10 MB

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getTaxYearDeadline = (): { year: number; deadline: string } => {
  const now = new Date();
  const year = now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear();
  const deadline = `${year}-03-31`;
  return { year, deadline };
};

const computeDaysRemaining = (deadline: string): number => {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  return Math.ceil(diffMs / 86_400_000);
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const validatePayload = (p: UpsertPayload): bigint => {
  if (!ALLOWED_MIME_TYPES.has(p.mimeType)) {
    throw new Error(`Invalid MIME type: ${p.mimeType}`);
  }
  const size = BigInt(p.sizeBytes);
  if (size > MAX_SIZE_BYTES) {
    throw new Error(
      `File exceeds maximum size of ${MAX_SIZE_BYTES} bytes (got ${size})`,
    );
  }
  return size;
};

// ---------------------------------------------------------------------------
// Service: upsertDocument
// ---------------------------------------------------------------------------

export const upsertDocument = (
  userId: string,
  payload: UpsertPayload,
): Promise<{ id: string }> =>
  !userId
    ? Promise.reject(new Error("Authentication required"))
    : withAuth(userId, async (tx) => {
      const rows = await tx`
      INSERT INTO compliance_documents
        (user_id, document_type, tax_year, storage_key, mime_type, size_bytes)
      VALUES
        (${userId}, ${payload.documentType}, ${payload.taxYear},
         ${payload.storageKey}, ${payload.mimeType}, ${
        validatePayload(
          payload,
        ).toString()
      })
      ON CONFLICT (user_id, document_type, tax_year)
      DO UPDATE SET
        storage_key  = EXCLUDED.storage_key,
        mime_type    = EXCLUDED.mime_type,
        size_bytes   = EXCLUDED.size_bytes,
        is_verified  = FALSE,
        uploaded_at  = NOW()
      RETURNING id
    `;
      return { id: rows[0]?.id ?? "" };
    });

// ---------------------------------------------------------------------------
// Service: getNppnStatus
// ---------------------------------------------------------------------------

export const getNppnStatus = (userId: string): Promise<NppnStatus> =>
  withAuth(userId, async (tx) => {
    const { deadline } = getTaxYearDeadline();
    const rows = await tx`
      SELECT nppn_notified_at::text
      FROM user_tax_profiles
      LIMIT 1
    `;

    const notifiedAt: string | null = rows[0]?.nppn_notified_at ?? null;
    const daysRemaining = computeDaysRemaining(deadline);

    return {
      notified: notifiedAt !== null,
      notifiedAt,
      deadline,
      daysRemaining: notifiedAt !== null ? 0 : daysRemaining,
      isOverdue: notifiedAt === null && daysRemaining < 0,
    };
  });

// ---------------------------------------------------------------------------
// Service: markNppnNotified
// ---------------------------------------------------------------------------

export const markNppnNotified = (userId: string): Promise<NppnStatus> =>
  withAuth(userId, async (tx) => {
    await tx`
      UPDATE user_tax_profiles
      SET nppn_notified_at = NOW()
    `;
    return getNppnStatus(userId);
  });

// ---------------------------------------------------------------------------
// Service: getComplianceStatus
// ---------------------------------------------------------------------------

export const getComplianceStatus = (
  userId: string,
): Promise<ComplianceStatus> =>
  withAuth(userId, async (tx) => {
    const [profileRows, docRows] = await Promise.all([
      tx`
        SELECT w8ben_expiry_date::text
        FROM user_tax_profiles
        LIMIT 1
      `,
      tx`
        SELECT document_type, tax_year, is_verified
        FROM compliance_documents
        ORDER BY tax_year DESC
      `,
    ]);

    const expiryRaw: string | null = profileRows[0]?.w8ben_expiry_date ?? null;

    return {
      w8benStatus: !expiryRaw
        ? "Missing"
        : new Date(expiryRaw) >= new Date()
        ? "Valid"
        : "Expired",
      w8benExpiryDate: expiryRaw,
      documents: docRows.map((r) => ({
        documentType: r.document_type as string,
        taxYear: Number(r.tax_year),
        isVerified: Boolean(r.is_verified),
      })),
      nppnStatus: await getNppnStatus(userId),
    };
  });
