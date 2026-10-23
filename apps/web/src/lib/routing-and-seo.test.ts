import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { articleRoutePaths, buildSlugMap, getContent, serviceRoutePaths } from "@/content";
import { alternateLocalePath, localizePath, toCanonicalPath, toInternalPath, toPublicPath } from "@/i18n/config";
import { safeAdminRedirect } from "@/lib/admin-api";
import { decideRoute } from "@/lib/locale-routing";
import { buildMetadata, faqJsonLd } from "@/lib/seo";

describe("decideRoute", () => {
  it("sends the root to the preferred or default language (temporary redirect)", () => {
    expect(decideRoute("/", false)).toEqual({ type: "redirect", location: "/bg", permanent: false });
    expect(decideRoute("/", false, "en")).toEqual({ type: "redirect", location: "/en", permanent: false });
    expect(decideRoute("/", false, "de")).toEqual({ type: "redirect", location: "/bg", permanent: false });
    expect(decideRoute("/", false, null, "?utm_source=x")).toEqual({
      type: "redirect",
      location: "/bg?utm_source=x",
      permanent: false,
    });
  });

  it("permanently redirects legacy unprefixed URLs to the Bulgarian ones", () => {
    expect(decideRoute("/uslugi/seo-optimizatsiya", false)).toEqual({
      type: "redirect",
      location: "/bg/uslugi/seo-optimizatsiya",
      permanent: true,
    });
    expect(decideRoute("/kontakti", false, "en", "?usluga=seo")).toEqual({
      type: "redirect",
      location: "/bg/kontakti?usluga=seo",
      permanent: true,
    });
  });

  it("serves Bulgarian URLs as they are", () => {
    expect(decideRoute("/bg", false)).toEqual({ type: "next" });
    expect(decideRoute("/bg/kontakti", false)).toEqual({ type: "next" });
  });

  it("rewrites English public URLs to the internal tree", () => {
    expect(decideRoute("/en", false)).toEqual({ type: "next" });
    expect(decideRoute("/en/services", false)).toEqual({ type: "rewrite", pathname: "/en/uslugi" });
    expect(decideRoute("/en/services/ai-managed-services", false)).toEqual({
      type: "rewrite",
      pathname: "/en/uslugi/ai-managed-services",
    });
    expect(decideRoute("/en/insights/topic/seo", false)).toEqual({ type: "rewrite", pathname: "/en/statii/tema/seo" });
  });

  it("redirects Bulgarian segment names under /en to the canonical English URL", () => {
    expect(decideRoute("/en/kontakti", false, null, "?usluga=seo&tip=oferta")).toEqual({
      type: "redirect",
      location: "/en/contact?service=seo&type=quote",
      permanent: true,
    });
  });

  it("guards admin pages without a session cookie", () => {
    expect(decideRoute("/admin", false)).toEqual({
      type: "redirect",
      location: "/admin/login?next=%2Fadmin",
      permanent: false,
    });
    expect(decideRoute("/admin/leads", false)).toEqual({
      type: "redirect",
      location: "/admin/login?next=%2Fadmin%2Fleads",
      permanent: false,
    });
    expect(decideRoute("/admin/login", false)).toEqual({ type: "next" });
    expect(decideRoute("/admin/leads", true)).toEqual({ type: "next" });
  });

  it("does not treat look-alike paths as admin", () => {
    expect(decideRoute("/administration", false)).toEqual({
      type: "redirect",
      location: "/bg/administration",
      permanent: true,
    });
  });
});

describe("safeAdminRedirect", () => {
  it.each([
    ["/admin/leads?status=NEW", "/admin/leads?status=NEW"],
    ["https://evil.example", "/admin"],
    ["//evil.example", "/admin"],
    ["/admin/login", "/admin"],
    [undefined, "/admin"],
  ])("%s -> %s", (input, expected) => {
    expect(safeAdminRedirect(input)).toBe(expected);
  });
});

