import { expect, test } from "@playwright/test";

// The four commercial directions of the V5 homepage (app/[locale]/page.tsx, content/{bg,en}/v5.ts → home.showcase).
const CARDS = [
  { key: "website", service: "business_websites", bg: "/bg/izrabotka-na-saytove", en: "/en/website-development" },
  { key: "store", service: "store_development", bg: "/bg/online-magazini", en: "/en/ecommerce" },
  { key: "platform", service: "portals_web_apps", bg: "/bg/uslugi/klientski-portali-i-uebprilozheniya", en: "/en/services/customer-portals-and-web-applications" },
  { key: "ai", service: "automation", bg: "/bg/uslugi/avtomatizatsiya-na-procesi", en: "/en/services/business-process-automation" },
];
const WIDTHS = [360, 390, 768, 1024, 1440];

for (const width of WIDTHS) {
  test(`homepage entry points fit and stay usable at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const path of ["/bg", "/en"]) {
      await page.goto(path);
      const section = page.getByTestId("home-showcase");
      await section.scrollIntoViewIfNeeded();
      await expect(section.locator(":scope > li")).toHaveCount(CARDS.length);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll, `${path} @${width}: horizontal overflow`).toBeLessThanOrEqual(sizes.client);
      for (const { key } of CARDS) {
        const box = await page.getByTestId(`showcase-${key}`).boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= width, `${key} inside the screen`).toBe(true);
      }
    }
    await context.close();
  });
}

test("each entry point opens its page and the quote form for its service, with an indicative price", async ({ page }) => {
  await page.goto("/bg");
  for (const card of CARDS) {
    await expect(page.getByTestId(`showcase-link-${card.key}`)).toHaveAttribute("href", card.bg);
    await expect(page.getByTestId(`showcase-quote-${card.key}`)).toHaveAttribute("href", `/bg/kontakti?usluga=${card.service}&tip=oferta`);
    await expect(page.getByTestId(`showcase-price-${card.key}`)).toContainText("€");
  }
  await page.getByTestId("showcase-link-store").click();
  await expect(page).toHaveURL(/\/bg\/online-magazini$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/en");
  for (const card of CARDS) {
    await expect(page.getByTestId(`showcase-link-${card.key}`)).toHaveAttribute("href", card.en);
    await expect(page.getByTestId(`showcase-quote-${card.key}`)).toHaveAttribute("href", `/en/contact?service=${card.service}&type=quote`);
  }
  // The language never selects a price: the same amounts in both languages.
  const amounts = async (path: string) => {
    await page.goto(path);
    return Promise.all(CARDS.map(({ key }) => page.getByTestId(`showcase-price-${key}`).innerText().then((text) => text.replace(/[^\d]/g, ""))));
  };
  expect(await amounts("/en")).toEqual(await amounts("/bg"));
});

test("entry point links are reachable by keyboard and show a focus ring", async ({ page }) => {
  await page.goto("/bg");
  const quote = page.getByTestId("showcase-quote-website");
  await page.keyboard.press("Tab"); // keyboard modality, so :focus-visible applies to the focus below
  await quote.focus();
  await expect(quote).toBeFocused();
  const outline = await quote.evaluate((el) => {
    const style = getComputedStyle(el);
    return `${style.outlineStyle} ${style.outlineWidth} ${style.boxShadow}`;
  });
  expect(outline).not.toBe("none 0px none");
});
