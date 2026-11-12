import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * Responsive capture of the pages and flows changed by the legal remediation at 375, 390, 768, 1024 and 1440 px, in
 * Bulgarian and English: no horizontal overflow, the main controls inside the viewport, and a screenshot of each view
 * attached to the report (test-results). A screenshot is not a manual review: docs/ACCESSIBILITY.md records which views
 * a person looked at. Real devices were not used.
 */
const WIDTHS = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

async function noOverflow(page: Page, label: string) {
  const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(sizes.scroll, `${label}: horizontal overflow (${sizes.scroll} > ${sizes.client})`).toBeLessThanOrEqual(sizes.client);
}

/** The page content only (the header is checked separately: see the known defect below). */
async function contentFits(page: Page, label: string) {
  const over = await page.locator("main").evaluate((main) => {
    const limit = document.documentElement.clientWidth;
    const scrolls = (el: Element) => {
      for (let node: Element | null = el.parentElement; node && node !== main; node = node.parentElement) {
        const overflow = getComputedStyle(node).overflowX;
        if ((overflow === "auto" || overflow === "scroll" || overflow === "hidden") && node.getBoundingClientRect().right <= limit + 1) return true;
      }
      return false;
    };
    return [...main.querySelectorAll("*")].filter((el) => el.getBoundingClientRect().right > limit + 1 && el.getBoundingClientRect().width > 0 && !scrolls(el)).slice(0, 3).map((el) => el.tagName + "." + String(el.className).slice(0, 40));
  });
  expect(over, `${label}: content wider than the screen`).toEqual([]);
}

const PUBLIC_PATHS = [
  "/bg/poveritelnost",
  "/en/privacy",
  "/bg/biskvitki",
  "/en/cookies",
  "/bg/obshti-usloviya",
  "/bg/usloviya-za-abonament",
  "/en/subscription-terms",
  "/bg/otkaz-i-vazstanovyavane",
  "/en/withdrawal-and-refunds",
  "/bg/kontakti",
  "/en/contact",
  "/bg/otkaz-ot-marketing",
];


