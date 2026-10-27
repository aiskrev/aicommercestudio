import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { buildSlugMap, domainByKey, domainRoutePaths, findDomain, findService, getContent } from "@/content";
import { alternateLocalePath, localizePath, locales } from "@/i18n/config";
import {
  DOMAIN_KEYS,
  DOMAINS,
  domainDefinition,
  domainStatus,
  type DomainKey,
  isDomainPublished,
  primaryDomainOf,
} from "@/lib/domains";
import { routes } from "@/lib/routes";
import { isToolAvailable, toolByKey } from "@/lib/tools";

/** Registry of docs/SERVICE_TAXONOMY.md §2: id, BG slug, EN slug, status. */
const TAXONOMY: Record<DomainKey, [string, string, string, "available" | "custom"]> = {
  ai_strategy: ["A", "ai-strategiya-i-transformatsiya", "ai-strategy-and-transformation", "available"],
  ai_agents_automation: ["B", "ai-agenti-i-biznes-avtomatizatsiya", "ai-agents-and-business-automation", "available"],
  ai_applications: ["C", "ai-prilozheniya-i-sistemi-za-znaniya", "ai-applications-and-knowledge-systems", "available"],
  commerce_engineering: ["D", "inzhenering-za-elektronna-targoviya", "commerce-engineering", "available"],
  cloud_platform: ["E", "oblachen-i-platformen-inzhenering", "cloud-and-platform-engineering", "custom"],
  devops_sre: ["F", "devops-sre-i-nablyudaemost", "devops-sre-and-observability", "custom"],
  data_integration: ["G", "inzhenering-na-danni-i-integratsii", "data-and-integration-engineering", "available"],
  ai_governance: ["H", "ai-upravlenie-sigurnost-i-nadezhdnost", "ai-governance-security-and-assurance", "custom"],
  managed_operations: ["I", "upravlyavani-ai-i-platformeni-operatsii", "managed-ai-and-platform-operations", "available"],
  advisory_enablement: ["J", "konsultatsii-otsenki-i-obuchenie", "advisory-assessments-and-enablement", "available"],
};

describe("domain registry (SERVICE_TAXONOMY §7)", () => {
  it("has the ten domains A–J with unique keys, matching the taxonomy", () => {
    expect(DOMAINS).toHaveLength(10);
    expect(new Set(DOMAIN_KEYS).size).toBe(10);
    expect(DOMAINS.map((d) => d.id).join("")).toBe("ABCDEFGHIJ");
    for (const domain of DOMAINS) {
      const [id, , , status] = TAXONOMY[domain.key];
      expect(domain.id, domain.key).toBe(id);
      expect(domainStatus(domain.key), domain.key).toBe(status);
    }
  });

  it("gives every existing service exactly one primary domain", () => {
    for (const service of getContent("bg").services) {
      const owners = DOMAINS.filter((d) => d.primaryServices.includes(service.key));
      expect(owners.map((d) => d.key), service.key).toHaveLength(1);
      expect(primaryDomainOf(service.key)?.key).toBe(owners[0].key);
    }
  });

  it("does not list a service both as primary and as also-listed", () => {
    for (const domain of DOMAINS) {
      for (const key of domain.alsoListed) expect(domain.primaryServices, domain.key).not.toContain(key);
    }
  });

  it("links related domains, via-domains and tools that exist", () => {
    for (const domain of DOMAINS) {
      expect(domain.related.length, domain.key).toBeGreaterThanOrEqual(2);
      expect(domain.related.length, domain.key).toBeLessThanOrEqual(4);
      expect(new Set(domain.related).size).toBe(domain.related.length);
      const vias = [...domain.related, ...domain.families.flatMap((f) => f.via ?? []), ...domain.engagement.flatMap((e) => e.via ?? [])];
      for (const key of vias) {
        expect(DOMAIN_KEYS, domain.key).toContain(key);
        expect(key, `${domain.key} links to itself`).not.toBe(domain.key);
      }
      for (const tool of domain.tools) expect(isToolAvailable(toolByKey(tool)), `${domain.key}: ${tool}`).toBe(true);
    }
  });

  it("lists each engagement model at most once", () => {
    for (const domain of DOMAINS) {
      const models = domain.engagement.map((e) => e.model);
      expect(new Set(models).size, domain.key).toBe(models.length);
      expect(models, domain.key).toContain("assessment");
    }
  });

  it("has an available family in every domain marked available, and unique family keys", () => {
    for (const domain of DOMAINS) {
      const keys = domain.families.map((f) => f.key);
      expect(new Set(keys).size, domain.key).toBe(keys.length);
      if (domainStatus(domain.key) === "available") {
        expect(domain.families.some((f) => f.status === "available"), domain.key).toBe(true);
      }
    }
  });
});

