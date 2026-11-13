import { expect, test } from "@playwright/test";

// Project packages (/bg/proektni-paketi ↔ /en/project-packages): typical scopes of the build services.
const KEYS = ["landing_page", "business_website", "store_setup", "store_complete", "custom_web_app"];
const PAGES = [
  { path: "/bg/proektni-paketi", h1: "Пакети за сайтове и онлайн магазини", quote: "Поискайте оферта", onQuote: "Цена в писмена оферта", from: /^от [\d\s]+€$/ },
  { path: "/en/project-packages", h1: "Packages for websites and online stores", quote: "Request a quote", onQuote: "Price in a written quote", from: /^From €[\d,]+$/ },
] as const;

for (const item of PAGES) {
  test(`${item.path}: five packages with scope, price rule and a quote link each`, async ({ page }) => {
    const response = await page.goto(item.path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.h1);
    const cards = page.getByTestId("project-packages").locator("article");
    await expect(cards).toHaveCount(KEYS.length);
    for (const key of KEYS) {
      const card = page.getByTestId(`package-${key}`);
      const quote = card.getByRole("link", { name: item.quote });
      await expect(quote).toHaveAttribute("href", /(tip=oferta|type=quote)/);
      await expect(quote).toHaveAttribute("href", /(usluga|service)=(business_websites|store_development|portals_web_apps)/);
    }
    // The two smaller scopes have no separately approved price; the others show the published band.
    for (const key of ["landing_page", "store_setup"]) {
      await expect(page.getByTestId(`package-price-${key}`)).toContainText(item.onQuote);
      await expect(page.getByTestId(`package-price-${key}`)).not.toContainText("€");
    }
    for (const key of ["business_website", "store_complete", "custom_web_app"]) {
      await expect(page.getByTestId(`package-price-${key}`).locator("p.font-display")).toHaveText(item.from);
    }
    // Comparison table, the two care plans (linked, not repeated) and the FAQ.
    await expect(page.getByTestId("package-comparison").locator("tbody tr")).toHaveCount(KEYS.length);
    await expect(page.getByTestId("package-care").getByRole("listitem")).toHaveCount(2);
    await expect(page.locator("details").filter({ hasText: /binding|Обвързващи/ }).first()).toBeVisible();
    // No price in structured data.
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.join(" ")).not.toMatch(/"offers"|"price"/);
  });
}

test("both languages show the same amounts and point at each other", async ({ page }) => {
  const amounts: string[][] = [];
  for (const item of PAGES) {
    await page.goto(item.path);
    const texts = await page.getByTestId("project-packages").locator("p.font-display").allTextContents();
    amounts.push(texts.map((text) => text.replace(/\D/g, "")));
  }
  expect(amounts[0]).toEqual(amounts[1]);
  await page.goto("/bg/proektni-paketi");
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/project-packages$/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/bg\/proektni-paketi$/);
});

test("the packages are reachable from the homepage, the menu, a hub, a service page and the sitemap", async ({ page, request }) => {
  await page.goto("/bg");
  await page.locator("section[aria-labelledby='offers-title']").getByRole("link", { name: "Сравнете всички пакети" }).click();
  await expect(page).toHaveURL(/\/bg\/proektni-paketi$/);
  // The "Packages & pricing" menu of the V5 header and the packages section of the website hub.
  // The menu panel exists only while open: show the desktop menu (1440 px) and open it.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId("menu-pricing").click();
  await expect(page.getByTestId("panel-pricing").locator("a[href='/bg/proektni-paketi']")).toHaveText(/^Пакети за проекти/);
  await page.goto("/bg/izrabotka-na-saytove");
  await expect(page.getByTestId("hub-package-landing_page").getByRole("link", { name: /Технологии, дизайн/ })).toHaveAttribute("href", "/bg/proektni-paketi#landing_page");

  await page.goto("/bg/uslugi/izrabotka-na-online-magazini");
  await expect(page.getByTestId("service-packages-link")).toHaveAttribute("href", "/bg/proektni-paketi#store_setup");
  await page.goto("/bg/uslugi/seo-optimizatsiya");
  await expect(page.getByTestId("service-packages-link")).toHaveCount(0); // only services that have packages

  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Пакети за проекти" })).toHaveAttribute("href", "/bg/proektni-paketi");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/bg/proektni-paketi");
  expect(sitemap).toContain("/en/project-packages");
});

test("the details open with the keyboard and the old internal English path is not public", async ({ page }) => {
  await page.goto("/en/project-packages");
  const summary = page.getByTestId("package-business_website").locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("package-business_website").getByText("Typical stages")).toBeVisible();
  await page.goto("/en/proektni-paketi"); // the Bulgarian folder name is not an English public URL
  await expect(page).toHaveURL(/\/en\/project-packages$/);
});

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`project packages fit at ${width}px in both languages`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const item of PAGES) {
      await page.goto(item.path);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll, `${item.path} @${width}: horizontal overflow`).toBeLessThanOrEqual(sizes.client);
      for (const key of KEYS) {
        const box = await page.getByTestId(`package-${key}`).boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= width, `${key} inside the screen`).toBe(true);
      }
    }
    await context.close();
  });
}
