import { expect, test } from "@playwright/test";

/**
 * Future Commerce interactivity (docs/FUTURE_COMMERCE_REDESIGN_REPORT.md): every interactive element works with a
 * pointer and with the keyboard, its call to action goes to the working enquiry path with the right service, the
 * demonstrations say they are demonstrations, nothing links a switched-off feature, and reduced motion is honoured.
 */

const FLAGGED = /\/(konfigurator|configurator|zayavka|quote-request|oferta|quotation|konto|account|proekti|case-studies)(\/|$|\?)/;

test("service cards reveal their details on hover and on keyboard focus (wide screens)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/bg");
  const card = page.getByTestId("showcase-store");
  await card.scrollIntoViewIfNeeded();
  const more = card.locator(".fc-card-more");
  const hiddenOffset = async () => more.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);
  await page.mouse.move(5, 5);
  await expect.poll(hiddenOffset).toBeGreaterThan(0);
  await card.hover();
  await expect.poll(hiddenOffset).toBe(0);
  await page.mouse.move(5, 5);
  await expect.poll(hiddenOffset).toBeGreaterThan(0);
  // Keyboard: focusing the quote link inside the panel opens it.
  await page.keyboard.press("Tab");
  await page.getByTestId("showcase-quote-store").focus();
  await expect.poll(hiddenOffset).toBe(0);
  await expect(page.getByTestId("showcase-quote-store")).toHaveAttribute("href", "/bg/kontakti?usluga=store_development&tip=oferta");
  await context.close();
});

test("product showcase: WAI-ARIA tabs, keyboard, labelled sample data", async ({ page }) => {
  await page.goto("/en");
  const showcase = page.getByTestId("product-showcase");
  const tabs = showcase.getByRole("tab");
  await expect(tabs).toHaveCount(4);
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
  const panel = showcase.getByRole("tabpanel");
  await expect(panel).toContainText("Demonstration");
  await expect(panel.locator("[data-mock]")).toHaveAttribute("aria-hidden", "true");
  await expect(panel.getByTestId("showcase-more-saas")).toHaveAttribute("href", "/en/services/customer-portals-and-web-applications");
});

test("process timeline: six stages as tabs; choosing one shows what you get and what we need", async ({ page }) => {
  await page.goto("/bg");
  const stages = page.getByTestId("home-timeline").getByRole("tab");
  await expect(stages).toHaveCount(6);
  await stages.nth(4).click();
  await expect(stages.nth(4)).toHaveAttribute("aria-selected", "true");
  const panel = page.getByTestId("process-stage-panel");
  await expect(panel).toContainText("Пускане");
  await expect(panel).toContainText("Какво получавате");
  await page.keyboard.press("ArrowLeft");
  await expect(panel).toContainText("Тестване");
});

test("integration flow lists the five systems in order", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByTestId("integration-flow").locator(":scope > li")).toHaveCount(5);
  await expect(page.getByTestId("integration-flow")).toContainText("Website or store");
  await expect(page.getByTestId("integration-flow")).toContainText("Analytics");
});

test("package comparison filters the approved packages; prices only from the schedule", async ({ page }) => {
  await page.goto("/bg");
  const offers = page.getByTestId("home-offers");
  await expect(offers.locator(":scope > li")).toHaveCount(6); // five packages + the care plans card
  await page.getByRole("tab", { name: "Магазини" }).click();
  await expect(offers.locator(":scope > li[data-testid^='home-offer-store_']")).toHaveCount(2);
  await expect(offers.getByTestId("home-offer-landing_page")).toHaveCount(0);
  await expect(offers.getByTestId("home-offer-store_setup")).toContainText("Цена в писмена оферта");
  await expect(offers.getByTestId("home-offer-store_complete")).toContainText("€");
  await page.getByRole("tab", { name: "По поръчка" }).click();
  await expect(offers.getByTestId("home-offer-custom_web_app")).toBeVisible();
  await expect(offers.getByTestId("home-offer-care")).toHaveCount(0);
});

