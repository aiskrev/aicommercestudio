import { expect, type Page, test } from "@playwright/test";

/**
 * V5 navigation and link audit (docs/V5_LINK_AUDIT.md). Crawls the rendered header (desktop panels and the mobile
 * sheet) and the footer in both languages at five widths, and checks that every destination answers 200, that
 * every in-page anchor exists, that nothing links a feature behind a switched-off flag, that labels are not empty
 * and that no page scrolls sideways. Disabled private routes (configurator, quote basket, quotations, accounts)
 * are expected to answer 404 on this default stack and are never counted as broken public pages — they must
 * simply never be linked.
 */

const WIDTHS = [360, 390, 768, 1024, 1440] as const;
const FLAGGED = /^\/(bg|en)\/(konfigurator|configurator|zayavka|quote-request|oferta|quotation|konto|account|proekti|case-studies)(\/|$|\?|#)/;

async function navLinks(page: Page) {
  return page.evaluate(() => {
    const scope = [...document.querySelectorAll("header a[href], [data-testid='mobile-menu'] a[href], footer a[href]")];
    return scope.map((a) => ({
      href: a.getAttribute("href") ?? "",
      label: (a.textContent ?? "").trim() || a.getAttribute("aria-label") || "",
      // The language switcher links to the other language on purpose (it declares hreflang).
      otherLanguage: a.hasAttribute("hreflang"),
    }));
  });
}

const statusCache = new Map<string, number>();
const anchorCache = new Map<string, Set<string>>();

for (const locale of ["bg", "en"] as const) {
  test(`header and footer links resolve in ${locale} (status, anchors, flags, labels)`, async ({ page, request }) => {
    test.setTimeout(240_000);
    await page.goto(`/${locale}`);
    const links = await navLinks(page);
    expect(links.length).toBeGreaterThan(60);
    const problems: string[] = [];
    for (const { href, label, otherLanguage } of links) {
      if (!label) problems.push(`empty label: ${href}`);
      if (!href || href === "#" || /undefined|null/.test(href)) problems.push(`placeholder href: "${href}" (${label})`);
      if (href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("/cdn-cgi/")) continue;
      if (!href.startsWith("/")) continue;
      if (FLAGGED.test(href)) problems.push(`links a disabled feature: ${href} (${label})`);
      if (!otherLanguage && !href.startsWith(`/${locale}`)) problems.push(`wrong-language target: ${href} (${label})`);
      const [path, hash] = href.split("#");
      if (!statusCache.has(path)) statusCache.set(path, (await request.get(path, { maxRedirects: 0 })).status());
      if (statusCache.get(path) !== 200) problems.push(`${href} -> ${statusCache.get(path)} (${label})`);
      if (hash) {
        if (!anchorCache.has(path)) {
          const probe = await page.context().newPage();
          await probe.goto(path);
          anchorCache.set(path, new Set(await probe.evaluate(() => [...document.querySelectorAll("[id]")].map((el) => el.id))));
          await probe.close();
        }
        if (!anchorCache.get(path)!.has(hash)) problems.push(`broken anchor: ${href} (${label})`);
      }
    }
    expect(problems).toEqual([]);
  });
}

for (const width of WIDTHS) {
  test(`navigation works and nothing scrolls sideways at ${width}px`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      storageState: { cookies: [{ name: "acs_cookie_notice", value: "1", domain: new URL(baseURL!).hostname, path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" }], origins: [] },
    });
    const page = await context.newPage();
    for (const path of ["/bg", "/en", "/bg/izrabotka-na-saytove", "/en/ecommerce", "/bg/paketi", "/bg/proektni-paketi"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(0);
    }
    await page.goto("/bg");
    if (width >= 1440) {
      const toggle = page.getByTestId("menu-websites");
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(page.getByTestId("panel-websites")).toBeVisible();
      await expect(page.getByTestId("overview-websites")).toHaveAttribute("href", "/bg/izrabotka-na-saytove");
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("panel-websites")).toBeHidden();
      await expect(toggle).toBeFocused();
      await expect(page.getByTestId("header-cta")).toBeVisible();
    } else {
      const open = page.getByRole("button", { name: "Отворете менюто" });
      await expect(open).toBeVisible();
      await open.click();
      const sheet = page.getByTestId("mobile-menu");
      await expect(sheet).toBeVisible();
      await expect(page.getByTestId("mobile-cta")).toBeInViewport();
      await sheet.getByRole("button", { name: "Онлайн магазини" }).click();
      const overview = sheet.getByRole("link", { name: /^Преглед: / }).first();
      await expect(overview).toBeVisible();
      // Touch targets: every visible link in the open group is at least 44 px tall.
      const heights = await sheet.getByRole("navigation", { name: "Основна навигация" }).locator("a:visible").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
      for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(open).toBeFocused();
    }
    await context.close();
  });
}

test("every in-page anchor linked anywhere in the sitemap exists on its target page", async ({ request }) => {
  test.setTimeout(240_000);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  const ids = new Map<string, Set<string>>();
  const idsOf = async (path: string) => {
    if (!ids.has(path)) {
      const html = await (await request.get(path)).text();
      ids.set(path, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
    }
    return ids.get(path)!;
  };
  const broken: string[] = [];
  for (const page of pages) {
    const html = await (await request.get(page)).text();
    for (const [, href] of html.matchAll(/<a[^>]+href="(\/[^"#]*#[^"]+)"/g)) {
      const decoded = href.replaceAll("&amp;", "&");
      const [path, hash] = decoded.split("#");
      if (!(await idsOf(path.split("?")[0])).has(hash)) broken.push(`${page} → ${decoded}`);
    }
    // Same-page jump links (href="#section").
    for (const [, hash] of html.matchAll(/<a[^>]+href="#([^"]+)"/g)) {
      if (hash !== "main" && !(await idsOf(page)).has(hash)) broken.push(`${page} → #${hash}`);
    }
  }
  expect([...new Set(broken)]).toEqual([]);
});

test("the mobile menu follows an in-page anchor and closes", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/bg/izrabotka-na-saytove");
  await page.getByRole("button", { name: "Отворете менюто" }).click();
  const sheet = page.getByTestId("mobile-menu");
  // On the hub itself its group is already open (the group of the current page).
  const group = sheet.getByRole("button", { name: "Изработка на сайтове" });
  await expect(group).toHaveAttribute("aria-expanded", "true");
  await sheet.getByRole("link", { name: "Статичен фирмен сайт" }).click();
  await expect(sheet).toBeHidden();
  await expect(page).toHaveURL(/\/bg\/izrabotka-na-saytove#static$/);
  await expect(page.locator("#static")).toBeInViewport();
  await context.close();
});

test("the language switcher maps the new hubs to their equivalents", async ({ page }) => {
  for (const [from, to] of [
    ["/bg/izrabotka-na-saytove", "/en/website-development"],
    ["/en/ecommerce", "/bg/online-magazini"],
  ] as const) {
    await page.goto(from);
    const href = await page.getByTestId(`lang-${to.slice(1, 3)}`).first().getAttribute("href");
    expect(href).toBe(to);
    const response = await page.goto(to);
    expect(response?.status()).toBe(200);
    const alternates = await page.locator("link[rel='alternate'][hreflang]").evaluateAll((els) => els.map((el) => [el.getAttribute("hreflang"), new URL(el.getAttribute("href")!).pathname]));
    expect(alternates).toEqual(expect.arrayContaining([["bg", to.startsWith("/bg") ? to : from], ["en", to.startsWith("/en") ? to : from]]));
  }
});

test("homepage → hub → offer → quote form carries the service", async ({ page }) => {
  await page.goto("/bg");
  await page.getByTestId("hero-primary").click();
  await expect(page).toHaveURL(/\/bg\/uslugi$/);
  await page.goto("/bg");
  await expect(page.getByTestId("hero-secondary")).toHaveAttribute("href", "/bg/kontakti?tip=oferta");
  await page.getByTestId("showcase-link-store").click();
  await expect(page).toHaveURL(/\/bg\/online-magazini$/);
  await page.getByTestId("hub-quote").click();
  await expect(page).toHaveURL(/\/bg\/kontakti\?usluga=store_development&tip=oferta$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
