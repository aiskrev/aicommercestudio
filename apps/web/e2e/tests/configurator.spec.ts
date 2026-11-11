import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Project configurator (/bg/konfigurator ↔ /en/configurator). Off by default: the first block runs on the default
// stack and proves nothing is reachable; the rest needs the commercial test stack (scripts/test-commercial-e2e.ps1).
const commercial = process.env.E2E_COMMERCIAL_STACK === "1";
// The commercial stack runs twice: with the quote basket on (the review ends in "add to the request") and with it
// off (the review ends in the configurator's own quote form). E2E_QUOTE_BASKET=0 marks the second pass.
const basketOn = process.env.E2E_QUOTE_BASKET !== "0";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const VERSION = "2026-11.1";

const ANSWERS = {
  project_type: "business_website",
  pages: "up_to_5",
  products: "none",
  languages: "one",
  build: "new",
  content_migration: false,
  store_migration: false,
  features: ["seo"],
  branding: "existing",
  design_level: "standard",
  accessibility: false,
  interactive_elements: false,
  operations: [],
  timeline: "flexible",
  budget_range: "undisclosed",
};

const digits = (text: string) => text.replace(/\D/g, "");

async function ready(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId("project-configurator")).toHaveAttribute("data-ready", "true");
}

const next = (page: Page) => page.getByRole("button", { name: /^(Напред|Към прегледа|Next|Go to the review)$/ }).click();

async function businessWebsite(page: Page) {
  await page.getByRole("radio", { name: /Бизнес сайт/ }).check();
  await next(page);
  await page.getByRole("radio", { name: "До 5", exact: true }).check();
  await page.getByRole("radio", { name: "Един", exact: true }).check();
  await page.getByRole("radio", { name: "Нов проект", exact: true }).check();
  await next(page);
  await page.getByRole("checkbox", { name: "SEO", exact: true }).check();
  await page.getByRole("checkbox", { name: "Блог", exact: true }).check();
  await next(page);
  await page.getByRole("radio", { name: /Да, имаме лого/ }).check();
  await page.getByRole("radio", { name: "Стандартна дизайн система" }).check();
  await next(page);
  await page.getByRole("checkbox", { name: "Поддръжка", exact: true }).check();
  await next(page);
  await page.getByRole("radio", { name: "Гъвкаво" }).check();
  await page.getByRole("radio", { name: "Предпочитам да обсъдим" }).check();
  await next(page);
  await expect(page.getByTestId("review-result")).toBeVisible();
}

test.describe("switched off (the default)", () => {
  test.skip(commercial, "the default stack only");

  test("the page, the API and the entry points do not exist", async ({ page, request }) => {
    for (const path of ["/bg/konfigurator", "/en/configurator"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
    expect((await request.get("/api/public/configurator/meta")).status()).toBe(404);
    const review = await request.post("/api/public/configurator/review", { data: { model_version: VERSION, answers: ANSWERS } });
    expect(review.status()).toBe(404);
    expect(await (await request.get("/api/configurator-flag")).json()).toEqual({ enabled: false });
    await page.goto("/bg");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("configurator-entry")).toHaveCount(0);
    await page.goto("/bg/proektni-paketi");
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("configurator-entry")).toHaveCount(0);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("konfigurator");
  });
});

