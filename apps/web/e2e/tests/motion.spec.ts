import { expect, type Page, test } from "@playwright/test";

/**
 * Motion system (docs/MOTION_SYSTEM.md).
 *
 * Reduced motion: with `prefers-reduced-motion: reduce` nothing on the page animates or transitions for longer than
 * an instant, scroll reveals never hide anything, decorative motion is hidden and menus open without an entry
 * animation. The no-preference run shows that the same checks would catch motion, so the test cannot pass vacuously.
 *
 * Scroll reveal (`data-reveal`): content is visible without JavaScript and when it is on screen at load; below the
 * fold it is hidden only after the observer has seen it, and it is revealed once when scrolled to.
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

/** Every reveal target (the element, or its children for a group) as rendered: opacity and transform. */
async function revealStyles(page: Page) {
  return page.locator("[data-reveal]").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const targets = element.hasAttribute("data-reveal-children") ? Array.from(element.children) : [element];
      return targets.map((target) => {
        const style = getComputedStyle(target);
        return { state: element.getAttribute("data-reveal"), opacity: style.opacity, transform: style.transform };
      });
    }),
  );
}

test.describe("reduced motion requested", () => {
  test.use({ reducedMotion: "reduce" });

  for (const path of PAGES) {
    test(`${path}: no animation or transition, content shown at once`, async ({ page }) => {
      await page.goto(path);
      expect(await longestMotion(page)).toBeLessThan(0.01);
      // Scroll through the page: no reveal is ever armed, everything stays at full opacity in place.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      for (const style of await revealStyles(page)) {
        expect(style.state).toBe("");
        expect(style.opacity).toBe("1");
        expect(style.transform).toBe("none");
      }
      for (const decorative of await page.locator(".motion-decorative").all()) await expect(decorative).toBeHidden();
    });
  }

  test("the website-development menu opens without an entry animation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 }); // the full desktop bar (V5)
    await page.goto("/bg");
    const services = page.locator("header nav").first().getByRole("button", { name: "Изработка на сайтове" });
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

  test("the same check sees the site's transitions", async ({ page }) => {
    await page.goto("/bg");
    expect(await longestMotion(page)).toBeGreaterThan(0.05);
  });

  for (const path of ["/bg", "/bg/online-magazini", "/bg/uslugi/avtomatizatsiya-na-procesi"]) {
    test(`${path} hero: heading, lead and actions are fully opaque from the first frame`, async ({ page }) => {
      await page.goto(path);
      // fc-rise only moves (transform); the opacity is never below 1, so whichever is the LCP element (the heading,
      // or the lead on phones) is painted at once and the actions are usable at once.
      const opacities = await page.evaluate(() =>
        [document.querySelector("h1"), document.querySelector("h1 ~ .t-lead"), document.querySelector("h1 ~ .fc-rise:not(.t-lead)")].map((el) =>
          el ? `${el.classList.contains("fc-rise")}:${getComputedStyle(el).opacity}` : "missing",
        ),
      );
      expect(opacities).toEqual(["true:1", "true:1", "true:1"]);
    });
  }

  test("scroll reveal: hidden only below the fold, revealed once, never left hidden", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/bg");
    const cards = page.getByTestId("home-showcase");
    // Below the fold: armed (pending) by the observer, so its cards are transparent until scrolled to.
    await expect(cards).toHaveAttribute("data-reveal", "pending");
    await cards.scrollIntoViewIfNeeded();
    await expect(cards).toHaveAttribute("data-reveal", /^(in|done)$/);
    await expect(cards).toHaveAttribute("data-reveal", "done", { timeout: 3000 });
    const after = await cards.evaluate((list) => Array.from(list.children).map((child) => getComputedStyle(child).opacity));
    expect(after.every((opacity) => opacity === "1")).toBe(true);
    // Once revealed it stays revealed: scrolling away and back does not hide it again.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(cards).toHaveAttribute("data-reveal", "done");
  });

  test("tabs: the product selector keeps its height and follows the arrow keys", async ({ page }) => {
    await page.goto("/en");
    const showcase = page.getByTestId("product-showcase");
    const tabs = showcase.getByRole("tab");
    await tabs.first().focus();
    const before = await showcase.evaluate((el) => el.getBoundingClientRect().height);
    for (let index = 1; index < 4; index += 1) {
      await page.keyboard.press("ArrowRight");
      await expect(tabs.nth(index)).toHaveAttribute("aria-selected", "true");
      await expect(tabs.nth(index)).toBeFocused();
      expect(await showcase.evaluate((el) => el.getBoundingClientRect().height)).toBe(before);
    }
    // Only the shown panel is exposed and reachable.
    await expect(showcase.locator("[data-active=false]").first()).toHaveAttribute("aria-hidden", "true");
    await expect(showcase.locator("[data-active=true]")).toHaveCount(1);
  });

  test("mobile menu: Escape closes the sheet and returns focus to the toggle", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/bg");
    const toggle = page.locator("[data-menu-toggle]");
    await toggle.click();
    const sheet = page.getByTestId("mobile-menu");
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "no-preference" });

  test("every reveal target and the hero are visible", async ({ page }) => {
    await page.goto("/bg");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const styles = await revealStyles(page);
    expect(styles.length).toBeGreaterThan(0);
    for (const style of styles) {
      expect(style.state).toBe("");
      expect(style.opacity).toBe("1");
    }
  });
});