describe("locale path mapping", () => {
  it.each([
    ["bg", "/", "/bg"],
    ["bg", "/uslugi", "/bg/uslugi"],
    ["en", "/", "/en"],
    ["en", "/uslugi/ai-managed-services", "/en/services/ai-managed-services"],
    ["en", "/za-kogo", "/en/industries"],
    ["en", "/statii/tema/seo", "/en/insights/topic/seo"],
    ["en", "/kontakti?usluga=ai_managed&tip=oferta", "/en/contact?service=ai_managed&type=quote"],
  ] as const)("localizePath(%s, %s) -> %s", (locale, path, expected) => {
    expect(localizePath(locale, path)).toBe(expected);
  });

  it.each([
    ["/bg", "/bg"],
    ["/bg/uslugi", "/bg/uslugi"],
    ["/en/uslugi", "/en/services"],
    ["/uslugi", "/uslugi"],
    ["/bgx/test", "/bgx/test"],
    ["/admin", "/admin"],
  ])("toPublicPath(%s) -> %s", (input, expected) => {
    expect(toPublicPath(input)).toBe(expected);
  });

  it("round-trips English URLs through the internal tree", () => {
    expect(toInternalPath("/en/case-studies")).toBe("/en/proekti");
    expect(toCanonicalPath("/en/services/seo-optimization")).toBe("/uslugi/seo-optimization");
  });

  it("maps the language switcher to the equivalent page", () => {
    const slugs = buildSlugMap();
    expect(alternateLocalePath("/bg/uslugi/ai-managed-services", "", "en", slugs)).toBe(
      "/en/services/ai-managed-services",
    );
    expect(alternateLocalePath("/en/services/seo-optimization", "", "bg", slugs)).toBe("/bg/uslugi/seo-optimizatsiya");
    expect(alternateLocalePath("/bg/kontakti", "?usluga=seo&utm_source=x", "en", slugs)).toBe("/en/contact?service=seo");
    expect(alternateLocalePath("/en/insights/topic/seo", "", "bg", slugs)).toBe("/bg/statii/tema/seo");
    // Pages without a translation fall back to the other language's home page.
    expect(alternateLocalePath("/bg/uslugi/nesashtestvuvashta", "", "en", slugs)).toBe("/en");
    expect(alternateLocalePath("/bg/proekti/primer", "", "en", slugs)).toBe("/en");
  });

  it("exposes the localized URL for every service and article", () => {
    expect(serviceRoutePaths("ai_managed")).toEqual({
      bg: "/uslugi/ai-managed-services",
      en: "/uslugi/ai-managed-services",
    });
    for (const article of getContent("bg").articles) {
      const { paths, availableIn } = articleRoutePaths(article.key);
      expect(paths.bg).toBe(`/statii/${article.slug}`);
      expect(availableIn).toContain("bg");
    }
  });
});

describe("SEO helpers", () => {
  it("builds canonical URLs and reciprocal hreflang alternates", () => {
    const meta = buildMetadata({ locale: "en", title: "T", description: "D", path: "/uslugi" });
    expect(meta.alternates?.canonical).toBe("/en/services");
    expect(meta.alternates?.languages).toEqual({ bg: "/bg/uslugi", en: "/en/services", "x-default": "/bg/uslugi" });
    expect(meta.openGraph?.locale).toBe("en_US");
  });

  it("produces a valid FAQPage structure", () => {
    const data = faqJsonLd([{ question: "Q?", answer: "A." }]);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity[0].acceptedAnswer.text).toBe("A.");
  });

  it("sitemap lists every public page, service and article in both languages", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => new URL(entry.url).pathname);
    for (const locale of ["bg", "en"] as const) {
      const { services, articles } = getContent(locale);
      for (const service of services) expect(urls).toContain(localizePath(locale, `/uslugi/${service.slug}`));
      for (const article of articles) expect(urls).toContain(localizePath(locale, `/statii/${article.slug}`));
      for (const path of ["/", "/uslugi", "/kontakti", "/za-nas", "/proces", "/za-kogo", "/ai-resheniya", "/statii"]) {
        expect(urls).toContain(localizePath(locale, path));
      }
    }
    expect(urls).toContain("/en/services/ai-managed-services");
    expect(urls.some((u) => u.startsWith("/admin"))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
    for (const entry of entries) {
      const languages = entry.alternates?.languages ?? {};
      // Every alternate points back to a URL that is itself in the sitemap (reciprocity).
      for (const href of Object.values(languages)) expect(urls).toContain(new URL(String(href)).pathname);
    }
  });

  it("robots.txt blocks admin and API paths", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).toEqual(expect.arrayContaining(["/admin", "/api/"]));
  });
});
