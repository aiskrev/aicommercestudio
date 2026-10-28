/** Shared fixtures for the catalogue admin tests (not imported by application code). */

import type { CatalogueEntity } from "@/lib/admin-types";

export function sampleEntity(overrides: Partial<CatalogueEntity> = {}): CatalogueEntity {
  const text = (name: string, slug: string) => ({
    slug,
    name,
    short_name: name,
    summary: `${name} summary`,
    body: `${name} body`,
    cta_label: null,
    seo_title: `${name} SEO title`,
    seo_description: `${name} description`,
  });
  return {
    id: "00000000-0000-4000-8000-000000000001",
    type: "service",
    key: "seo",
    status: "published",
    revision: 3,
    published_revision: 3,
    has_unpublished_changes: false,
    first_published_at: "2026-10-28T10:00:00Z",
    published_at: "2026-10-28T10:00:00Z",
    archived_at: null,
    updated_at: "2026-10-28T10:00:00Z",
    translations: { bg: text("SEO БГ", "seo-optimizatsiya"), en: text("SEO", "seo-slug") },
    capabilities: [{ bg: { title: "Обхождане", body: "Карта на сайта" }, en: { title: "Crawlability", body: "Sitemaps" } }],
    deliverables: [{ bg: { title: null, body: "Одит" }, en: { title: null, body: "Audit" } }],
    related: ["analytics"],
    service: {
      offering_type: "service",
      primary_domain: "commerce_engineering",
      delivery_status: "available",
      lead_category: "seo",
      position: 1,
      duration_min_days: null,
      duration_max_days: null,
      custom_page: false,
      is_entry_offer: false,
    },
    domain: null,
    permissions: ["edit", "publish", "archive"],
    ...overrides,
  };
}
