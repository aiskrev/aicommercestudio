import { expect, type Page, test } from "@playwright/test";

/**
 * "Operational AI in motion" layer (docs/MOTION_SYSTEM.md): the hero signature, magnetic CTAs, service portals,
 * the process narrative, the integration packet, the package FLIP, the AI demo stage and the system checks —
 * and that reduced motion, touch, keyboard and a page without JavaScript get none of the pointer or loop motion
 * while every piece of content stays visible.
 */

const translate = (page: Page, selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).translate);

test.describe("no motion preference, fine pointer", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

  test("kinetic headline: same text, words only (no characters), painted with the first contentful paint", async ({ page }) => {
    await page.goto("/bg");
    const h1 = page.locator("h1");
    await expect(h1).toHaveText("Създаваме сайтове, онлайн магазини и AI решения, които движат бизнеса напред.");
    // One mask per word, never per character.
    const words = await h1.locator(".kw-in").allTextContents();
    expect(words.length).toBe(11);
    expect(words.every((word) => word.length > 1 || /[иa]/i.test(word))).toBe(true);
    const timing = await page.evaluate(
      () =>
        new Promise<{ fcp: number; lcp: number; element: string }>((resolve) => {
          // Both from buffered observers: the load event can resolve before the paint entries exist.
          let fcp = -1;
          new PerformanceObserver((list) => {
            fcp = list.getEntriesByName("first-contentful-paint")[0]?.startTime ?? fcp;
          }).observe({ type: "paint", buffered: true });
          new PerformanceObserver((list) => {
            const entries = list.getEntries() as (PerformanceEntry & { element?: Element })[];
            const last = entries[entries.length - 1];
            setTimeout(() => resolve({ fcp, lcp: last.startTime, element: last.element?.closest("h1, p, figure, div")?.tagName ?? "?" }), 50);
          }).observe({ type: "largest-contentful-paint", buffered: true });
        }),
    );
    expect(timing.fcp).toBeGreaterThan(0);
    // Within a frame of the first paint (opacity is never below 1; the words start inside their masks).
    expect(timing.lcp - timing.fcp).toBeLessThanOrEqual(17);
    expect(await h1.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
  });

  test("magnetic CTA: follows a mouse a few pixels, bounded, and lets go", async ({ page }) => {
    await page.goto("/bg");
    const cta = page.getByTestId("hero-primary");
    await expect(cta).toHaveAttribute("data-magnetic", "");
    const box = (await cta.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    // Right edge, vertically centred: the pill shape has no hit area in its corners.
    await page.mouse.move(box.x + box.width - 8, box.y + box.height / 2, { steps: 4 });
    await expect.poll(() => cta.evaluate((el) => el.style.getPropertyValue("--mag-x"))).not.toBe("");
    await page.waitForTimeout(400);
    const [x, y] = (await translate(page, '[data-testid="hero-primary"]')).split(" ").map(parseFloat);
    expect(x).toBeGreaterThan(3);
    expect(Math.abs(x)).toBeLessThanOrEqual(7.01);
    expect(Math.abs(y || 0)).toBeLessThanOrEqual(7.01);
    await page.mouse.move(5, 600);
    await expect.poll(() => cta.evaluate((el) => el.style.getPropertyValue("--mag-x"))).toBe("");
  });

  test("magnetic CTA: keyboard focus never moves it", async ({ page }) => {
    await page.goto("/bg");
    await page.getByTestId("hero-primary").focus();
    await page.waitForTimeout(300);
    expect(await translate(page, '[data-testid="hero-primary"]')).toMatch(/^(none|0px( 0px)?)$/);
  });

  test("Velora showcase: every live demo mounts, the marquee and the orbit move, loops pause off screen", async ({ page }) => {
    await page.goto("/bg");
    const hero = page.locator(".vl-hero");
    for (const name of ["globe", "morphing-text", "border-beam", "dock", "3d-card", "animated-list"]) {
      await expect(page.locator(`[data-demo="${name}"]`)).toHaveAttribute("data-mounted", "true", { timeout: 8000 });
    }
    const names = await page.evaluate(() => document.getAnimations().map((a) => (a as CSSAnimation).animationName).filter(Boolean));
    expect(names).toContain("marquee");
    expect(names).toContain("orbit");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(hero).toHaveAttribute("data-offscreen", "");
    expect(await page.locator('.vl-hero [data-slot="orbiting-circle"]').first().evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("paused");
  });

  test("service portals: lift, spotlight and a tilt of at most 2°", async ({ page }) => {
    await page.goto("/bg");
    const card = page.getByTestId("showcase-store");
    await card.scrollIntoViewIfNeeded();
    await expect(page.getByTestId("home-showcase")).toHaveAttribute("data-reveal", "done", { timeout: 4000 });
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1, { steps: 5 });
    await page.waitForTimeout(500);
    const state = await card.evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return { spot: getComputedStyle(el, "::before").opacity, lift: m.m42, rotateY: (Math.asin(Math.max(-1, Math.min(1, m.m13))) * 180) / Math.PI };
    });
    expect(state.spot).toBe("1");
    expect(state.lift).toBeLessThan(-5);
    expect(Math.abs(state.rotateY)).toBeGreaterThan(0.5);
    expect(Math.abs(state.rotateY)).toBeLessThanOrEqual(2.01);
  });

  test("process narrative: pinned, scroll selects the stages in order, clicks and keys still work", async ({ page }) => {
    await page.goto("/bg");
    const narrative = page.locator(".process-narrative");
    const height = await narrative.evaluate((el) => el.getBoundingClientRect().height);
    expect(height).toBeGreaterThan(900 * 2.5);
    expect(height).toBeLessThan(900 * 3.5);
    const tabs = page.getByTestId("home-timeline").getByRole("tab");
    const top = await narrative.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    const seen: number[] = [];
    for (let y = top - 400; y < top + height - 400; y += 120) {
      await page.evaluate((value) => window.scrollTo(0, value), y);
      await page.waitForTimeout(60);
      const index = await tabs.evaluateAll((list) => list.findIndex((tab) => tab.getAttribute("aria-selected") === "true"));
      if (seen[seen.length - 1] !== index) seen.push(index);
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    // The stages stay pinned below the header while the narrative scrolls.
    const pinned = await page.locator(".process-sticky").evaluate((el) => getComputedStyle(el).position);
    expect(pinned).toBe("sticky");
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(2)).toBeFocused();
    await page.waitForTimeout(1300);
    await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  });

  test("integration flow: the packet runs along the bus and every node pulses", async ({ page }) => {
    await page.goto("/bg");
    const figure = page.locator(".fc-flow-figure");
    await figure.scrollIntoViewIfNeeded();
    await expect(page.locator(".fc-packet")).toBeAttached();
    const names = await figure.evaluate((el) => [getComputedStyle(el.querySelector(".fc-packet")!).animationName, ...Array.from(el.querySelectorAll(".fc-node"), (node) => getComputedStyle(node, "::after").animationName)]);
    expect(names[0]).toBe("packet-run");
    expect(names.slice(1)).toEqual(Array(5).fill("node-pulse"));
  });

  test("package filter: persisting cards glide (FLIP), prices unchanged", async ({ page }) => {
    await page.goto("/bg");
    const offers = page.getByTestId("home-offers");
    await offers.scrollIntoViewIfNeeded();
    const prices = await offers.locator(":scope > li").allTextContents();
    const filter = page.locator("#package-filter-tab-2");
    await filter.click();
    const moving = await offers.evaluate((list) => Array.from(list.children).reduce((sum, el) => sum + el.getAnimations().length, 0));
    expect(moving).toBeGreaterThan(0);
    await page.locator("#package-filter-tab-0").click();
    await page.waitForTimeout(700);
    expect(await offers.locator(":scope > li").allTextContents()).toEqual(prices);
  });

  test("AI demo stage: one scene per real step, restart returns to idle, disclosure stays", async ({ page }) => {
    await page.goto("/bg");
    const demo = page.getByTestId("ai-demo");
    const stage = demo.getByTestId("ai-demo-stage");
    await demo.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-scene", "idle");
    const scenes: string[] = [];
    await demo.getByTestId("ai-demo-next").click();
    for (let step = 0; step < 4; step += 1) {
      scenes.push((await stage.getAttribute("data-scene"))!);
      if (step < 3) await demo.getByTestId("ai-demo-next").click();
    }
    await demo.getByTestId("ai-demo-next").click();
    scenes.push((await stage.getAttribute("data-scene"))!);
    expect(scenes).toEqual(["receive", "classify", "extract", "draft", "approve"]);
    await demo.getByTestId("ai-demo-approve").click();
    await expect(stage).toHaveAttribute("data-decision", "approved");
    await demo.getByRole("button", { name: "Отначало" }).click();
    await expect(stage).toHaveAttribute("data-scene", "idle");
    await expect(demo.getByTestId("ai-demo-disclaimer")).toBeVisible();
  });

  test("system checks tick in sequence once in view", async ({ page }) => {
    await page.goto("/bg");
    const checks = page.getByTestId("system-checks");
    await expect(checks).toHaveAttribute("data-reveal", "pending");
    await checks.scrollIntoViewIfNeeded();
    await expect(checks).toHaveAttribute("data-reveal", /^(in|done)$/);
    const delays = await checks.locator(".sys-tick").evaluateAll((ticks) => ticks.map((tick) => parseFloat(getComputedStyle(tick).animationDelay)));
    expect(delays.length).toBeGreaterThan(2);
    for (let i = 1; i < delays.length; i += 1) expect(delays[i]).toBeGreaterThan(delays[i - 1]);
    await expect.poll(() => checks.locator(".sys-tick").last().evaluate((el) => getComputedStyle(el).opacity), { timeout: 4000 }).toBe("1");
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });

  test("no pointer, magnetic, loop, packet or scrubbed motion; everything visible", async ({ page }) => {
    await page.goto("/bg");
    const cta = page.getByTestId("hero-primary");
    const box = (await cta.boundingBox())!;
    await page.mouse.move(box.x + box.width - 2, box.y + 2, { steps: 4 });
    await page.waitForTimeout(300);
    expect(await cta.evaluate((el) => el.style.getPropertyValue("--mag-x"))).toBe("");
    expect(await translate(page, '[data-testid="hero-primary"]')).toBe("none");
    for (const selector of [".fc-packet", ".fc-trace"]) await expect(page.locator(selector).first()).toBeHidden();
    // Not pinned, all six stages reachable without a scroll narrative; the flow and the checks are complete.
    expect(await page.locator(".process-sticky").evaluate((el) => getComputedStyle(el).position)).toBe("static");
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const running = await page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length);
    expect(running).toBe(0);
    for (const tick of await page.locator(".sys-tick").all()) expect(await tick.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await page.locator(".fc-bus-fill").evaluate((el) => getComputedStyle(el).transform)).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  });
});

