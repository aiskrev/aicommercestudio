import { getContent, serviceByKey } from "@/content";
import type { Locale } from "@/i18n/config";
import {
  type CatalogueDetail,
  type CatalogueEntry,
  type CatalogueRef,
  OFFERING_TYPES,
  type OfferingType,
} from "@/lib/catalogue-shared";
import { BANDS, type DeliveryStatus, type DomainKey, domainsInBand, isDomainPublished } from "@/lib/domains";

/**
 * Published service catalogue for the public pages (docs/SERVICE_CATALOGUE_ARCHITECTURE.md §9, §11).
 *
 * The TypeScript content stays the source of truth for the ten domains and the nine existing
 * services: their pages are statically generated from it and never depend on the API. The public
 * catalogue API adds what exists only in the catalogue (assessments, workshops and services created
 * in the admin), with incremental static regeneration:
 *
 *   * build time: the API is usually unreachable; every fetch fails fast and the pages are built from
 *     the TypeScript content alone. The build never requires the API.
 *   * runtime: fetches are cached for CATALOGUE_REVALIDATE_SECONDS under the `catalogue` tag, so the
 *     pages pick up published entries within that window, or at once after `POST /api/catalogue-revalidate`.
 *   * API unavailable at runtime: the same content-only result, never an error page.
 *
 * Server-only (reads API_INTERNAL_URL). Client components import lib/catalogue-shared instead.
 */

export * from "@/lib/catalogue-shared";

/** Kept in sync with `revalidate` on the catalogue routes (a literal there, as Next.js requires). */
export const CATALOGUE_REVALIDATE_SECONDS = 300;
export const CATALOGUE_TAG = "catalogue";

const FETCH_TIMEOUT_MS = 3_000;
const PAGE_SIZE = 100;
/** Public slugs are lowercase words joined by hyphens (the API's slug rule). Anything else is never looked up. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface Catalogue {
  entries: CatalogueEntry[];
  /** Whether the API answered; `content` means the pages show the TypeScript content only. */
  source: "api" | "content";
}

// --------------------------------------------------------------------------- content entries

const ORDERED_DOMAINS = BANDS.flatMap((band) => domainsInBand(band));
const DOMAIN_ORDER: DomainKey[] = ORDERED_DOMAINS.map((domain) => domain.key);

/** The existing services, in domain order, as catalogue entries (no API involved). */
export function contentEntries(locale: Locale): CatalogueEntry[] {
  return ORDERED_DOMAINS.flatMap((domain) =>
    domain.primaryServices.map((key): CatalogueEntry => {
      const service = serviceByKey(locale, key);
      return {
        key,
        offeringType: "service",
        slug: service.slug,
        alternateSlugs: { bg: serviceByKey("bg", key).slug, en: serviceByKey("en", key).slug },
        name: service.title,
        shortName: service.shortTitle,
        summary: service.summary,
        deliveryStatus: "available",
        domain: domain.key,
        isEntryOffer: Boolean(service.isOffering),
        duration: null,
        origin: "content",
      };
    }),
  );
}

// --------------------------------------------------------------------------- API access

interface ApiRef {
  key: string;
  offering_type: OfferingType;
  slug: string;
  name: string;
}

export interface ApiSummary extends ApiRef {
  alternate_slugs: Record<Locale, string>;
  short_name: string | null;
  summary: string;
  delivery_status: DeliveryStatus;
  primary_domain: { key: string } | null;
  is_entry_offer: boolean;
  duration: { min_days: number; max_days: number } | null;
}

interface ApiDetail extends ApiSummary {
  body: string;
  seo: { title: string; description: string };
  capabilities: { title: string; description: string }[];
  deliverables: string[];
  related: { services: ApiRef[]; assessments: ApiRef[]; workshops: ApiRef[] };
}

function apiBaseUrl(): string {
  return (process.env.API_INTERNAL_URL || "http://localhost:8000").replace(/\/$/, "");
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, {
      next: { revalidate: CATALOGUE_REVALIDATE_SECONDS, tags: [CATALOGUE_TAG] },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null; // unreachable API (always the case during `next build`), timeout or invalid JSON
  }
}

async function fetchSummaries(locale: Locale): Promise<ApiSummary[] | null> {
  const items: ApiSummary[] = [];
  for (let offset = 0; offset < 1_000; offset += PAGE_SIZE) {
    const page = await getJson<{ items: ApiSummary[]; total: number }>(
      `/api/public/catalogue/services?locale=${locale}&limit=${PAGE_SIZE}&offset=${offset}`,
    );
    if (!page || !Array.isArray(page.items)) return null;
    items.push(...page.items);
    if (items.length >= page.total || page.items.length === 0) break;
  }
  return items;
}

