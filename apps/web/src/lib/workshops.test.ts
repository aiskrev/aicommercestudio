import { describe, expect, it } from "vitest";

import { articlesInCategory, getContent, isIndexableCategory } from "@/content";
import { localizePath } from "@/i18n/config";
import { DOMAIN_KEYS, domainDefinition } from "@/lib/domains";
import { TOPIC_DOMAINS, topicWorkshops } from "@/lib/insight-topics";
import { PATTERN_KEYS, SCENARIO_KEYS } from "@/lib/reference";
import { contactAboutWorkshop, routes } from "@/lib/routes";
import { TOOLS } from "@/lib/tools";
import workshopKeys from "@/lib/workshop-keys.json";
import { workshopArticles, workshopLinks } from "@/lib/workshop-links";
import {
  WORKSHOP_KEYS,
  WORKSHOP_KINDS,
  WORKSHOP_SLUGS,
  WORKSHOPS,
  isWorkshopKey,
  workshopBySlug,
  workshopContactService,
  workshopsForAssessment,
  workshopsForDomains,
} from "@/lib/workshops";

const LOCALES = ["bg", "en"] as const;
// Prices, currencies, percentages and promises never appear in the offers themselves.
// (Limitations may say what an offer is *not*, e.g. "not a certification".)
const FORBIDDEN = /€|\$|£|\bEUR\b|\bBGN\b|\bлв\.?(?=\s|$)|лева|\d+\s?%|guarante|гаранти/i;

