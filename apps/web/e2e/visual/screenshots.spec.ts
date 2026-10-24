import fs from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

/**
 * Visual capture (not a pass/fail test): full-page screenshots of the key pages at several
 * widths plus a horizontal-overflow measurement. Output: screenshots/<SHOT_LABEL>/.
 *   docker compose --profile test run --rm -e SHOT_LABEL=after \
 *     -v ./apps/web/e2e/screenshots:/e2e/screenshots e2e npx playwright test -c playwright.screens.config.ts
 */
const LABEL = process.env.SHOT_LABEL ?? "current";
const OUT = path.join("screenshots", LABEL);

const PAGES: [string, string][] = [
  ["home-bg", "/bg"],
  ["home-en", "/en"],
  ["services-bg", "/bg/uslugi"],
  ["services-en", "/en/services"],
  ["service-seo-bg", "/bg/uslugi/seo-optimizatsiya"],
  ["service-automation-en", "/en/services/business-process-automation"],
  ["ams-bg", "/bg/uslugi/ai-managed-services"],
  ["ams-en", "/en/services/ai-managed-services"],
  ["ai-solutions-bg", "/bg/ai-resheniya"],
  ["contact-bg", "/bg/kontakti"],
  ["contact-en", "/en/contact"],
  ["advisor-bg", "/bg/ai-automation-advisor"],
  ["advisor-en", "/en/ai-automation-advisor"],
  ["insights-bg", "/bg/statii"],
  ["article-en", "/en/insights/shopify-vs-woocommerce"],
  ["admin-login", "/admin/login"],
];

// Optional filters for quick iterations: SHOT_ONLY=home-bg,home-en  SHOT_WIDTHS=1440,390
const ONLY = (process.env.SHOT_ONLY ?? "").split(",").filter(Boolean);
const WIDTHS = (process.env.SHOT_WIDTHS ?? "").split(",").filter(Boolean).map(Number);
const FULL = [1440, 390].filter((w) => !WIDTHS.length || WIDTHS.includes(w));
const CHECK_ONLY = [1024, 768, 360].filter((w) => !WIDTHS.length || WIDTHS.includes(w));
const SELECTED = ONLY.length ? PAGES.filter(([name]) => ONLY.includes(name)) : PAGES;

test.describe.configure({ mode: "serial" });

test("capture pages", async ({ page }) => {
  test.setTimeout(900_000);
  fs.mkdirSync(path.join(OUT, "slices"), { recursive: true });
  const overflow: Record<string, Record<number, number>> = {};

  for (const width of [...FULL, ...CHECK_ONLY]) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const [name, url] of SELECTED) {
      await page.goto(url, { waitUntil: "networkidle" });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      (overflow[name] ??= {})[width] = extra;
      if (FULL.includes(width)) {
        await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
        // Viewport-sized slices of the first screens, readable at review scale.
        const viewport = page.viewportSize()!;
        const height = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let i = 0, y = 0; y < height && i < (width > 1000 ? 16 : 22); i++, y += viewport.height) {
          await page.screenshot({
            path: path.join(OUT, "slices", `${name}-${width}-${String(i + 1).padStart(2, "0")}.png`),
            fullPage: true,
            clip: { x: 0, y, width: viewport.width, height: Math.min(viewport.height, height - y) },
          });
        }
      }
    }
  }

  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (email && password && !ONLY.length) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/login");
    await page.locator("#login-email").fill(email);
    await page.locator("#login-password").fill(password);
    await page.locator("form button[type=submit]").click();
    await page.waitForURL(/\/admin$/);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(OUT, "admin-dashboard-1440.png"), fullPage: true });
    await page.goto("/admin/leads");
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(OUT, "admin-leads-1440.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(OUT, "admin-leads-390.png"), fullPage: true });
  }

  fs.writeFileSync(path.join(OUT, "overflow.json"), JSON.stringify(overflow, null, 2));
  expect(Object.keys(overflow).length).toBe(SELECTED.length);
});
