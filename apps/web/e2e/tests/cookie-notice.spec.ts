import { expect, test } from "@playwright/test";

/**
 * Cookie notice and the published cookie information (BG/EN). This spec starts without the
 * `acs_cookie_notice` cookie that playwright.config.ts sets for every other spec.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("the notice appears on the first visit, links to the cookie information and stays closed", async ({ page }) => {
  await page.goto("/bg");
  const notice = page.getByRole("region", { name: "Известие за бисквитките" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("Не използваме аналитични, рекламни или проследяващи бисквитки.");
  await expect(notice.getByRole("link", { name: "Научете повече" })).toHaveAttribute("href", "/bg/biskvitki");
  await notice.getByRole("button", { name: "Разбрах" }).click();
  await expect(notice).toHaveCount(0);
  const cookie = (await page.context().cookies()).find((c) => c.name === "acs_cookie_notice");
  expect(cookie?.value).toBe("1");
  await page.goto("/en");
  await expect(page.getByTestId("cookie-notice")).toHaveCount(0);
});

test("the English notice and the keyboard path", async ({ page }) => {
  await page.goto("/en/services");
  const notice = page.getByRole("region", { name: "Cookie notice" });
  await expect(notice).toBeVisible();
  await notice.getByRole("button", { name: "Got it" }).focus();
  await page.keyboard.press("Enter");
  await expect(notice).toHaveCount(0);
});

test("the notice is not part of the server HTML, so pages stay static and nothing flashes", async ({ request }) => {
  const html = await (await request.get("/bg")).text();
  expect(html).not.toContain('data-testid="cookie-notice"');
});

test("the cookie information is published: no draft notice, indexable, in the sitemap, every cookie listed", async ({ page, request }) => {
  for (const [path, title] of [
    ["/bg/biskvitki", "Информация за бисквитките"],
    ["/en/cookies", "Cookie information"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByTestId("legal-draft-notice")).toHaveCount(0);
    expect((await page.locator("meta[name='robots']").getAttribute("content")) ?? "").not.toContain("noindex");
    for (const name of ["acs_locale", "acs_cookie_notice", "acs_session", "acs_csrf"]) await expect(page.locator("main")).toContainText(name);
    await expect(page.locator("main")).not.toContainText("[");
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/bg/biskvitki");
  expect(sitemap).toContain("/en/cookies");
  // The privacy policy and the terms are still drafts.
  await page.goto("/bg/poveritelnost");
  await expect(page.getByTestId("legal-draft-notice")).toBeVisible();
});

test("the footer and the About page no longer announce unpublished company details", async ({ page }) => {
  for (const path of ["/bg", "/en", "/bg/za-nas", "/en/about"]) {
    await page.goto(path);
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/предстои да бъдат публикувани|подготвителен етап|will be published|preparatory stage/);
  }
});