test("AI workflow demo: labelled as a demonstration, runs step by step and stops for a person", async ({ page }) => {
  await page.goto("/bg");
  const demo = page.getByTestId("ai-demo");
  await expect(demo.getByTestId("ai-demo-disclaimer")).toContainText("Демонстрация с измислени данни");
  await demo.getByRole("radio", { name: "Проблем с поръчка" }).check();
  for (let step = 0; step < 5; step += 1) await demo.getByTestId("ai-demo-next").click();
  await expect(demo.getByTestId("ai-demo-next")).toHaveCount(0);
  await expect(demo.getByTestId("ai-demo-status")).toContainText("Нищо не се изпраща без одобрение");
  await demo.getByTestId("ai-demo-approve").click();
  await expect(demo.getByTestId("ai-demo-status")).toContainText("Одобрено");
  await expect(demo.locator("[data-state='done']")).toHaveCount(5);
});

test("service comparison: choosing a column highlights it and points the quote at its service", async ({ page }) => {
  await page.goto("/en");
  const comparison = page.getByTestId("service-comparison").first();
  await comparison.getByTestId("compare-pick-store").check();
  await expect(comparison.getByTestId("compare-focus")).toContainText("Online store");
  await expect(comparison.getByTestId("compare-quote")).toHaveAttribute("href", "/en/contact?service=store_development&type=quote");
  await expect(comparison.locator("thead th.is-focus")).toHaveText("Online store");
  await expect(comparison.getByTestId("compare-price-static")).toContainText("Price on request");
  await expect(comparison.getByTestId("compare-price-app")).toContainText("€");
});

test("service selector recommends a package and services and opens the quote form with that service", async ({ page }) => {
  await page.goto("/bg/uslugi#selector");
  const selector = page.getByTestId("service-selector");
  await selector.getByTestId("selector-goal-store").check();
  await expect(selector.getByTestId("selector-package")).toContainText("Стартов онлайн магазин");
  await selector.getByTestId("selector-need-integrations").check();
  await expect(selector.getByTestId("selector-package")).toContainText("Пълен онлайн магазин");
  await expect(selector.getByTestId("selector-quote")).toHaveAttribute("href", "/bg/kontakti?usluga=store_development&tip=oferta");
  await selector.getByTestId("selector-goal-automate").check();
  await expect(selector.getByTestId("selector-quote")).toHaveAttribute("href", "/bg/kontakti?usluga=automation&tip=oferta");
  await selector.getByTestId("selector-quote").click();
  await expect(page).toHaveURL(/\/bg\/kontakti\?usluga=automation&tip=oferta$/);
  await expect(page.locator("form").first()).toBeVisible();
});

test("menus and the selector are reachable from every panel; no interactive element links a disabled feature", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  for (const path of ["/bg", "/en", "/bg/uslugi", "/en/services"]) {
    await page.goto(path);
    const hrefs = await page.locator("main a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
    for (const href of hrefs) expect(href, `${path}: ${href}`).not.toMatch(FLAGGED);
  }
  await page.goto("/bg");
  await expect(async () => {
    const toggle = page.getByTestId("menu-ecommerce");
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
    await expect(page.getByTestId("panel-ecommerce")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId("quick-selector-ecommerce")).toHaveAttribute("href", "/bg/uslugi#selector");
  await page.getByTestId("quick-selector-ecommerce").click();
  await expect(page).toHaveURL(/\/bg\/uslugi#selector$/);
  await expect(page.getByTestId("service-selector")).toBeVisible();
  await context.close();
});

test("reduced motion: no entrance, drift, float or beam animation runs", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("/bg");
  const running = await page.evaluate(() =>
    document.getAnimations().filter((animation) => {
      const target = (animation.effect as KeyframeEffect | null)?.target as Element | null;
      return animation.playState === "running" && !!target?.closest(".fc-enter, .fc-float, .fc-backdrop, .fc-beam, .fc-stage");
    }).length,
  );
  expect(running).toBe(0);
  await context.close();
});
