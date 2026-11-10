import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import { LEVEL_DIMENSIONS } from "@/content/bg/ai-managed";
import { locales } from "@/i18n/config";
import { company } from "@/lib/company";

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
  "business_websites",
  "store_development",
  "portals_web_apps",
  "payments_subscriptions",
  "security_performance",
  "integration_care",
];

describe.each(locales)("content integrity (%s)", (locale) => {
  const content = getContent(locale);

  it("has the core services plus the audit offering", () => {
    expect(content.coreServices).toHaveLength(14);
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

  it("publishes the reviewed cookie information without placeholders, listing every cookie", () => {
    const cookies = content.legal.cookiePolicy;
    expect(content.legal.cookiesDraft).toBe(false);
    const texts = [cookies.title, cookies.intro, ...cookies.sections.flatMap((x) => [x.heading, ...x.paragraphs, ...(x.bullets ?? [])])];
    for (const text of texts) expect(text, "no [placeholder] left").not.toMatch(/\[[^\]]+\]/);
    for (const name of ["acs_locale", "acs_cookie_notice", "acs_session", "acs_csrf"]) expect(JSON.stringify(cookies)).toContain(name);
  });

  it("publishes the privacy policy and the terms without placeholders, with the company's details", () => {
    expect(content.legal.isDraft).toBe(false);
    for (const doc of [content.legal.privacyPolicy, content.legal.termsOfUse]) {
      expect(doc.sections.length).toBeGreaterThan(2);
      const texts = [doc.title, doc.intro, ...doc.sections.flatMap((x) => [x.heading, ...x.paragraphs, ...(x.bullets ?? [])])];
      for (const text of texts) expect(text, "no [placeholder] left").not.toMatch(/\[[^\]]+\]/);
    }
    for (const doc of [content.legal.privacyPolicy, content.legal.termsOfUse]) expect(JSON.stringify(doc)).toContain("207509557");
    expect(JSON.stringify(content.legal.termsOfUse)).toContain(company.phoneDisplay);
    expect(JSON.stringify(content.legal.privacyPolicy)).toContain(company.contactEmail);
  });

  it("has subscription terms that match the billing rules and stay a draft until a lawyer reviews them", () => {
    const doc = content.legal.subscriptionTerms;
    expect(content.legal.subscriptionDraft).toBe(true);
    expect(content.legal.subscriptionDraftNotice.length).toBeGreaterThan(20);
    expect(doc.sections).toHaveLength(13);
    const text = JSON.stringify(doc);
    for (const value of ["207509557", company.contactEmail, company.phoneDisplay, "Stripe", "14", "30", "7"]) expect(text).toContain(value);
    const texts = [doc.title, doc.intro, ...doc.sections.flatMap((x) => [x.heading, ...x.paragraphs, ...(x.bullets ?? [])])];
    for (const value of texts) expect(value, "no [placeholder] left").not.toMatch(/\[[^\]]+\]/);
    // Billing keeps data and has no invented price, VAT rate or ODR platform (closed in 2025).
    expect(text).not.toMatch(/€\s?\d|\d\s?(€|EUR\b)|ДДС от|VAT of \d|\d+\s?%|ec\.europa\.eu\/consumers\/odr/i);
  });

  it("AI Managed Services plans promise no unlimited work, 24/7 cover, SLA or public price", () => {
    const { packages } = content.aiManaged;
    const offered = JSON.stringify([packages.items, packages.comparison]);
    expect(offered).not.toMatch(/unlimited|неограничен|24\/7|SLA|uptime|€|лв\.|\$\d/i);
    for (const item of packages.items) expect(item.includes.length).toBeGreaterThan(3);
    expect(packages.items.map((p) => p.key)).toEqual(["essential", "managed", "advanced"]);
    expect(packages.items.map((p) => p.name)).toEqual(["Essential Monitoring & Advisory", "Managed AI Operations", "Advanced AI Reliability & Optimization"]);
    expect(packages.proposedNote).toBeTruthy();
    expect(packages.noSlaNote).toMatch(/SLA/);
    expect(packages.priceLabel).toBe(locale === "bg" ? "По индивидуална оферта" : "Custom quote");
  });

  it("AI Managed Services defines every level on every dimension and separates current from planned capability", () => {
    const { levels, availability, packages } = content.aiManaged;
    for (const pkg of packages.items) {
      for (const dimension of LEVEL_DIMENSIONS) {
        expect(levels.dimensions[dimension], dimension).toBeTruthy();
        expect(levels.items[pkg.key][dimension].length, `${pkg.key} ${dimension}`).toBeGreaterThan(0);
      }
    }
    expect(availability.current.length).toBeGreaterThan(3);
    expect(availability.planned.length).toBeGreaterThan(2);
    // No prices, round-the-clock staffing, service-level or uptime guarantees, live monitoring or named integrations.
    const text = JSON.stringify([levels, availability]);
    expect(text).not.toMatch(/unlimited(?! changes)|неограничен(?! обем)|24\/7|SLA|uptime|99[.,]\d|€|лв\.|\$\d|\d+\s?(ч|h|hours|часа|минути|minutes)/i);
    expect(text).not.toMatch(/Datadog|Grafana|Langfuse|New Relic|PagerDuty/);
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
