import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

// Quote basket (/bg/zayavka ↔ /en/quote-request): a server-side draft request for a written quote. Off by default:
// the first block runs on the default stack; the rest needs the commercial test stack (scripts/test-commercial-e2e.ps1).
const commercial = process.env.E2E_COMMERCIAL_STACK === "1";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const VERSION = "2026-11.1";
const API = "/api/public/quote-basket";

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
const next = (page: Page) => page.getByRole("button", { name: /^(Напред|Към прегледа)$/ }).click();

async function basketReady(page: Page, path = "/bg/zayavka") {
  await page.goto(path);
  await expect(page.getByTestId("quote-basket")).toHaveAttribute("data-ready", "true");
}

/** Walks the configurator to its review (business website with SEO) and adds it to the request. */
async function addBusinessWebsite(page: Page) {
  await page.goto("/bg/konfigurator");
  await expect(page.getByTestId("project-configurator")).toHaveAttribute("data-ready", "true");
  await page.getByRole("radio", { name: /Бизнес сайт/ }).check();
  await next(page);
  await page.getByRole("radio", { name: "До 5", exact: true }).check();
  await page.getByRole("radio", { name: "Един", exact: true }).check();
  await page.getByRole("radio", { name: "Нов проект", exact: true }).check();
  await next(page);
  await page.getByRole("checkbox", { name: "SEO", exact: true }).check();
  await next(page);
  await page.getByRole("radio", { name: /Да, имаме лого/ }).check();
  await page.getByRole("radio", { name: "Стандартна дизайн система" }).check();
  await next(page);
  await next(page);
  await page.getByRole("radio", { name: "Гъвкаво" }).check();
  await page.getByRole("radio", { name: "Предпочитам да обсъдим" }).check();
  await next(page);
  await expect(page.getByTestId("review-result")).toBeVisible();
  // With the basket on, the review ends in "add to the request", not in the contact form.
  await expect(page.getByTestId("configurator-quote-form")).toHaveCount(0);
  await page.getByTestId("configurator-basket").getByRole("button", { name: "Добавете към заявката" }).click();
  await expect(page).toHaveURL(/\/bg\/zayavka$/);
  await expect(page.getByTestId("basket-items").locator("[data-item]")).toHaveCount(1);
}

const storageKeys = (page: Page) => page.evaluate(() => ({ local: Object.keys(window.localStorage), session: Object.keys(window.sessionStorage) }));

