import type { Locale } from "@/i18n/config";
import type { DeliveryStatus, DomainKey } from "@/lib/domains";

/** Catalogue types and pure helpers that client components may import (lib/catalogue.ts is server-only). */

export type OfferingType = "service" | "assessment" | "workshop";

export const OFFERING_TYPES: readonly OfferingType[] = ["service", "assessment", "workshop"];

export interface CatalogueEntry {
  key: string;
  offeringType: OfferingType;
  slug: string;
  alternateSlugs: Record<Locale, string>;
  name: string;
  shortName: string | null;
  summary: string;
  deliveryStatus: DeliveryStatus;
  domain: DomainKey;
  isEntryOffer: boolean;
  /** Indicative duration band in working days (assessments and workshops). */
  duration: { minDays: number; maxDays: number } | null;
  /** `content`: rendered from the TypeScript content; `catalogue`: published only in the catalogue. */
  origin: "content" | "catalogue";
}

export interface CatalogueRef {
  key: string;
  offeringType: OfferingType;
  slug: string;
  name: string;
}

export interface CatalogueDetail extends CatalogueEntry {
  body: string;
  seo: { title: string; description: string };
  capabilities: { title: string; description: string }[];
  deliverables: string[];
  related: { services: CatalogueRef[]; assessments: CatalogueRef[]; workshops: CatalogueRef[] };
}

/** "0.5–1", "2", localized decimal separator. */
export function formatDuration(duration: { minDays: number; maxDays: number }, locale: Locale): string {
  const number = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB", { maximumFractionDigits: 1 });
  const { minDays, maxDays } = duration;
  return minDays === maxDays ? number.format(minDays) : `${number.format(minDays)}–${number.format(maxDays)}`;
}
