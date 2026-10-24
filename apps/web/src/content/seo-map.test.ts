import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { isPublishable } from "@/content/bg/editorial";
import { categoryByKey, getContent, isIndexableCategory } from "@/content";
import type { CaseStudy } from "@/content/types";
import { getDictionary } from "@/i18n";
import { localizePath, locales } from "@/i18n/config";
import { routes } from "@/lib/routes";
import { site } from "@/lib/site";

const sitemapPaths = new Set(sitemap().map((entry) => new URL(entry.url).pathname));
const withBrand = (title: string) => `${title} | ${site.name}`;

describe.each(locales)("SEO structure (%s)", (locale) => {
  const content = getContent(locale);
  const dict = getDictionary(locale);
  /** Public URL of an internal content path in this locale. */
  const url = (path: string) => localizePath(locale, path);

  /** The full <title> rendered for each mapped path (mirrors the page metadata). */
  const titles: Record<string, string> = {
    [routes.home]: withBrand(content.home.metaTitle),
    [routes.services]: withBrand(content.servicesPage.metaTitle),
    [routes.aiSolutions]: withBrand(content.aiSolutions.metaTitle),
    [routes.advisor]: withBrand(content.advisor.metaTitle),
    [routes.tools]: withBrand(content.toolsPage.metaTitle),
    [routes.industries]: withBrand(content.industries.metaTitle),
    [routes.process]: withBrand(content.processPage.metaTitle),
    [routes.about]: withBrand(content.about.metaTitle),
    [routes.contact]: withBrand(dict.contact.metaTitle),
    [routes.insights]: withBrand(content.insightsPage.metaTitle),
    ...Object.fromEntries(content.services.map((s) => [routes.service(s.slug), withBrand(s.metaTitle)])),
    ...Object.fromEntries(content.articles.map((a) => [routes.article(a.slug), withBrand(a.metaTitle ?? a.title)])),
  };

  describe("keyword-to-page map", () => {
    const map = content.keywordMap;

    it("assigns every primary keyword to exactly one page (no cannibalisation)", () => {
      const primaries = map.map((entry) => entry.primaryKeyword.toLowerCase());
      expect(new Set(primaries).size).toBe(primaries.length);
      expect(new Set(map.map((e) => e.path)).size).toBe(map.length);
    });

    it("never uses another page's primary keyword as a secondary keyword", () => {
      for (const entry of map) {
        for (const other of map) {
          if (other === entry) continue;
          expect(
            entry.secondaryKeywords.map((k) => k.toLowerCase()),
            `${entry.path} uses the primary keyword of ${other.path}`,
          ).not.toContain(other.primaryKeyword.toLowerCase());
        }
      }
    });

    it("puts the primary keyword in each page title", () => {
      for (const entry of map) {
        const title = titles[entry.path];
        expect(title, `no title known for ${entry.path}`).toBeDefined();
        expect(title.toLowerCase(), `${entry.path}: "${title}"`).toContain(entry.primaryKeyword.toLowerCase());
      }
    });

    it("only maps indexable URLs that are in the sitemap", () => {
      for (const entry of map) expect(sitemapPaths, entry.path).toContain(url(entry.path));
    });

    it("covers every service and every article", () => {
      const mapped = new Set(map.map((e) => e.path));
      for (const service of content.services) expect(mapped).toContain(routes.service(service.slug));
      for (const article of content.articles) expect(mapped).toContain(routes.article(article.slug));
    });

    it("marks search volume as unverified unless evidence is recorded", () => {
      for (const entry of map) {
        if (entry.volumeStatus === "verified") expect(entry.evidence, entry.path).toBeTruthy();
        else expect(entry.evidence).toBeUndefined();
      }
    });
  });

  describe("editorial structure", () => {
    const articleSlugs = new Set(content.articles.map((a) => a.key)); // cross-references use stable keys
    const categorySlugs = new Set(content.editorialCategories.map((c) => c.key));
    const serviceKeys = new Set(content.services.map((s) => s.key));
    const knownPaths = new Set([
      ...Object.values(routes).filter((r) => typeof r === "string"),
      ...content.services.map((s) => routes.service(s.slug)),
      ...content.articles.map((a) => routes.article(a.slug)),
      ...content.editorialCategories.map((c) => routes.insightsCategory(c.slug)),
    ]);

    it("articles reference existing categories, services and articles", () => {
      for (const article of content.articles) {
        expect(categorySlugs, article.slug).toContain(article.category);
        expect(serviceKeys).toContain(article.relatedService);
        expect(article.relatedServices).toContain(article.relatedService);
        for (const key of article.relatedServices) expect(serviceKeys).toContain(key);
        for (const slug of article.relatedArticles) {
          expect(articleSlugs, `${article.slug} → ${slug}`).toContain(slug);
          expect(slug).not.toBe(article.key);
        }
      }
    });

    it("articles carry editorial metadata", () => {
      for (const article of content.articles) {
        expect(article.keyPoints.length, article.slug).toBeGreaterThanOrEqual(3);
        expect(article.keyPoints.length, article.slug).toBeLessThanOrEqual(5);
        expect(article.updatedAt >= article.publishedAt, article.slug).toBe(true);
        expect(article.sections.length, article.slug).toBeGreaterThanOrEqual(5);
        expect((article.metaTitle ?? article.title).length, article.slug).toBeLessThanOrEqual(70);
      }
    });

    it("contextual links inside articles point to real pages", () => {
      for (const article of content.articles) {
        for (const section of article.sections) {
          for (const link of section.links ?? []) expect(knownPaths, `${article.slug}: ${link.href}`).toContain(link.href);
        }
      }
    });

    it("tables are well-formed", () => {
      for (const article of content.articles) {
        for (const section of article.sections) {
          if (!section.table) continue;
          for (const row of section.table.rows) expect(row.length, section.heading).toBe(section.table.headers.length);
        }
      }
    });

    it("services link to existing articles and have depth content", () => {
      for (const service of content.services) {
        expect(service.relatedArticles.length, service.key).toBeGreaterThan(0);
        for (const slug of service.relatedArticles) expect(articleSlugs, `${service.key} → ${slug}`).toContain(slug);
        expect(service.checks.length, service.key).toBeGreaterThanOrEqual(5);
        expect(service.workflow.length, service.key).toBe(4);
        expect(service.inputs.length, service.key).toBeGreaterThanOrEqual(3);
        const headings = Object.values(service.headings);
        expect(new Set(headings).size, service.key).toBe(headings.length);
      }
    });

    it("H2 headings are unique across service pages", () => {
      const all = content.services.flatMap((s) => Object.values(s.headings));
      expect(new Set(all).size).toBe(all.length);
    });

    it("every article is reachable from at least one service or another article", () => {
      const linked = new Set([
        ...content.services.flatMap((s) => s.relatedArticles),
        ...content.articles.flatMap((a) => a.relatedArticles),
      ]);
      for (const slug of articleSlugs) expect(linked, slug).toContain(slug);
    });
  });

  describe("case studies", () => {
    const draft: CaseStudy = {
      slug: "x",
      title: "x",
      description: "x",
      client: { name: "x", industry: "x", anonymised: true },
      services: ["seo"],
      challenge: "x",
      solution: ["x"],
      results: [{ metric: "x", value: "x", source: "Search Console", measuredAt: "2026-01-01" }],
      verification: { realProject: true, clientApproved: true, approvedBy: "Име", approvedAt: "2026-01-02" },
      publishedAt: "2026-01-03",
    };

    it("are only publishable when real, approved and sourced", () => {
      expect(isPublishable(draft)).toBe(true);
      expect(isPublishable({ ...draft, verification: { ...draft.verification, clientApproved: false } })).toBe(false);
      expect(isPublishable({ ...draft, verification: { ...draft.verification, realProject: false } })).toBe(false);
      expect(isPublishable({ ...draft, verification: { ...draft.verification, approvedBy: " " } })).toBe(false);
      expect(isPublishable({ ...draft, results: [{ ...draft.results[0], source: "" }] })).toBe(false);
    });

    it("no unverified case study is exposed (currently none exist)", () => {
      expect(content.caseStudies.every(isPublishable)).toBe(true);
      expect(content.caseStudies).toHaveLength(0);
      expect([...sitemapPaths].some((p) => p.startsWith(url(routes.caseStudies)))).toBe(false);
    });
  });

  describe("sitemap and robots policy", () => {
    it("omits draft legal pages and thin topic pages", () => {
      expect(content.legal.isDraft).toBe(true);
      for (const path of [routes.privacy, routes.cookies, routes.terms]) expect(sitemapPaths).not.toContain(url(path));
      for (const category of content.editorialCategories) {
        const path = url(routes.insightsCategory(category.slug));
        if (isIndexableCategory(locale, category.key)) expect(sitemapPaths).toContain(path);
        else expect(sitemapPaths).not.toContain(path);
      }
      expect(sitemapPaths).toContain(url(routes.insightsCategory(categoryByKey(locale, "avtomatizatsiya")!.slug)));
    });

    it("dates every entry", () => {
      for (const entry of sitemap()) expect(entry.lastModified, entry.url).toBeTruthy();
    });
  });
});
