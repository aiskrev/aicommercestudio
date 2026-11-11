import { expect, test } from "@playwright/test";

// The five commercial entry points of the homepage (components/home/ProjectEntryPoints.tsx).
const KEYS = ["business_websites", "store_development", "portals_web_apps", "automation", "ai_managed"];
const WIDTHS = [360, 390, 768, 1024, 1440];

for (const width of WIDTHS) {
  test(`homepage entry points fit and stay usable at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    for (const path of ["/bg", "/en"]) {
      await page.goto(path);
      const section = page.getByTestId("project-entry-points");
      await section.scrollIntoViewIfNeeded();
      await expect(section.getByRole("listitem")).toHaveCount(KEYS.length);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll, `${path} @${width}: horizontal overflow`).toBeLessThanOrEqual(sizes.client);
      for (const key of KEYS) {
        const box = await page.getByTestId(`entry-${key}`).boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= width, `${key} inside the screen`).toBe(true);
      }
    }
    await context.close();
  });
}

test("each entry point opens the quote form for its service and its service page", async ({ page }) => {
  await page.goto("/bg");
  const card = page.getByTestId("entry-store_development");
  await expect(card.getByRole("link", { name: "Поискайте оферта" })).toHaveAttribute("href", "/bg/kontakti?usluga=store_development&tip=oferta");
  await card.getByRole("link", { name: "Вижте обхвата" }).click();
  await expect(page).toHaveURL(/\/bg\/uslugi\//);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.goto("/en");
  await expect(page.getByTestId("entry-store_development").getByRole("link", { name: "Request a quote" })).toHaveAttribute(
    "href",
    "/en/contact?service=store_development&type=quote",
  );
});

test("entry point links are reachable by keyboard and show a focus ring", async ({ page }) => {
  await page.goto("/bg");
  const quote = page.getByTestId("entry-business_websites").getByRole("link", { name: "Поискайте оферта" });
  await page.keyboard.press("Tab"); // keyboard modality, so :focus-visible applies to the focus below
  await quote.focus();
  await expect(quote).toBeFocused();
  const outline = await quote.evaluate((el) => {
    const style = getComputedStyle(el);
    return `${style.outlineStyle} ${style.outlineWidth} ${style.boxShadow}`;
  });
  expect(outline).not.toBe("none 0px none");
});