describe("workshops & advisory catalogue", () => {
  it("has the ten requested offers, each of a known kind", () => {
    expect(WORKSHOP_KEYS).toEqual([
      "ai_strategy_discovery",
      "ai_readiness_mapping",
      "agent_architecture",
      "landing_zone_assessment",
      "kubernetes_review",
      "devops_gitops_assessment",
      "observability_sre",
      "ecommerce_integration_discovery",
      "rag_data_readiness",
      "responsible_ai_review",
    ]);
    for (const w of WORKSHOPS) expect(WORKSHOP_KINDS).toContain(w.kind);
  });

  it("the shared key file (also read by the API) matches the keys and page titles", () => {
    expect(Object.keys(workshopKeys)).toEqual(WORKSHOP_KEYS);
    for (const locale of LOCALES) {
      const { texts } = getContent(locale).workshops;
      for (const key of WORKSHOP_KEYS) expect(workshopKeys[key][locale], key).toBe(texts[key].title);
    }
  });

  it("every offer has every section, with the same structure in both languages", () => {
    const bg = getContent("bg").workshops.texts;
    const en = getContent("en").workshops.texts;
    for (const key of WORKSHOP_KEYS) {
      for (const texts of [bg, en]) {
        const w = texts[key];
        expect(w.title.length, key).toBeGreaterThan(5);
        expect(w.summary.length, key).toBeGreaterThan(40);
        expect(w.audience.length, key).toBeGreaterThanOrEqual(3);
        expect(w.problems.length, key).toBeGreaterThanOrEqual(3);
        expect(w.prerequisites.length, key).toBeGreaterThanOrEqual(2);
        expect(w.agenda.length, key).toBeGreaterThanOrEqual(3);
        expect(w.deliverables.length, key).toBeGreaterThanOrEqual(3);
        expect(w.limitations.length, key).toBeGreaterThanOrEqual(2);
        for (const value of Object.values(w.format)) expect(value.length, key).toBeGreaterThan(10);
      }
      for (const section of ["audience", "problems", "prerequisites", "agenda", "deliverables", "limitations"] as const) {
        expect(en[key][section].length, `${key}.${section}`).toBe(bg[key][section].length);
      }
    }
  });

  it("states no price, currency, percentage or guarantee", () => {
    for (const locale of LOCALES) {
      const blob = JSON.stringify(getContent(locale).workshops.texts);
      expect(blob).not.toMatch(FORBIDDEN);
    }
    // The page notices say the opposite, explicitly.
    expect(getContent("bg").workshops.page.notice).toMatch(/Не публикуваме цени/);
    expect(getContent("en").workshops.page.notice).toMatch(/do not publish prices/);
  });

  it("meets the SEO limits: title ≤ 60 characters, description 120–160 (CONTENT_STRATEGY §9)", () => {
    for (const locale of LOCALES) {
      const { page, texts } = getContent(locale).workshops;
      const pairs: [string, string][] = [[page.metaTitle, page.metaDescription], ...WORKSHOP_KEYS.map((k): [string, string] => [texts[k].title, texts[k].summary])];
      for (const [title, description] of pairs) {
        expect(title.length, title).toBeLessThanOrEqual(60);
        expect(description.length, description).toBeGreaterThanOrEqual(120);
        expect(description.length, description).toBeLessThanOrEqual(160);
      }
    }
  });

  it("links only to existing domains, assessments, scenarios and patterns", () => {
    const tools = new Set(TOOLS.map((t) => t.key));
    for (const w of WORKSHOPS) {
      expect(w.domains.length).toBeGreaterThan(0);
      for (const d of w.domains) expect(DOMAIN_KEYS).toContain(d);
      expect(w.assessments.length).toBeGreaterThan(0);
      for (const t of w.assessments) expect(tools.has(t), `${w.key} → ${t}`).toBe(true);
      expect(w.scenarios.length).toBeGreaterThan(0);
      for (const s of w.scenarios) expect(SCENARIO_KEYS).toContain(s);
      for (const p of w.patterns) expect(PATTERN_KEYS).toContain(p);
      expect(domainDefinition(w.domains[0]).published).toBe(true);
    }
  });

  it("every domain hub and every assessment result has at least one offer to point to", () => {
    for (const domain of DOMAIN_KEYS) expect(workshopsForDomains([domain]).length, domain).toBeGreaterThan(0);
    const results = ["readiness", "finder", "cloud_maturity", "devops_maturity", "observability", "ecommerce_architecture", "data_integration", "ai_governance", "ai_ops_readiness", "finops"] as const;
    for (const tool of results) expect(workshopsForAssessment(tool).length, tool).toBeGreaterThan(0);
  });

  it("slugs are unique, kebab-case, different between languages and resolve back", () => {
    for (const locale of LOCALES) {
      const values = WORKSHOP_KEYS.map((key) => WORKSHOP_SLUGS[key][locale]);
      expect(new Set(values).size).toBe(values.length);
      for (const slug of values) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    for (const key of WORKSHOP_KEYS) {
      expect(workshopBySlug(WORKSHOP_SLUGS[key].bg)).toBe(key);
      expect(WORKSHOP_SLUGS[key].bg).not.toBe(WORKSHOP_SLUGS[key].en);
    }
    expect(workshopBySlug("unknown")).toBeNull();
    expect(isWorkshopKey("agent_architecture")).toBe(true);
    expect(isWorkshopKey("__proto__")).toBe(false);
  });

  it("localizes the index, detail pages and the enquiry link", () => {
    expect(localizePath("bg", routes.workshops)).toBe("/bg/rabotni-sreshti");
    expect(localizePath("en", routes.workshops)).toBe("/en/workshops");
    expect(localizePath("en", routes.workshop(WORKSHOP_SLUGS.kubernetes_review.bg))).toBe("/en/workshops/kubernetes-platform-review");
    const enquiry = contactAboutWorkshop(workshopContactService("kubernetes_review"), "kubernetes_review");
    expect(localizePath("bg", enquiry)).toBe("/bg/kontakti?usluga=integrations&sreshta=kubernetes_review");
    expect(localizePath("en", enquiry)).toBe("/en/contact?service=integrations&workshop=kubernetes_review");
  });

  it("builds card links with the localized title, summary and kind", () => {
    const [link] = workshopLinks("en", ["landing_zone_assessment"]);
    expect(link).toMatchObject({
      href: "/en/workshops/cloud-landing-zone-assessment",
      label: "Cloud Landing Zone Assessment",
      kind: "assessment",
      kindLabel: "Assessment",
    });
  });
});

describe("insights taxonomy", () => {
  const ENGINEERING = ["oblak-i-platformi", "devops-i-sre", "danni-i-integratsii", "upravlenie-na-ai"];

  it("maps every topic to domains, in both languages, with distinct localized slugs", () => {
    for (const locale of LOCALES) {
      const keys = getContent(locale).editorialCategories.map((c) => c.key);
      expect(keys.sort()).toEqual(Object.keys(TOPIC_DOMAINS).sort());
    }
    const en = Object.fromEntries(getContent("en").editorialCategories.map((c) => [c.key, c.slug]));
    for (const key of ENGINEERING) expect(en[key]).not.toBe(key);
    for (const key of Object.keys(TOPIC_DOMAINS)) expect(topicWorkshops(key).length, key).toBeGreaterThan(0);
  });

  it("adds the engineering topics without inventing articles: they stay empty and out of the index", () => {
    for (const locale of LOCALES) {
      for (const key of ENGINEERING) {
        expect(articlesInCategory(locale, key)).toEqual([]);
        expect(isIndexableCategory(locale, key)).toBe(false);
      }
    }
  });

  it("keeps the existing articles and their topics", () => {
    for (const locale of LOCALES) {
      const { articles } = getContent(locale);
      expect(articles.length).toBeGreaterThan(0);
      for (const article of articles) expect(ENGINEERING).not.toContain(article.category);
    }
  });

  it("lists related published articles on a workshop page, never an invented one", () => {
    const keys = new Set(getContent("bg").articles.map((a) => a.title));
    for (const key of WORKSHOP_KEYS) for (const item of workshopArticles("bg", key)) expect(keys.has(item.label)).toBe(true);
    expect(workshopArticles("bg", "ai_strategy_discovery").length).toBeGreaterThan(0);
    expect(workshopArticles("bg", "kubernetes_review")).toEqual([]);
  });
});
