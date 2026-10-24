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
