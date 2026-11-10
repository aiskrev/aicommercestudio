import registry from "@/lib/legal-versions.json";

/**
 * Version ids of the legal documents and consent wordings (docs/LEGAL_COMPLIANCE_REMEDIATION_2026-11-10.md).
 * One registry for the web and the API (a copy at apps/api/app/legal_versions.json, kept identical by
 * scripts/test.ps1). The id is the date of the text and is the same for the Bulgarian and the English text:
 * the two languages are revised together. `lib/legal-versions.test.ts` fails when a text changes without a new
 * version, so the id recorded with a consent always matches the exact text that was shown.
 */
export const LEGAL_DOCUMENT_KEYS = [
  "privacy",
  "cookies",
  "terms",
  "subscription_terms",
  "withdrawal_info",
  "marketing_consent",
  "order_acceptance",
  "early_start",
] as const;
export type LegalDocumentKey = (typeof LEGAL_DOCUMENT_KEYS)[number];

export type LegalReview = "reviewed" | "pending_lawyer_review";
/** draft: may change under the same id; approved: a lawyer signed this exact text off; published: approved and live. */
export type LegalStatus = "draft" | "approved" | "published";

export interface LegalVersionEntry {
  version: string;
  kind: "notice" | "contract" | "consent";
  review: LegalReview;
  previous_reviewed_version: string | null;
  status: LegalStatus;
  languages: readonly ["bg", "en"];
  content_sha256: string;
  content_sha256_bg: string;
  content_sha256_en: string;
  /** Set only when a lawyer approved this exact text; the test then freezes it. */
  approved_content_sha256: string | null;
}

export const legalRegistry = registry.documents as unknown as Record<LegalDocumentKey, LegalVersionEntry>;

export function legalVersion(key: LegalDocumentKey): string {
  return legalRegistry[key].version;
}
