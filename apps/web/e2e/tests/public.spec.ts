import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  // V5 homepage (docs/V5_VISUAL_DIRECTION.md §6): websites, stores and AI first; every CTA works with the default flags.
  test("homepage renders the hero, its two working CTAs, the four directions and the labelled previews", async ({ page }) => {
    const response = await page.goto("/bg");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/A\.I\. Commerce Studio/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Изработваме сайтове, онлайн магазини");
    await expect(page.getByTestId("hero-primary")).toHaveAttribute("href", "/bg/uslugi");
    await expect(page.getByTestId("hero-secondary")).toHaveAttribute("href", "/bg/kontakti?tip=oferta");
    // The configurator is switched off by default: no link to it anywhere on the page.
    await expect(page.locator("a[href*='konfigurator']")).toHaveCount(0);
    await expect(page.getByTestId("configurator-entry")).toHaveCount(0);
    await expect(page.getByTestId("hero-preview")).toContainText("Демонстрация");
    const showcase = page.getByTestId("home-showcase");
    await expect(showcase.locator(":scope > li")).toHaveCount(4);
    await expect(showcase.getByRole("heading", { level: 3 })).toHaveText(["Уебсайт", "Онлайн магазин", "Интерактивна платформа", "AI автоматизация"]);
    // Static vs interactive, the three store platforms, the six stages and the entry offers.
    await expect(page.getByTestId("static-vs-interactive")).toContainText("Статичен");
    await expect(page.locator("section[aria-labelledby='stores-title'] ul > li")).toHaveCount(3);
    await expect(page.getByTestId("home-timeline").locator(":scope > li")).toHaveCount(6);
    await expect(page.getByTestId("home-offer-landing_page")).toContainText("Цена в писмена оферта");
    await expect(page.getByTestId("home-offer-business_website")).toContainText("€");
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  });

  test("English homepage mirrors the structure with English destinations", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Websites, e-commerce stores");
    await expect(page.getByTestId("hero-primary")).toHaveAttribute("href", "/en/services");
    await expect(page.getByTestId("hero-secondary")).toHaveAttribute("href", "/en/contact?type=quote");
    for (const id of ["showcase-title", "websites-title", "stores-title", "process-title", "tools-title", "offers-title", "credibility-title", "founder-title", "faq-title"]) {
      await expect(page.locator(`[id="${id}"]`)).toBeVisible();
    }
    await expect(page.getByTestId("home-timeline").locator(":scope > li")).toHaveCount(6);
    await expect(page.getByTestId("home-showcase").locator(":scope > li")).toHaveCount(4);
  });

  test("tools preview links only to live tools and labelled demonstrations; upcoming tools are not linked", async ({ page }) => {
    await page.goto("/en");
    const tools = page.locator("section[aria-labelledby='tools-title']");
    const links = await tools.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(new Set(links)).toEqual(
      new Set([
        "/en/tools",
        "/en/ai-automation-advisor",
        "/en/tools/ai-readiness",
        "/en/tools/ai-team",
        "/en/tools/roi-calculator",
        "/en/demo-centre",
        "/en/reference-scenarios",
      ]),
    );
    const planned = tools.locator("article[data-status='planned']");
    await expect(planned).toHaveCount(0);
    await expect(planned.getByRole("link")).toHaveCount(0);
  });

  test("homepage journeys: quote request, first tool, a website type and the care plans", async ({ page }) => {
    await page.goto("/bg");
    await page.getByTestId("hero-secondary").click();
    await expect(page).toHaveURL(/\/bg\/kontakti\?tip=oferta$/);
    await expect(page.locator("form").first()).toBeVisible();

    await page.goto("/bg");
    const tools = page.locator("section[aria-labelledby='tools-title']");
    await expect(tools.getByTestId("tool-start-here")).toHaveText("Започнете оттук");

    await page.locator("section[aria-labelledby='websites-title']").getByRole("link", { name: "Статичен фирмен сайт" }).click();
    await expect(page).toHaveURL(/\/bg\/izrabotka-na-saytove#static$/);
    await expect(page.locator("#static")).toBeVisible();

    await page.goto("/en");
    const care = page.getByTestId("home-offer-care");
    await expect(care).toContainText("Care after launch");
    await care.getByRole("link", { name: "Care plans" }).click();
    await expect(page).toHaveURL(/\/en\/care-plans$/);
    await expect(page.getByTestId("care-matrix")).toBeVisible();
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
