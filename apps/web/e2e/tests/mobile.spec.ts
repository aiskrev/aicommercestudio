import { expect, test } from "@playwright/test";

const PAGES = ["/", "/uslugi", "/uslugi/seo-optimizatsiya", "/ai-resheniya", "/za-kogo", "/proces", "/kontakti", "/statii", "/admin/login"];

test("pages fit the mobile viewport without horizontal scrolling", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});

test("mobile menu opens, navigates and closes", async ({ page }) => {
  await page.goto("/");
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
  const link = panel.getByRole("link", { name: "Процес", exact: true });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/proces$/);
  await expect(page.getByRole("button", { name: "Отвори менюто" })).toHaveAttribute("aria-expanded", "false");
});

test("contact form is usable on mobile", async ({ page }) => {
  await page.goto("/kontakti");
  await expect(page.getByRole("button", { name: "Изпрати запитването" })).toBeVisible();
  const box = await page.getByLabel(/Описание на проекта/).boundingBox();
  const viewport = page.viewportSize();
  expect(box && viewport && box.width <= viewport.width).toBeTruthy();
});