test.describe("switched on (commercial test stack)", () => {
  test.skip(!commercial, "needs the commercial test stack (scripts/test-commercial-e2e.ps1)");

  test("a business website: steps, review from the published schedule, quote request", async ({ page }) => {
    await ready(page, "/bg/konfigurator");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Конфигурирайте проект");
    // A step does not move on without its required answer, and the error is announced.
    await next(page);
    await expect(page.getByTestId("step-type").getByRole("alert").first()).toBeVisible();
    await businessWebsite(page);

    const result = page.getByTestId("review-result");
    await expect(result).toHaveAttribute("data-package", "business_website");
    await expect(page.getByText("Това е ориентир, а не оферта.", { exact: false })).toBeVisible();
    const items = result.getByTestId("review-items");
    await expect(items.locator("[data-item]")).toHaveCount(3); // package, SEO service, Website Care
    const packagePrice = digits(await items.locator('[data-item="package:business_website"] [data-price="from"]').innerText());
    await expect(result.getByTestId("review-unpriced")).toContainText("Блог");
    await expect(result.getByTestId("review-reasons")).toContainText("ориентировъчни");
    await expect(result.getByTestId("review-exclusions")).toContainText("Хостинг");
    expect(digits(await result.locator('[data-total="one-time"]').innerText())).toBe(packagePrice);

    // The amount is the one the pricing page publishes.
    const pricing = await page.context().newPage();
    await pricing.goto("/bg/tseni");
    expect(digits(await pricing.locator('[data-price-row="business_websites"] [data-price="from"]').innerText())).toBe(packagePrice);
    await pricing.close();

    if (basketOn) {
      // The quote basket takes over from here (quote-basket.spec.ts follows the request to the end).
      await expect(page.getByTestId("configurator-quote-form")).toHaveCount(0);
      await expect(page.getByTestId("configurator-basket").getByRole("button", { name: "Добавете към заявката" })).toBeVisible();
      return;
    }
    const form = page.getByTestId("configurator-quote-form");
    await form.getByRole("button", { name: "Изпратете запитването" }).click();
    await expect(form.getByText("Потвърдете, че сте се запознали с Политиката за поверителност.")).toBeVisible();
    await form.getByLabel(/Име и фамилия/).fill("Тест Конфигуратор");
    await form.getByLabel(/Фирма/).fill("Пример ООД");
    await form.getByLabel(/^Имейл/).fill("configurator.e2e@example.com");
    await form.getByLabel(/Какво искате да постигнете/).fill("Повече добре описани запитвания.");
    await form.getByRole("checkbox", { name: /Запознах се с/ }).check();
    await form.getByRole("button", { name: "Изпратете запитването" }).click();
    await expect(page.getByTestId("configurator-quote").getByRole("status")).toContainText(/Референтен номер: [0-9A-Z-]+/);
  });

  test("a small store leads to the starter store and shows 'requires assessment', never an invented price (EN)", async ({ page }) => {
    await ready(page, "/en/configurator");
    await page.getByRole("radio", { name: /Online store/ }).check();
    await next(page);
    await page.getByTestId("q-pages").getByRole("radio", { name: "Up to 5", exact: true }).check();
    await page.getByTestId("q-products").getByRole("radio", { name: "Up to 50", exact: true }).check();
    await page.getByTestId("q-languages").getByRole("radio", { name: "One", exact: true }).check();
    await page.getByRole("radio", { name: "New project", exact: true }).check();
    await next(page);
    await page.getByRole("checkbox", { name: "Online payments" }).check();
    await next(page);
    await page.getByRole("radio", { name: /Yes, we have a logo/ }).check();
    await page.getByRole("radio", { name: "Standard design system" }).check();
    await next(page);
    await next(page);
    await page.getByRole("radio", { name: "Flexible" }).check();
    await page.getByRole("radio", { name: "I'd rather discuss it" }).check();
    await next(page);
    const result = page.getByTestId("review-result");
    await expect(result).toHaveAttribute("data-package", "store_setup");
    const line = result.locator('[data-item="package:store_setup"]');
    await expect(line.locator('[data-price="assessment"]')).toHaveText("Requires assessment");
    await expect(line).not.toContainText("€");
    await expect(result.getByTestId("review-included")).toContainText("Online payments");
    await expect(result.getByTestId("review-totals")).toContainText("no published price");
  });

  test("the browser's back and forward buttons move between steps, and a reload keeps the answers", async ({ page }) => {
    await ready(page, "/bg/konfigurator");
    await page.getByRole("radio", { name: /Онлайн магазин/ }).check();
    await next(page);
    await expect(page).toHaveURL(/#scope$/);
    await page.goBack();
    await expect(page.getByTestId("configurator-step-title")).toHaveText("Вид проект");
    await expect(page.getByRole("radio", { name: /Онлайн магазин/ })).toBeChecked();
    await page.goForward();
    await expect(page.getByTestId("configurator-step-title")).toHaveText("Обхват");
    await page.reload();
    await expect(page.getByTestId("project-configurator")).toHaveAttribute("data-ready", "true");
    await expect(page.getByTestId("configurator-step-title")).toHaveText("Обхват");
    await expect(page.getByTestId("q-products")).toBeVisible();
  });

  test("the whole first step works with the keyboard and the new step takes focus", async ({ page }) => {
    await ready(page, "/bg/konfigurator");
    const first = page.getByRole("radio", { name: /Лендинг страница/ });
    await first.focus();
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: /Бизнес сайт/ })).toBeChecked();
    await page.keyboard.press("Enter"); // submits the step
    await expect(page.getByTestId("configurator-step-title")).toHaveText("Обхват");
    await expect(page.getByTestId("configurator-step-title")).toBeFocused();
  });

  test("axe: every step and the review (BG)", async ({ page }, testInfo) => {
    await ready(page, "/bg/konfigurator");
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      await testInfo.attach(`axe-configurator-${label}.json`, { body: JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))), contentType: "application/json" });
      expect(results.violations.map((v) => v.id), label).toEqual([]);
    };
    await check("type");
    await next(page); // error state
    await check("type-errors");
    await businessWebsite(page);
    await check("review");
  });

  for (const width of [360, 390, 768, 1024, 1440]) {
    test(`fits at ${width}px: first step and review`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await ready(page, "/bg/konfigurator");
      const fits = async (label: string) => {
        const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
        expect(sizes.scroll, `${label} @${width}`).toBeLessThanOrEqual(sizes.client);
      };
      await fits("type");
      await businessWebsite(page);
      await fits("review");
      const box = await page.getByTestId(basketOn ? "configurator-basket" : "configurator-quote-form").boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
      await context.close();
    });
  }

  test("the entry points appear on the homepage and the packages page", async ({ page }) => {
    await page.goto("/bg");
    await expect(page.getByTestId("configurator-entry")).toHaveAttribute("href", "/bg/konfigurator");
    await page.goto("/en/project-packages");
    await page.getByTestId("configurator-entry").click();
    await expect(page).toHaveURL(/\/en\/configurator$/);
    await expect(page.locator('link[rel="alternate"][hreflang="bg"]')).toHaveAttribute("href", /\/bg\/konfigurator$/);
    // The sitemap is regenerated every 300 s, so a freshly started stack may still serve the build-time copy;
    // lib/routing-and-seo.test.ts checks that it lists the configurator while the flag is on.
  });

  test("the API refuses amounts, unknown values and unsupported combinations, and creates one lead per submission", async ({ request }) => {
    const review = (data: unknown) => request.post("/api/public/configurator/review", { data });
    const ok = await review({ model_version: VERSION, answers: ANSWERS });
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.binding).toBe(false);
    expect(body.human_review.required).toBe(true);
    // Price tampering: an amount anywhere in the request is refused, and the answer never depends on it.
    expect((await review({ model_version: VERSION, answers: { ...ANSWERS, price: 1 } })).status()).toBe(422);
    expect((await review({ model_version: VERSION, answers: ANSWERS, totals: { one_time_from: 1 } })).status()).toBe(422);
    expect((await review({ model_version: VERSION, answers: { ...ANSWERS, project_type: "spaceship" } })).status()).toBe(422);
    expect((await review({ model_version: "2020-01.1", answers: ANSWERS })).status()).toBe(422);
    const unsupported = await review({ model_version: VERSION, answers: { ...ANSWERS, features: ["shipping"] } });
    expect(unsupported.status()).toBe(422);
    expect((await unsupported.json()).code).toBe("unsupported_combination");

    const token = async () => (await (await request.get("/api/public/form-token")).json()).token as string;
    const submission = {
      model_version: VERSION,
      answers: ANSWERS,
      submission_id: crypto.randomUUID(),
      locale: "en",
      name: "E2E Configurator",
      email: "configurator.api.e2e@example.com",
      company: "Example Ltd",
      privacy_acknowledged: true,
    };
    const first = await request.post("/api/public/configurator/submissions", { data: { ...submission, form_token: await token() } });
    const again = await request.post("/api/public/configurator/submissions", { data: { ...submission, form_token: await token() } });
    expect([first.status(), again.status()]).toEqual([201, 200]);
    expect((await again.json()).reference).toBe((await first.json()).reference);
  });
});