for (const size of WIDTHS) {
  test.describe(`${size.width}px`, () => {
    test.use({ viewport: size });
    // The public pages are checked on every stack, including the one with accounts on (the account header is fixed: BLOCKER-ACC-HEADER-01).

    for (const path of PUBLIC_PATHS) {
      test(`${path} fits and is readable`, async ({ page }, testInfo) => {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await noOverflow(page, `${path} @${size.width}`);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const body = await page.locator("main").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
        expect(body).toBeGreaterThanOrEqual(14);
        await testInfo.attach(`${path.replace(/\//g, "_")}-${size.width}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      });
    }

    test("the footer lists the legal links and fits", async ({ page }, testInfo) => {
      await page.goto("/bg");
      await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
      await noOverflow(page, `footer @${size.width}`);
      await expect(page.getByRole("contentinfo").getByRole("link", { name: "Отказ и връщане на суми" })).toBeVisible();
      await testInfo.attach(`footer-${size.width}.png`, { body: await page.getByRole("contentinfo").screenshot(), contentType: "image/png" });
    });

    test("the contact form's consent controls fit and the long Bulgarian label wraps", async ({ page }, testInfo) => {
      await page.goto("/bg/kontakti");
      await page.waitForLoadState("networkidle");
      const marketing = page.getByRole("checkbox", { name: /Желая да получавам новини/ });
      await expect(marketing).toBeVisible();
      await marketing.scrollIntoViewIfNeeded();
      await noOverflow(page, `contact consent @${size.width}`);
      const box = await marketing.locator("xpath=ancestor::label[1]").boundingBox();
      expect(box && box.x + box.width <= size.width + 1).toBe(true);
      await testInfo.attach(`contact-consent-${size.width}.png`, { body: await page.screenshot(), contentType: "image/png" });
    });
  });
}

// Account flows: the legal e2e stack only.
const legalStack = process.env.E2E_LEGAL_STACK === "1" && Boolean(process.env.E2E_ACCOUNT_PASSWORD);

async function signIn(browser: Browser, name: string, path: string, size: { width: number; height: number }): Promise<Page> {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  await page.goto("/bg/konto/vhod");
  await page.getByLabel("Имейл", { exact: true }).fill(`${name}.legal-e2e@example.com`);
  await page.getByLabel("Парола").fill(process.env.E2E_ACCOUNT_PASSWORD ?? "");
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/bg\/konto$/);
  await page.goto(path);
  return page;
}

for (const size of WIDTHS) {
  test.describe(`account flows @${size.width}px`, () => {
    test.skip(!legalStack, "needs the legal e2e stack (scripts/test-legal-e2e.ps1)");

    test("order review (BG and EN labels), withdrawal steps and data rights fit", async ({ browser }, testInfo) => {
      const shopper = await signIn(browser, "shopper", "/bg/konto/abonamenti", size);
      await shopper.getByRole("button", { name: "Преглед на поръчката" }).click();
      const review = shopper.getByTestId("order-review");
      await review.getByRole("radio", { name: /Потребител/ }).check();
      await review.getByRole("button", { name: "Поръчвам с оторизиране на плащането" }).click(); // shows the errors
      await contentFits(shopper, `order review @${size.width}`);
      const orderButton = review.getByRole("button", { name: "Поръчвам с оторизиране на плащането" });
      await orderButton.scrollIntoViewIfNeeded();
      const box = await orderButton.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= size.width).toBe(true);
      await testInfo.attach(`order-review-${size.width}.png`, { body: await shopper.screenshot({ fullPage: true }), contentType: "image/png" });
      await shopper.context().close();

      const customer = await signIn(browser, "layout", "/bg/konto/abonamenti", size);
      await customer.getByRole("button", { name: "Откажете се от договора тук" }).click();
      await contentFits(customer, `withdrawal step 1 @${size.width}`);
      await testInfo.attach(`withdrawal-1-${size.width}.png`, { body: await customer.screenshot({ fullPage: true }), contentType: "image/png" });
      await customer.getByLabel("Вашето изявление").fill("Недвусмислено заявявам, че се отказвам от договора.");
      await customer.getByRole("button", { name: "Продължете към потвърждение" }).click();
      await contentFits(customer, `withdrawal step 2 @${size.width}`);
      await testInfo.attach(`withdrawal-2-${size.width}.png`, { body: await customer.screenshot({ fullPage: true }), contentType: "image/png" });
      await customer.context().close();

      const rights = await signIn(browser, "rights2", "/bg/konto", size);
      await contentFits(rights, `data rights @${size.width}`);
      await testInfo.attach(`data-rights-${size.width}.png`, { body: await rights.screenshot({ fullPage: true }), contentType: "image/png" });
      await rights.context().close();

      const english = await signIn(browser, "shopper", "/en/account/subscriptions", size);
      await english.getByRole("button", { name: "Review order" }).click();
      await contentFits(english, `order review EN @${size.width}`);
      await testInfo.attach(`order-review-en-${size.width}.png`, { body: await english.screenshot({ fullPage: true }), contentType: "image/png" });
      await english.context().close();
    });

    test("the staff queues fit", async ({ browser }, testInfo) => {
      const context = await browser.newContext({ viewport: size });
      const page = await context.newPage();
      await page.goto("/admin/login");
      await page.getByLabel("Имейл").fill(process.env.ADMIN_BOOTSTRAP_EMAIL ?? "");
      await page.getByLabel("Парола").fill(process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "");
      await page.getByRole("button", { name: "Вход" }).click();
      await page.waitForURL(/\/admin$/);
      await page.goto("/admin/compliance");
      await expect(page.getByRole("tab", { name: "Откази от договор" })).toBeVisible();
      await contentFits(page, `staff queues @${size.width}`);
      await testInfo.attach(`staff-queues-${size.width}.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
      await context.close();
    });
  });
}

// Regression guard for release blocker BLOCKER-ACC-HEADER-01 (apps/api/app/release_gates.py, closed 2026-11-11). With
// customer accounts on, the header of the Bulgarian site used to be wider than the screen at 1024 px (about 14 px) and
// at 1440 px (about 150 px), because sign-in and sign-up were added to a bar that was already full. The desktop bar now
// shows one compact sign-in control (components/layout/AccountEntry.tsx). If this test fails, the blocker is open again:
// set ACCOUNT_HEADER_LAYOUT_FIXED back to False until the header fits.
for (const width of [1024, 1440]) {
  test(`BLOCKER-ACC-HEADER-01: the Bulgarian header fits at ${width}px with accounts on`, async ({ browser }) => {
    test.skip(!legalStack, "only meaningful with accounts switched on (the legal e2e stack)");
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.goto("/bg");
    await page.waitForLoadState("networkidle");
    await noOverflow(page, `header @${width}`);
    await context.close();
  });
}