test.describe("switched off (the default)", () => {
  test.skip(commercial, "the default stack only");

  test("the page and the API do not exist", async ({ page, request }) => {
    for (const path of ["/bg/zayavka", "/en/quote-request"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
    }
    expect((await request.post(API, { data: { locale: "bg" } })).status()).toBe(404);
    expect((await request.get(API, { headers: { "X-Basket-Token": "a".repeat(43) } })).status()).toBe(404);
    expect(await (await request.get("/sitemap.xml")).text()).not.toContain("zayavka");
  });
});

test.describe("switched on (commercial test stack)", () => {
  test.skip(!commercial || process.env.E2E_QUOTE_BASKET === "0", "needs the commercial test stack with the basket on (scripts/test-commercial-e2e.ps1)");

  test("add a configured project, add an extra, edit, remove and send: one request", async ({ page }) => {
    await addBusinessWebsite(page);
    const basket = page.getByTestId("quote-basket");
    await expect(page.getByText("Това не е поръчка и не е плащане", { exact: false })).toBeVisible();
    const item = page.getByTestId("basket-items").locator('[data-kind="configuration"]');
    const packagePrice = digits(await item.locator('[data-line="package:business_website"] [data-price="from"]').innerText());
    const seoPrice = digits(await item.locator('[data-line="service:seo"] [data-price="from"]').innerText());
    const totals = page.getByTestId("basket-totals");
    expect(digits(await totals.locator('[data-total="one-time"]').innerText())).toBe(packagePrice);
    expect(digits(await totals.locator('[data-total="monthly"]').innerText())).toBe(seoPrice);

    // The browser holds the basket token and nothing else; the configurator draft moved to the server.
    expect(await storageKeys(page)).toEqual({ local: ["acs.quote-basket"], session: [] });

    // The amounts are the published ones.
    const pricing = await page.context().newPage();
    await pricing.goto("/bg/tseni");
    expect(digits(await pricing.locator('[data-price-row="business_websites"] [data-price="from"]').innerText())).toBe(packagePrice);
    const carePrice = digits(await pricing.getByTestId("pricing-care-plans").locator('[data-price-row="website"] [data-price="from"]').innerText());
    await pricing.close();

    // An optional extra: recurring, so it changes the monthly sum only.
    await page.getByLabel("Услуга", { exact: true }).selectOption("care_plan:website");
    await page.getByTestId("basket-extras").getByRole("button", { name: "Добавете", exact: true }).click();
    await expect(page.getByTestId("basket-items").locator("[data-item]")).toHaveCount(2);
    expect(digits(await totals.locator('[data-total="monthly"]').innerText())).toBe(String(Number(seoPrice) + Number(carePrice)));
    expect(digits(await totals.locator('[data-total="one-time"]').innerText())).toBe(packagePrice);
    await expect(page.getByRole("option", { name: "Website Care" })).toBeDisabled(); // not twice

    // Edit the configuration: the configurator opens with its answers.
    await item.getByRole("link", { name: /^Променете/ }).click();
    await expect(page).toHaveURL(/\/bg\/konfigurator\?item=/);
    await expect(page.getByTestId("project-configurator")).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("radio", { name: /Бизнес сайт/ })).toBeChecked();
    await next(page);
    await next(page);
    await expect(page.getByRole("checkbox", { name: "SEO", exact: true })).toBeChecked();
    await page.getByRole("checkbox", { name: "Блог", exact: true }).check();
    for (let step = 0; step < 4; step += 1) await next(page);
    await page.getByTestId("configurator-basket").getByRole("button", { name: "Обновете позицията" }).click();
    await expect(page).toHaveURL(/\/bg\/zayavka$/);
    await expect(page.getByTestId("basket-items").locator("[data-item]")).toHaveCount(2); // replaced, not added
    await expect(page.getByTestId("basket-unpriced")).toContainText("Блог");
    await expect(page.getByTestId("basket-unpriced-count")).toContainText("1");
    await expect(page.getByTestId("basket-reasons")).toContainText("ориентировъчни");
    await expect(page.getByTestId("basket-exclusions")).toContainText("Хостинг");

    // Remove the extra.
    await page.getByRole("button", { name: /Премахнете „Website Care“/ }).click();
    await expect(page.getByTestId("basket-items").locator("[data-item]")).toHaveCount(1);
    expect(digits(await totals.locator('[data-total="monthly"]').innerText())).toBe(seoPrice);

    // Send.
    const form = page.getByTestId("basket-quote-form");
    await form.getByRole("button", { name: "Изпратете запитването" }).click();
    await expect(form.getByText("Потвърдете, че сте се запознали с Политиката за поверителност.")).toBeVisible();
    await form.getByLabel(/Име и фамилия/).fill("Тест Заявка");
    await form.getByLabel(/Фирма/).fill("Пример ООД");
    await form.getByLabel(/^Имейл/).fill("basket.e2e@example.com");
    await form.getByRole("checkbox", { name: /Запознах се с/ }).check();
    await form.getByRole("button", { name: "Изпратете запитването" }).click();
    await expect(page.getByTestId("basket-quote-form-sent")).toContainText(/Референтен номер: [0-9A-F]{8}/);
    await expect(page.getByTestId("basket-items")).toHaveCount(0);
    // The draft is finished: no token, no contact details anywhere in browser storage.
    expect(await storageKeys(page)).toEqual({ local: [], session: [] });
    await page.reload();
    await expect(basket).toHaveAttribute("data-ready", "true");
    await expect(page.getByTestId("basket-empty")).toBeVisible();
  });

  test("an extras-only request in English, discarded on request", async ({ page }) => {
    await basketReady(page, "/en/quote-request");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your request");
    const empty = page.getByTestId("basket-empty");
    await expect(empty.getByRole("link", { name: "Configure a project" })).toHaveAttribute("href", "/en/configurator");
    // Start a request through the API with the page's own storage key, then let the page show it.
    const created = await page.request.post(API, { data: { locale: "en", item: { kind: "extra", group: "workshop", key: "ai_strategy_discovery" } } });
    expect(created.status()).toBe(201);
    const token = (await created.json()).token as string;
    await page.evaluate((value) => window.localStorage.setItem("acs.quote-basket", value), token);
    await page.reload();
    await expect(page.getByTestId("basket-items").locator('[data-kind="extra"]')).toHaveCount(1);
    await expect(page.getByTestId("basket-items").locator('[data-price="from"]')).toHaveText(/^from €[\d,]+$/);
    await expect(page.getByTestId("basket-totals")).toContainText("One-time, from");
    await expect(page.getByText(/The draft is kept until/)).toBeVisible();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Delete the request" }).click();
    await expect(page.getByTestId("basket-empty")).toBeVisible();
    expect((await page.request.get(API, { headers: { "X-Basket-Token": token } })).status()).toBe(404);
    expect((await storageKeys(page)).local).toEqual([]);
  });

  test("a change in another tab is not overwritten: the page shows the current state and says so", async ({ page, context }) => {
    await addBusinessWebsite(page);
    const other = await context.newPage();
    await basketReady(other);
    await expect(other.getByTestId("basket-items").locator("[data-item]")).toHaveCount(1);
    // The second tab adds an extra; the first one still holds the old version.
    await other.getByLabel("Услуга", { exact: true }).selectOption("service:audit");
    await other.getByTestId("basket-extras").getByRole("button", { name: "Добавете", exact: true }).click();
    await expect(other.getByTestId("basket-items").locator("[data-item]")).toHaveCount(2);
    await page.getByRole("button", { name: /^Премахнете „Бизнес сайт“/ }).click();
    await expect(page.getByText("Заявката е променена в друг раздел.", { exact: false })).toBeVisible();
    await expect(page.getByTestId("basket-items").locator("[data-item]")).toHaveCount(2); // nothing was removed blindly
    await other.close();
  });

  test("axe and keyboard: empty and filled request", async ({ page }, testInfo) => {
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      await testInfo.attach(`axe-basket-${label}.json`, { body: JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))), contentType: "application/json" });
      expect(results.violations.map((v) => v.id), label).toEqual([]);
    };
    await basketReady(page);
    await check("empty");
    await addBusinessWebsite(page);
    await check("filled");
    // The remove button is reachable and operable with the keyboard, and says what it removes.
    const remove = page.getByRole("button", { name: /^Премахнете „Бизнес сайт“/ });
    await remove.focus();
    await expect(remove).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("basket-empty")).toBeVisible();
  });

  for (const width of [360, 390, 768, 1024, 1440]) {
    test(`fits at ${width}px`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await addBusinessWebsite(page);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll, `basket @${width}`).toBeLessThanOrEqual(sizes.client);
      for (const id of ["basket-items", "basket-extras", "basket-totals", "basket-quote-form"]) {
        const box = await page.getByTestId(id).boundingBox();
        expect(box && box.x >= 0 && box.x + box.width <= width, `${id} @${width}`).toBe(true);
      }
      await context.close();
    });
  }

  test("the API: ownership by token, no amounts, invalid identifiers, one lead per request", async ({ request }) => {
    const created = await request.post(API, { data: { locale: "en", item: { kind: "configuration", model_version: VERSION, answers: ANSWERS } } });
    expect(created.status()).toBe(201);
    const { token, basket } = await created.json();
    const headers = { "X-Basket-Token": token as string };
    expect(basket.binding).toBe(false);
    expect(basket.human_review.required).toBe(true);
    expect(JSON.stringify(basket)).not.toContain(token);

    expect((await request.get(API)).status()).toBe(422);
    expect((await request.get(API, { headers: { "X-Basket-Token": "z".repeat(43) } })).status()).toBe(404);
    const add = (item: unknown, extra: Record<string, unknown> = {}) => request.post(`${API}/items`, { headers, data: { expected_version: basket.version, item, ...extra } });
    expect((await add({ kind: "extra", group: "service", key: "seo", price: 1 })).status()).toBe(422);
    expect((await add({ kind: "extra", group: "service", key: "seo" }, { total: 1 })).status()).toBe(422);
    expect((await add({ kind: "extra", group: "service", key: "does_not_exist" })).status()).toBe(422);
    expect((await add({ kind: "extra", group: "gift_card", key: "seo" })).status()).toBe(422);
    expect((await request.delete(`${API}/items/not-a-uuid?expected_version=${basket.version}`, { headers })).status()).toBe(422);
    const stale = await request.post(`${API}/items`, { headers, data: { expected_version: 1, item: { kind: "extra", group: "service", key: "seo" } } });
    expect(stale.status()).toBe(409);
    expect((await (await request.get(API, { headers })).json()).version).toBe(basket.version); // nothing above changed it

    const formToken = async () => (await (await request.get("/api/public/form-token")).json()).token as string;
    const contact = { expected_version: basket.version, locale: "en", name: "E2E Basket", email: "basket.api.e2e@example.com", company: "Example Ltd", privacy_acknowledged: true };
    const first = await request.post(`${API}/submit`, { headers, data: { ...contact, form_token: await formToken() } });
    const again = await request.post(`${API}/submit`, { headers, data: { ...contact, form_token: await formToken() } });
    expect([first.status(), again.status()]).toEqual([201, 200]);
    expect((await again.json()).reference).toBe((await first.json()).reference);
    const after = await (await request.get(API, { headers })).json();
    expect(after.status).toBe("submitted");
  });
});
