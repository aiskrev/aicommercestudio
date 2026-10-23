import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  test("homepage renders the hero, CTAs and seven services", async ({ page }) => {
    const response = await page.goto("/bg");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/A\.I\. Commerce Studio/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI решения");
    await expect(page.getByRole("link", { name: "Заяви консултация" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Разгледай услугите" })).toBeVisible();
    const servicesSection = page.locator("section[aria-labelledby='services-title']");
    await expect(servicesSection.locator("article")).toHaveCount(7);
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  });

  test("CTA navigates to the contact page", async ({ page }) => {
    await page.goto("/bg");
    await page.getByRole("link", { name: "Разгледай услугите" }).click();
    await expect(page).toHaveURL(/\/uslugi$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("service pages have unique SEO metadata and structured data", async ({ page }) => {
    const slugs = [
      "poddrazhka-na-online-magazini",
      "seo-optimizatsiya",
      "ai-instrumenti-za-biznesa",
      "avtomatizatsiya-na-procesi",
      "analizi-i-konversii",
      "api-integratsii-oblak-i-sigurnost",
      "tehnicheski-odit",
      "ai-managed-services",
    ];
    const titles = new Set<string>();
    for (const slug of slugs) {
      const response = await page.goto(`/bg/uslugi/${slug}`);
      expect(response?.status(), slug).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      titles.add(await page.title());
      const canonical = await page.locator("link[rel='canonical']").getAttribute("href");
      expect(canonical).toMatch(new RegExp(`/bg/uslugi/${slug}$`));
      const description = await page.locator("meta[name='description']").getAttribute("content");
      expect(description?.length ?? 0).toBeGreaterThan(70);
      const jsonLd = await page.locator("script[type='application/ld+json']").allTextContents();
      expect(jsonLd.join(" ")).toContain('"@type":"Service"');
    }
    expect(titles.size).toBe(slugs.length);
  });

  test("security headers are sent", async ({ request }) => {
    const response = await request.get("/bg");
    const headers = response.headers();
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("robots.txt and sitemap.xml are served", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(await robots.text()).toContain("Disallow: /admin");
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    expect(xml).toContain("/bg/uslugi/seo-optimizatsiya");
    expect(xml).toContain("/en/services/seo-optimization");
  });

  test("unknown pages return 404 with a helpful page", async ({ page }) => {
    const response = await page.goto("/bg/tazi-stranitsa-ne-sashtestvuva");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Страницата не е намерена" })).toBeVisible();
  });

  test("no third-party requests are made", async ({ page, baseURL }) => {
    const origins = new Set<string>();
    page.on("request", (req) => origins.add(new URL(req.url()).origin));
    await page.goto("/bg");
    await page.waitForLoadState("networkidle");
    expect([...origins].filter((o) => o !== new URL(baseURL!).origin && !o.startsWith("data:"))).toEqual([]);
  });
});
