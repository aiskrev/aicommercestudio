import { describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { getContent } from "@/content";
import { localizePath, toPublicPath } from "@/i18n/config";
import { safeAdminRedirect } from "@/lib/admin-api";
import { decideRoute } from "@/lib/locale-routing";
import { buildMetadata, faqJsonLd } from "@/lib/seo";

describe("decideRoute", () => {
  it("rewrites unprefixed public paths to the default locale", () => {
    expect(decideRoute("/", false)).toEqual({ type: "rewrite", pathname: "/bg" });
    expect(decideRoute("/uslugi/seo-optimizatsiya", false)).toEqual({
      type: "rewrite",
      pathname: "/bg/uslugi/seo-optimizatsiya",
    });
  });

  it("redirects the default-locale prefix to the canonical URL", () => {
    expect(decideRoute("/bg", false)).toEqual({ type: "redirect", location: "/" });
    expect(decideRoute("/bg/kontakti", false)).toEqual({ type: "redirect", location: "/kontakti" });
  });

  it("guards admin pages without a session cookie", () => {
    expect(decideRoute("/admin", false)).toEqual({ type: "redirect", location: "/admin/login?next=%2Fadmin" });
    expect(decideRoute("/admin/leads", false)).toEqual({
      type: "redirect",
      location: "/admin/login?next=%2Fadmin%2Fleads",
    });
    expect(decideRoute("/admin/login", false)).toEqual({ type: "next" });
    expect(decideRoute("/admin/leads", true)).toEqual({ type: "next" });
  });

  it("does not treat look-alike paths as admin", () => {
    expect(decideRoute("/administration", false)).toEqual({ type: "rewrite", pathname: "/bg/administration" });
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

describe("SEO helpers", () => {
  it("builds canonical URLs without the default locale prefix", () => {
    const meta = buildMetadata({ locale: "bg", title: "T", description: "D", path: "/uslugi" });
    expect(meta.alternates?.canonical).toBe("/uslugi");
    expect(localizePath("bg", "/")).toBe("/");
  });

  it("produces a valid FAQPage structure", () => {
    const data = faqJsonLd([{ question: "Q?", answer: "A." }]);
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity[0].acceptedAnswer.text).toBe("A.");
  });

  it("sitemap lists every public page, service and article", () => {
    const urls = sitemap().map((entry) => new URL(entry.url).pathname);
    const { services, articles } = getContent("bg");
    for (const service of services) expect(urls).toContain(`/uslugi/${service.slug}`);
    for (const article of articles) expect(urls).toContain(`/statii/${article.slug}`);
    for (const path of ["/", "/uslugi", "/kontakti", "/za-nas", "/proces", "/za-kogo", "/ai-resheniya", "/statii"]) {
      expect(urls).toContain(path);
    }
    expect(urls.some((u) => u.startsWith("/admin"))).toBe(false);
  });

  it("robots.txt blocks admin and API paths", () => {
    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule.disallow).toEqual(expect.arrayContaining(["/admin", "/api/"]));
  });
});

describe("toPublicPath", () => {
  it.each([
    ["/bg", "/"],
    ["/bg/uslugi", "/uslugi"],
    ["/bg/uslugi/seo-optimizatsiya", "/uslugi/seo-optimizatsiya"],
    ["/uslugi", "/uslugi"],
    ["/bgx/test", "/bgx/test"],
    ["/admin", "/admin"],
  ])("%s -> %s", (input, expected) => {
    expect(toPublicPath(input)).toBe(expected);
  });
});
