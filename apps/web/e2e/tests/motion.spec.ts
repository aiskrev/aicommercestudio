import { expect, type Page, test } from "@playwright/test";

/**
 * Reduced motion (DESIGN_SYSTEM.md → motion): with `prefers-reduced-motion: reduce` nothing on the
 * page animates or transitions for longer than an instant, scroll reveals are off (content visible at
 * once), decorative motion is hidden and menus open without an entry animation. The no-preference run
 * shows that the same checks would catch motion, so the test cannot pass vacuously.
 */

const PAGES = ["/bg", "/en/services", "/bg/rabotni-sreshti", "/en/tools", "/bg/referentni-stsenarii"];

/** The longest animation or transition duration (seconds) of any element or pseudo-element. */
async function longestMotion(page: Page): Promise<number> {
  return page.evaluate(() => {
    const seconds = (value: string) =>
      value.split(",").map((part) => {
        const v = part.trim();
        return v.endsWith("ms") ? parseFloat(v) / 1000 : parseFloat(v);
      });
    let longest = 0;
    for (const element of Array.from(document.querySelectorAll("*"))) {
      for (const pseudo of [null, "::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        const animated = style.animationName !== "none";
        const values = [...seconds(style.transitionDuration), ...(animated ? seconds(style.animationDuration) : [])];
        for (const value of values) if (Number.isFinite(value)) longest = Math.max(longest, value);
      }
    }
    return longest;
  });
}

test.describe("reduced motion requested", () => {
  test.use({ reducedMotion: "reduce" });

  for (const path of PAGES) {
    test(`${path}: no animation or transition, content shown at once`, async ({ page }) => {
      await page.goto(path);
      expect(await longestMotion(page)).toBeLessThan(0.01);
      const reveals = page.locator(".reveal");
      const count = await reveals.count();
      for (let i = 0; i < count; i += 1) {
        const style = await reveals.nth(i).evaluate((el) => ({ name: getComputedStyle(el).animationName, opacity: getComputedStyle(el).opacity }));
        expect(style.name).toBe("none");
        expect(style.opacity).toBe("1");
      }
      for (const decorative of await page.locator(".motion-decorative").all()) await expect(decorative).toBeHidden();
    });
  }

  test("the services menu opens without an entry animation", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/bg");
    const services = page.locator("header nav").first().getByRole("button", { name: "Услуги" });
    await services.click();
    const panel = page.locator(`[id="${await services.getAttribute("aria-controls")}"]`);
    await expect(panel).toBeVisible();
    const animated = await panel.evaluate((root) =>
      [root, ...Array.from(root.querySelectorAll("*"))].some((el) => getComputedStyle(el).animationName !== "none"),
    );
    expect(animated).toBe(false);
  });
});

test.describe("no motion preference", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the same check sees the site's transitions and scroll reveals", async ({ page }) => {
    await page.goto("/bg");
    expect(await longestMotion(page)).toBeGreaterThan(0.05);
    const supportsTimeline = await page.evaluate(() => CSS.supports("animation-timeline: view()"));
    if (supportsTimeline) {
      const names = await page.locator(".reveal").evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
      expect(names.length).toBeGreaterThan(0);
      expect(names.some((name) => name !== "none")).toBe(true);
    }
  });
});
