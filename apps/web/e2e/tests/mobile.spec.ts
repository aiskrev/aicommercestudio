import { expect, test } from "@playwright/test";

const PAGES = [
  "/bg",
  "/bg/uslugi",
  "/bg/uslugi/seo-optimizatsiya",
  "/bg/uslugi/ai-managed-services",
  "/bg/ai-resheniya",
  "/bg/ai-automation-advisor",
  "/bg/za-kogo",
  "/bg/proces",
  "/bg/kontakti",
  "/bg/statii",
  "/bg/instrumenti",
  "/bg/instrumenti/ai-gotovnost",
  "/bg/instrumenti/ai-ekip",
  "/bg/instrumenti/roi-kalkulator",
  "/en/tools/automation-finder",
  "/bg/instrumenti/ai-reshenie",
  "/en/ai-agents",
  "/bg/ai-agenti/obrabotka-na-dokumenti",
  "/bg/uslugi/razrabotka-na-ai-agenti",
  "/en",
  "/en/services",
  "/en/services/ai-managed-services",
  "/en/ai-solutions",
  "/en/ai-automation-advisor",
  "/en/industries",
  "/en/contact",
  "/en/insights",
  "/en/tools",
  "/en/tools/ai-readiness",
  "/en/services/ai-agent-development",
  "/admin/login",
];

test("pages fit the mobile viewport without horizontal scrolling", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

test("mobile menu opens, navigates and closes", async ({ page }) => {
  await page.goto("/bg");
  const toggle = page.getByRole("button", { name: "Отвори менюто" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  const close = page.getByRole("button", { name: "Затвори менюто" });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  // The link must be visible inside the opened panel (not the footer link further down).
  const panel = page.locator(`[id="${await close.getAttribute("aria-controls")}"]`);
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box && box.height > 300).toBeTruthy();
  await panel.getByRole("button", { name: "Компания" }).click();
  const link = panel.getByRole("link", { name: "Как работим", exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/proces$/);
  await expect(page.getByRole("button", { name: "Отвори менюто" })).toHaveAttribute("aria-expanded", "false");
});

test("sticky quote bar appears after scrolling, hides at CTAs, never on the contact page", async ({ page }) => {
  await page.goto("/bg/uslugi/poddrazhka-na-online-magazini");
  const bar = page.getByTestId("sticky-quote-bar");
  await expect(bar).toHaveAttribute("aria-hidden", "true");
  await page.evaluate(() => window.scrollTo(0, 1600));
  await expect(bar).toHaveAttribute("aria-hidden", "false");
  await expect(bar.getByRole("link", { name: "Поискай оферта" })).toHaveAttribute("href", "/bg/kontakti?tip=oferta");

  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(bar).toHaveAttribute("aria-hidden", "true");

  await page.goto("/bg/kontakti");
  await expect(page.getByTestId("sticky-quote-bar")).toHaveCount(0);
});

test("sticky quote bar can be dismissed for the session", async ({ page }) => {
  await page.goto("/bg/ai-resheniya");
  await page.evaluate(() => window.scrollTo(0, 1400));
  const bar = page.getByTestId("sticky-quote-bar");
  await expect(bar).toHaveAttribute("aria-hidden", "false");
  await bar.getByRole("button", { name: "Скрий" }).click();
  await expect(bar).toHaveAttribute("aria-hidden", "true");
  await page.goto("/bg/za-kogo");
  await page.evaluate(() => window.scrollTo(0, 1400));
  await expect(page.getByTestId("sticky-quote-bar")).toHaveAttribute("aria-hidden", "true");
});

test("contact form is usable on mobile", async ({ page }) => {
  await page.goto("/bg/kontakti");
  await expect(page.getByRole("button", { name: "Изпрати запитването" })).toBeVisible();
  const box = await page.getByLabel(/Описание на проекта/).boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.width <= viewport.width).toBeTruthy();
});

test("AI team configurator works on a phone: one-column agents, vertical diagram, no overflow", async ({ page }) => {
  await page.goto("/en/tools/ai-team");
  const form = page.getByTestId("team-form");
  await form.getByRole("radio", { name: "E-commerce" }).check();
  await form.getByRole("radio", { name: "11–50 people" }).check();
  await form.getByRole("group", { name: "Department leading the initiative" }).getByRole("radio", { name: "Sales" }).check();
  await form.getByRole("radio", { name: "Inquiries are not followed up in time" }).check();
  await form.getByRole("radio", { name: "100–1,000" }).check();
  await form.getByRole("button", { name: "Next" }).click();
  await form.getByRole("button", { name: "Next" }).click();

  const cards = form.locator("[data-agent]");
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(first && second && second.y > first.y + first.height - 1).toBeTruthy(); // stacked, not side by side
  await form.getByRole("checkbox", { name: "Lead Qualification Agent" }).check();
  await form.getByRole("checkbox", { name: "Scheduling Agent" }).check();
  await form.getByRole("button", { name: "Next" }).click();
  await form.getByRole("radio", { name: /^Managed cloud environment/ }).check();
  await form.getByRole("button", { name: "Next" }).click();
  await form.getByRole("radio", { name: /^We do/ }).check();
  await form.getByRole("button", { name: "Next" }).click();

  await expect(form.locator("svg[data-orientation='vertical']")).toBeVisible();
  await expect(form.locator("svg[data-orientation='horizontal']")).toBeHidden();
  await form.locator("svg[data-orientation='vertical'] [data-node='agent:scheduling']").tap();
  await expect(page.getByTestId("architecture-details")).toContainText("Scheduling Agent");
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await form.getByRole("button", { name: "See the result" }).click();
  await expect(page.getByTestId("team-result")).toBeVisible();
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("ROI calculator works on a phone: live result and no horizontal scrolling", async ({ page }) => {
  await page.goto("/en/tools/roi-calculator");
  for (const [label, value] of [
    ["Tasks per month", "2000"],
    ["Average time per task", "12"],
    ["Fully loaded hourly labour cost", "25"],
    ["Share of tasks automated", "60"],
    ["Time reduction per automated task", "70"],
    ["Human review time", "2"],
    ["Exception and rework rate", "0"],
    ["One-time implementation cost", "15000"],
    ["Monthly AI, API and infrastructure cost", "300"],
    ["Monthly maintenance cost", "200"],
  ] as const) {
    await page.getByLabel(label).fill(value);
  }
  await page.getByRole("radio", { name: "12 months" }).check();
  await page.getByRole("radio", { name: "75%" }).check();
  await expect(page.getByTestId("roi-net-monthly")).toHaveText("€1,900");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("the AI readiness assessment can be completed on a phone", async ({ page }) => {
  await page.goto("/bg/instrumenti/ai-gotovnost");
  const form = page.getByTestId("readiness-form");
  for (let step = 0; step < 6; step++) {
    for (const group of await form.getByRole("group").all()) await group.getByRole("radio").nth(3).check();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `step ${step + 1}`).toBeLessThanOrEqual(0);
    await form.getByRole("button", { name: step === 5 ? "Вижте резултата" : "Напред" }).click();
  }
  const result = page.getByTestId("readiness-result");
  await expect(result.getByTestId("tool-score")).toHaveText("75");
  await expect(result.getByTestId("tool-level")).toHaveText("Готовност за мащабиране");
  await expect(result.getByRole("heading", { name: "План за първите 90 дни" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});
