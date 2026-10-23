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
  await expect(page.getByRole("button", { name: "Затвори менюто" })).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "Процес" }).last().click();
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