function isOfferingType(value: unknown): value is OfferingType {
  return OFFERING_TYPES.includes(value as OfferingType);
}

function toEntry(item: ApiSummary): CatalogueEntry {
  return {
    key: item.key,
    offeringType: item.offering_type,
    slug: item.slug,
    alternateSlugs: { bg: item.alternate_slugs.bg, en: item.alternate_slugs.en },
    name: item.name,
    shortName: item.short_name,
    summary: item.summary,
    deliveryStatus: item.delivery_status,
    domain: item.primary_domain!.key as DomainKey,
    isEntryOffer: item.is_entry_offer,
    duration: item.duration ? { minDays: item.duration.min_days, maxDays: item.duration.max_days } : null,
    origin: "catalogue",
  };
}

/**
 * Merges the API entries into the content entries. Content wins for every key it knows; a catalogue
 * entry is added only when its primary domain is a published hub and its slugs are valid and do not
 * collide with an existing service or domain slug in either language.
 */
export function mergeCatalogue(content: CatalogueEntry[], api: ApiSummary[] | null, contentSlugs: Record<Locale, Set<string>>): Catalogue {
  if (!api) return { entries: content, source: "content" };
  const known = new Set(content.map((entry) => entry.key));
  const added = api
    .filter((item) => !known.has(item.key) && isOfferingType(item.offering_type))
    .filter((item) => item.primary_domain && DOMAIN_ORDER.includes(item.primary_domain.key as DomainKey))
    .filter((item) => isDomainPublished(item.primary_domain!.key as DomainKey))
    .filter(
      (item) =>
        item.alternate_slugs &&
        (["bg", "en"] as const).every(
          (locale) => SLUG_PATTERN.test(item.alternate_slugs[locale] ?? "") && !contentSlugs[locale].has(item.alternate_slugs[locale]),
        ),
    )
    .map(toEntry);
  const rank = (entry: CatalogueEntry) => DOMAIN_ORDER.indexOf(entry.domain) * 10 + OFFERING_TYPES.indexOf(entry.offeringType);
  // Stable sort: the content order, then the API's catalogue order, inside each domain and type.
  const entries = [...content, ...added].sort((a, b) => rank(a) - rank(b));
  return { entries, source: "api" };
}

function reservedSlugs(): Record<Locale, Set<string>> {
  const slugs = (locale: Locale) => {
    const { services, domains } = getContent(locale);
    return new Set([...services.map((s) => s.slug), ...domains.map((d) => d.slug)]);
  };
  return { bg: slugs("bg"), en: slugs("en") };
}

/** All published entries for a locale (content + catalogue-only). Never throws. */
export async function getCatalogue(locale: Locale): Promise<Catalogue> {
  return mergeCatalogue(contentEntries(locale), await fetchSummaries(locale), reservedSlugs());
}

export function isCatalogueSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length <= 120;
}

function toRef(ref: ApiRef): CatalogueRef {
  return { key: ref.key, offeringType: ref.offering_type, slug: ref.slug, name: ref.name };
}

/**
 * Detail of a catalogue-only entry by its slug in `locale`, or null. Unknown slugs cost no API call
 * beyond the cached list, so random URLs cannot be used to multiply requests to the API.
 */
export async function getCatalogueDetail(locale: Locale, slug: string): Promise<CatalogueDetail | null> {
  if (!isCatalogueSlug(slug)) return null;
  const { entries } = await getCatalogue(locale);
  const entry = entries.find((item) => item.origin === "catalogue" && item.slug === slug);
  if (!entry) return null;
  const detail = await getJson<ApiDetail>(`/api/public/catalogue/services/${encodeURIComponent(entry.key)}?locale=${locale}`);
  if (!detail || detail.key !== entry.key) return null;
  const visible = new Set(entries.map((item) => item.key));
  const refs = (list: ApiRef[] | undefined) => (list ?? []).filter((ref) => visible.has(ref.key)).map(toRef);
  return {
    ...entry,
    body: detail.body,
    seo: detail.seo,
    capabilities: detail.capabilities ?? [],
    deliverables: detail.deliverables ?? [],
    related: {
      services: refs(detail.related?.services),
      assessments: refs(detail.related?.assessments),
      workshops: refs(detail.related?.workshops),
    },
  };
}

// --------------------------------------------------------------------------- helpers for pages

/** Assessments and workshops whose primary domain is `domain`, in catalogue order. */
export function domainOfferings(entries: CatalogueEntry[], domain: DomainKey): CatalogueEntry[] {
  return entries.filter((entry) => entry.domain === domain && entry.offeringType !== "service");
}
