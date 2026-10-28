import { expect, test } from "@playwright/test";

test.describe("public website", () => {
  test("homepage renders the hero, the consultation and assessment CTAs and the four capability groups", async ({ page }) => {
    const response = await page.goto("/bg");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/A\.I\. Commerce Studio/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Инженеринг");
    const hero = page.locator("main").getByRole("link", { name: "Заявете консултация" }).first();
    await expect(hero).toHaveAttribute("href", "/bg/kontakti");
    await expect(page.getByRole("link", { name: "Оценете AI готовността си" })).toHaveAttribute("href", "/bg/ai-automation-advisor");
    await expect(page.getByTestId("system-map")).toBeVisible();
    const offer = page.locator("section[aria-labelledby='offer-title']");
    await expect(offer.locator("article")).toHaveCount(4);
    await expect(offer.getByRole("heading", { level: 3 })).toHaveText(["AI", "Облак и данни", "Платформи и експлоатация", "Електронна търговия"]);
    await expect(offer.locator("article a")).toHaveCount(10); // the ten domain hubs, not every service
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
  });

  test("English homepage mirrors the structure with English destinations", async ({ page }) => {
    await page.goto("/en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Engineering");
    await expect(page.locator("main").getByRole("link", { name: "Book a consultation" }).first()).toHaveAttribute("href", "/en/contact");
    await expect(page.getByRole("link", { name: "Assess your AI readiness" })).toHaveAttribute("href", "/en/ai-automation-advisor");
    for (const id of ["offer-title", "tools-title", "managed-title", "process-title", "orchestration-title", "founder-title", "credibility-title", "faq-title"]) {
      await expect(page.locator(`[id="${id}"]`)).toBeVisible();
    }
    await expect(page.locator("section[aria-labelledby='process-title'] ol > li")).toHaveCount(5);
  });

  test("tools preview links only to the live tool; upcoming tools are labelled, not linked", async ({ page }) => {
    await page.goto("/en");
    const tools = page.locator("section[aria-labelledby='tools-title']");
    const links = await tools.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(new Set(links)).toEqual(
      new Set(["/en/tools", "/en/ai-automation-advisor", "/en/tools/ai-readiness", "/en/tools/ai-team", "/en/tools/roi-calculator"]),
    );
    const planned = tools.locator("article[data-status='planned']");
    await expect(planned).toHaveCount(0);
    await expect(planned.getByRole("link")).toHaveCount(0);
  });

  test("homepage journeys: consultation, first tool, a domain hub and AI Managed Services", async ({ page }) => {
    await page.goto("/bg");
    await page.locator("main").getByRole("link", { name: "Заявете консултация" }).first().click();
    await expect(page).toHaveURL(/\/bg\/kontakti$/);
    await expect(page.locator("form").first()).toBeVisible();

    await page.goto("/bg");
    const tools = page.locator("section[aria-labelledby='tools-title']");
    await expect(tools.getByTestId("tool-start-here")).toHaveText("Започнете оттук");

    await page.locator("section[aria-labelledby='offer-title']").getByRole("link", { name: "DevOps, SRE и наблюдаемост" }).click();
    await expect(page).toHaveURL(/\/bg\/uslugi\/devops-sre-i-nablyudaemost$/);

    await page.goto("/en");
    const managed = page.locator("section[aria-labelledby='managed-title']");
    await expect(managed.getByTestId("managed-packages")).toContainText("AI Monitor");
    await managed.getByRole("link", { name: "Request an assessment" }).click();
    await expect(page).toHaveURL(/\/en\/services\/ai-managed-services#ams-inquiry$/);
    await expect(page.locator("#ams-inquiry")).toBeVisible();
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