test.describe("touch", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("press feedback only: no pointer effects, vertical stepper without pinning, nothing hover-only", async ({ page }) => {
    await page.goto("/bg");
    await page.getByTestId("hero-primary").tap({ trial: true });
    await page.touchscreen.tap(200, 300);
    expect(await page.locator(".vl-hero").evaluate((el) => el.style.getPropertyValue("--fx"))).toBe("");
    expect(await page.locator(".process-sticky").evaluate((el) => getComputedStyle(el).position)).toBe("static");
    expect(await page.getByTestId("home-timeline").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length)).toBe(1);
    // The service cards show their details without hover.
    await expect(page.getByTestId("showcase-quote-store")).toBeVisible();
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false, reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

  test("headline, narrative and checks are complete and nothing is pinned", async ({ page }) => {
    await page.goto("/bg");
    await expect(page.locator("h1")).toHaveText("Създаваме сайтове, онлайн магазини и AI решения, които движат бизнеса напред.");
    expect(await page.locator(".process-sticky").evaluate((el) => getComputedStyle(el).position)).toBe("static");
    expect(await page.locator(".process-narrative").evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(900 * 1.5);
    for (const tick of await page.locator(".sys-tick").all()) expect(await tick.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    await expect(page.getByTestId("process-stage-panel").locator("[data-active=true]")).toBeVisible();
  });
});

test.describe("pause control (WCAG 2.2.2)", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

  test("one button pauses every animation for the visit and resumes it", async ({ page }) => {
    await page.goto("/bg");
    const toggle = page.getByTestId("motion-toggle");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    const marquee = page.locator('.vl-hero [class*="animate-marquee"]').first();
    expect(await marquee.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("running");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "paused");
    expect(await marquee.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("paused");
    // No storage is written: the choice lasts for this visit only.
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(await marquee.evaluate((el) => getComputedStyle(el).animationPlayState)).toBe("running");
  });
});

test.describe("site-wide Velora motion (inner pages)", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 1440, height: 900 } });

  test("inner page hero: Velora backdrop, kinetic H1 with unchanged text, pill label", async ({ page }) => {
    await page.goto("/bg/uslugi");
    const h1 = page.locator("h1");
    await expect(h1).toHaveClass(/fc-kinetic/);
    const text = await h1.textContent();
    expect(text).toBe(text?.trim());
    expect(await h1.locator(".kw-in").count()).toBeGreaterThan(1);
    await expect(page.locator(".vl-page-hero [class*='animate-aurora']").first()).toBeAttached();
    await expect(page.locator(".vl-page-hero .t-eyebrow.vl-pill")).toBeVisible();
  });

  test("scroll progress follows the page scroll", async ({ page }) => {
    await page.goto("/bg/paketi");
    const bar = page.locator(".vl-scroll-progress");
    const scale = () => bar.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    expect(await scale()).toBeLessThan(0.05);
    await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2));
    await expect.poll(scale).toBeGreaterThan(0.3);
  });

  test("card grids reveal in varied ways and cards answer the pointer (spotlight, tilt ≤ 1.5°)", async ({ page }) => {
    await page.goto("/bg/uslugi");
    const variants = () => page.locator("[data-reveal-variant]").evaluateAll((els) => new Set(els.map((el) => el.getAttribute("data-reveal-variant"))).size);
    await expect.poll(variants).toBeGreaterThan(1);
    const card = page.locator("main :is(.motion-card, .card-interactive, .offer-card)").first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    const box = (await card.boundingBox())!;
    // hover() checks that the card itself receives the pointer (nothing on top of it).
    await card.hover({ position: { x: box.width * 0.85, y: box.height * 0.5 } });
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.55, { steps: 3 });
    await page.waitForTimeout(500);
    const state = await card.evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return { spot: getComputedStyle(el, "::after").opacity, rotateY: (Math.asin(Math.max(-1, Math.min(1, m.m13))) * 180) / Math.PI };
    });
    expect(state.spot).toBe("1");
    expect(Math.abs(state.rotateY)).toBeGreaterThan(0.2);
    expect(Math.abs(state.rotateY)).toBeLessThanOrEqual(1.51);
  });

  test("call-to-action panels carry a moving border beam", async ({ page }) => {
    await page.goto("/bg/uslugi/avtomatizatsiya-na-procesi");
    const beam = page.locator(".fc-cta .vl-beam > span").first();
    await beam.scrollIntoViewIfNeeded();
    expect(await beam.evaluate((el) => getComputedStyle(el).animationName)).toBe("vl-beam");
  });
});
