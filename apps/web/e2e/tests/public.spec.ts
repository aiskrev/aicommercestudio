import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  test("homepage renders the hero, CTAs and the six offerings", async ({ page }) => {
    const response = await page.goto("/bg");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/A\.I\. Commerce Studio/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI системи");
    const hero = page.locator("main").getByRole("link", { name: "Разгледайте AI решенията" });
    await expect(hero).toHaveAttribute("href", "/bg/ai-resheniya");
    await expect(page.getByRole("link", { name: "Оценете AI готовността си" })).toHaveAttribute("href", "/bg/ai-automation-advisor");
    await expect(page.getByTestId("system-map")).toBeVisible();
    const build = page.locator("section[aria-labelledby='build-title']");
    await expect(build.locator("article")).toHaveCount(6);
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  });

  test("English homepage mirrors the structure with English destinations", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("AI systems");
    await expect(page.getByRole("link", { name: "Explore AI solutions" })).toHaveAttribute("href", "/en/ai-solutions");
    await expect(page.getByRole("link", { name: "Assess your AI readiness" })).toHaveAttribute("href", "/en/ai-automation-advisor");
    for (const id of ["build-title", "process-title", "tools-title", "orchestration-title", "use-cases-title", "faq-title"]) {
      await expect(page.locator(`[id="${id}"]`)).toBeVisible();
    }
    await expect(page.locator("section[aria-labelledby='process-title'] ol > li")).toHaveCount(5);
  });

  test("tools preview links only to the live tool; upcoming tools are labelled, not linked", async ({ page }) => {
    await page.goto("/en");
    const tools = page.locator("section[aria-labelledby='tools-title']");
    const links = await tools.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(new Set(links)).toEqual(new Set(["/en/tools", "/en/ai-automation-advisor", "/en/tools/ai-readiness"]));
    const planned = tools.locator("article[data-status='planned']");
    await expect(planned).toHaveCount(2);
    await expect(planned.getByRole("link")).toHaveCount(0);
  });

  test("hero CTA navigates to the AI solutions page", async ({ page }) => {
    await page.goto("/bg");
    await page.locator("main").getByRole("link", { name: "Разгледайте AI решенията" }).click();
    await expect(page).toHaveURL(/\/ai-resheniya$/);
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
