import { expect, test } from "@playwright/test";

// Pricing overview (/bg/tseni ↔ /en/pricing): every published band on one page, read from lib/prices.ts.
const GROUPS = { projects: 11, monthly: 4, "ai-managed": 3, "care-plans": 5, workshops: 10 } as const;
const PAGES = [
  { path: "/bg/tseni", h1: "Ориентировъчни цени на услугите", month: "на месец", from: /^Начална цена: от [\d\s]+€/ },
  { path: "/en/pricing", h1: "Indicative prices of the services", month: "per month", from: /^Starting price: From €[\d,]+/ },
] as const;

const digits = (text: string) => text.replace(/\D/g, "");

for (const item of PAGES) {
  test(`${item.path}: every band, grouped by one-time and monthly, with the note and the exclusions`, async ({ page }) => {
    const response = await page.goto(item.path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.h1);
    await expect(page.getByTestId("pricing-note")).toContainText(/ДДС|VAT/); // the tax treatment is stated, not assumed
    for (const [group, count] of Object.entries(GROUPS)) {
      const rows = page.getByTestId(`pricing-${group}`).locator("[data-price-row]");
      await expect(rows, group).toHaveCount(count);
      for (const from of await rows.locator('[data-price="from"]').allTextContents()) {
        expect(from, group).toMatch(item.from);
        // One-time prices never say "per month"; recurring ones always do.
        expect(from.includes(item.month), `${group}: ${from}`).toBe(group !== "projects" && group !== "workshops");
      }
    }
    await expect(page.getByTestId("pricing-excluded").getByRole("listitem")).toHaveCount(5);
    await expect(page.getByTestId("pricing-how").getByRole("listitem")).toHaveCount(3);
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.join(" ")).not.toMatch(/"offers"|"price"/);
  });
}

test("both languages show the same amounts, and a row matches its service page", async ({ page }) => {
  const amounts: Record<string, string>[] = [];
  for (const item of PAGES) {
    await page.goto(item.path);
    const rows = page.locator("[data-price-row]");
    const found: Record<string, string> = {};
    for (let index = 0; index < (await rows.count()); index += 1) {
      const row = rows.nth(index);
      found[`${index}:${await row.getAttribute("data-price-row")}`] = digits((await row.locator("p").allTextContents()).join("|"));
    }
    amounts.push(found);
  }
  expect(amounts[0]).toEqual(amounts[1]);

  await page.goto("/bg/tseni");
  const row = page.locator('[data-price-row="store_development"]');
  const onOverview = digits(await row.locator('[data-price="from"]').innerText());
  await row.getByRole("link").click();
  await expect(page).toHaveURL(/\/bg\/uslugi\/izrabotka-na-online-magazini$/);
  expect(digits(await page.getByTestId("service-price").locator("p").first().innerText())).toBe(onOverview);
});

test("the pricing page is linked from the menu, the footer, the packages page, the search and the sitemap", async ({ page, request }) => {
  await page.goto("/bg");
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Цени", exact: true })).toHaveAttribute("href", "/bg/tseni");
  await page.goto("/bg/proektni-paketi");
  await page.locator("main").getByRole("link", { name: "Ориентировъчни цени на услугите" }).click();
  await expect(page).toHaveURL(/\/bg\/tseni$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/pricing$/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/bg/tseni");
  expect(sitemap).toContain("/en/pricing");
});

for (const width of [360, 390, 768, 1024, 1440]) {
  test(`pricing fits at ${width}px in both languages`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const item of PAGES) {
      await page.goto(item.path);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll, `${item.path} @${width}: horizontal overflow`).toBeLessThanOrEqual(sizes.client);
      const box = await page.locator('[data-price-row="portals_web_apps"]').boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
    }
    await context.close();
  });
}
