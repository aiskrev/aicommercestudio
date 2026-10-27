import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { locales } from "@/i18n/config";

// Must stay in sync with ServiceKey in apps/api/app/models.py (minus "other").
const API_SERVICE_KEYS = [
  "ai_agents",
  "maintenance",
  "seo",
  "ai_tools",
  "automation",
  "analytics",
  "integrations",
  "audit",
  "ai_managed",
];

describe.each(locales)("content integrity (%s)", (locale) => {
  const content = getContent(locale);

  it("has eight core services plus the audit offering", () => {
    expect(content.coreServices).toHaveLength(8);
    expect(content.services.map((s) => s.key).sort()).toEqual([...API_SERVICE_KEYS].sort());
    expect(content.services.find((s) => s.key === "audit")?.isOffering).toBe(true);
  });

  it("uses unique, URL-safe slugs", () => {
    const slugs = [...content.services.map((s) => s.slug), ...content.articles.map((a) => a.slug)];
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has unique, reasonably sized titles and meta descriptions", () => {
    const pages = [
      ...content.services.map((s) => ({ title: s.metaTitle, description: s.metaDescription })),
      ...content.articles.map((a) => ({ title: a.metaTitle ?? a.title, description: a.description })),
      { title: content.home.metaTitle, description: content.home.metaDescription },
      { title: content.servicesPage.metaTitle, description: content.servicesPage.metaDescription },
      { title: content.aiSolutions.metaTitle, description: content.aiSolutions.metaDescription },
      { title: content.industries.metaTitle, description: content.industries.metaDescription },
      { title: content.about.metaTitle, description: content.about.metaDescription },
      { title: content.processPage.metaTitle, description: content.processPage.metaDescription },
    ];
    expect(new Set(pages.map((p) => p.title)).size).toBe(pages.length);
    expect(new Set(pages.map((p) => p.description)).size).toBe(pages.length);
    for (const page of pages) {
      expect(page.title.length, page.title).toBeLessThanOrEqual(90);
      expect(page.description.length, page.description).toBeGreaterThanOrEqual(70);
      expect(page.description.length, page.description).toBeLessThanOrEqual(175);
    }
  });

  it("every service page is complete and references existing services", () => {
    const keys = new Set(content.services.map((s) => s.key));
    for (const service of content.services) {
      expect(service.capabilities.length).toBeGreaterThanOrEqual(6);
      expect(service.faqs.length).toBeGreaterThanOrEqual(3);
      expect(service.deliverables.length).toBeGreaterThan(0);
      expect(service.engagement.length).toBeGreaterThan(0);
      for (const related of service.related) {
        expect(keys.has(related)).toBe(true);
        expect(related).not.toBe(service.key);
      }
    }
  });

  it("contains no leftover TODO markers or invented guarantees", () => {
    const text = JSON.stringify(content);
    expect(text).not.toMatch(/TODO|lorem ipsum/i);
    // Affirmative promises only — disclaimers such as "не обещаваме гарантиран ръст" are fine.
    expect(text).not.toMatch(/гарантираме (ръст|първо място|позиции|резултат)/i);
    expect(text).not.toMatch(/we guarantee (growth|first place|rankings|results)/i);
  });

  it("marks legal texts as drafts", () => {
    expect(content.legal.draftNotice).toMatch(locale === "bg" ? /Чернова/ : /Draft/);
    for (const doc of [content.legal.privacyPolicy, content.legal.cookiePolicy, content.legal.termsOfUse]) {
      expect(doc.sections.length).toBeGreaterThan(2);
    }
  });

  it("AI Managed Services plans promise no unlimited work, 24/7 cover, SLA or public price", () => {
    const { packages } = content.aiManaged;
    const offered = JSON.stringify([packages.items, packages.comparison]);
    expect(offered).not.toMatch(/unlimited|неограничен|24\/7|SLA|uptime|€|лв\.|\$\d/i);
    for (const item of packages.items) expect(item.includes.length).toBeGreaterThan(3);
    expect(packages.items.map((p) => p.key)).toEqual(["monitor", "care", "optimize"]);
    expect(packages.noSlaNote).toMatch(/SLA/);
    expect(packages.priceLabel).toBe(locale === "bg" ? "По индивидуална оферта" : "Custom quote");
  });

  it("AI Managed Services explains eight operating areas and presents the portal as planned, without data", () => {
    const { operations, portal } = content.aiManaged;
    expect(operations.items.map((i) => i.key)).toEqual(["reliability", "execution", "cost", "quality", "review", "incidents", "optimization", "governance"]);
    for (const item of operations.items) expect(item.deliverable && item.requires).toBeTruthy();
    expect(portal.modules.map((m) => m.key)).toEqual(["overview", "agents", "observability", "quality", "governance", "alerts"]);
    expect(portal.badge).toBe(locale === "bg" ? "Планирано" : "Planned");
    // No figures, guarantees or live-status claims in the new sections.
    const text = JSON.stringify([operations, portal]);
    expect(text).not.toMatch(/\d+\s?%|\d+\s?(ms|сек|sec)\b|24\/7|\bSLA\b|uptime|гарантира|guarantee/i);
  });
});