describe.each(locales)("domain content (%s)", (locale) => {
  const { domains, services } = getContent(locale);
  const serviceSlugs = new Set([...getContent("bg").services, ...getContent("en").services].map((s) => s.slug));

  it("has one text entry per registry domain, in registry order", () => {
    expect(domains.map((d) => d.key)).toEqual([...DOMAIN_KEYS]);
  });

  it("uses the taxonomy slugs, unique and never equal to a service slug", () => {
    const slugs = domains.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const domain of domains) {
      const [, bg, en] = TAXONOMY[domain.key];
      expect(domain.slug).toBe(locale === "bg" ? bg : en);
      expect(domain.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(serviceSlugs.has(domain.slug), domain.slug).toBe(false);
      expect(findService(locale, domain.slug)).toBeUndefined();
    }
    expect(services.length).toBeGreaterThan(0);
  });

  it("has texts for exactly the registry families, with a prerequisite for planned ones", () => {
    for (const domain of domains) {
      const definition = domainDefinition(domain.key);
      expect(Object.keys(domain.families).sort(), domain.key).toEqual(definition.families.map((f) => f.key).sort());
      for (const family of definition.families) {
        const text = domain.families[family.key];
        expect(text.title.trim(), `${domain.key}.${family.key}`).not.toBe("");
        expect(text.capabilities.trim()).not.toBe("");
        if (family.status === "planned") expect(text.prerequisite, `${domain.key}.${family.key}`).toBeTruthy();
      }
    }
  });

  it("fills every section of the hub template", () => {
    for (const domain of domains) {
      expect(domain.idealCustomers.length, domain.key).toBeGreaterThanOrEqual(2);
      expect(domain.problems.length, domain.key).toBeGreaterThanOrEqual(4);
      expect(domain.problems.length, domain.key).toBeLessThanOrEqual(6);
      expect(domain.deliverables.length, domain.key).toBeGreaterThanOrEqual(3);
      expect(domain.prerequisites.length, domain.key).toBeGreaterThanOrEqual(2);
      expect(domain.limitations.length, domain.key).toBeGreaterThanOrEqual(2);
      for (const text of [domain.name, domain.summary, domain.positioning, domain.cta]) expect(text.trim()).not.toBe("");
    }
  });

  it("keeps SEO titles within 60 characters and descriptions within 120–160", () => {
    for (const domain of domains) {
      expect(domain.metaTitle.length, domain.metaTitle).toBeLessThanOrEqual(60);
      expect(domain.metaDescription.length, domain.key).toBeGreaterThanOrEqual(120);
      expect(domain.metaDescription.length, domain.key).toBeLessThanOrEqual(160);
    }
  });

  it("states no prices, percentages or currency amounts", () => {
    for (const domain of domains) {
      const text = JSON.stringify(domain);
      expect(text, domain.key).not.toMatch(/[€$£%]|\bEUR\b|\bBGN\b|\d\s?лв/);
    }
  });

  it("lists every published hub in the sitemap with reciprocal hreflang", () => {
    const entries = sitemap();
    for (const domain of domains.filter((d) => isDomainPublished(d.key))) {
      const entry = entries.find((e) => new URL(e.url).pathname === localizePath(locale, routes.service(domain.slug)));
      expect(entry, domain.slug).toBeDefined();
      const paths = domainRoutePaths(domain.key);
      const languages = entry?.alternates?.languages ?? {};
      expect(Object.values(languages).map((u) => new URL(String(u)).pathname).sort()).toEqual(
        [localizePath("bg", paths.bg), localizePath("en", paths.en)].sort(),
      );
    }
  });
});

describe("domain routing", () => {
  const slugs = buildSlugMap();

  it("resolves hubs by slug and keeps both locales paired", () => {
    for (const key of DOMAIN_KEYS) {
      const bg = domainByKey("bg", key);
      const en = domainByKey("en", key);
      expect(findDomain("bg", bg.slug)?.key).toBe(key);
      expect(findDomain("en", en.slug)?.key).toBe(key);
      expect(slugs.services[bg.slug]).toBe(en.slug);
    }
  });

  it("switches language on a hub to the paired hub", () => {
    const bg = domainByKey("bg", "devops_sre");
    const en = domainByKey("en", "devops_sre");
    expect(alternateLocalePath(`/bg/uslugi/${bg.slug}`, "", "en", slugs)).toBe(`/en/services/${en.slug}`);
    expect(alternateLocalePath(`/en/services/${en.slug}`, "", "bg", slugs)).toBe(`/bg/uslugi/${bg.slug}`);
  });
});
