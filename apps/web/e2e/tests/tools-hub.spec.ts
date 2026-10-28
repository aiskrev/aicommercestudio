import { expect, test } from "@playwright/test";

/**
 * Interactive Tools Hub: featured tools, category and availability filters, honest "Coming soon"
 * cards and intro pages (no form, no start button, noindex, not in the sitemap) and BG/EN routing.
 */
const CYRILLIC = /[Ѐ-ӿ]/;

for (const l of [
  {
    locale: "bg",
    hub: "/bg/instrumenti",
    engineering: "Инженерни оценки",
    planned: "Очаквайте скоро",
    count: /Показани инструменти: (\d+)/,
    intro: "/bg/instrumenti/nablyudaemost-i-nadezhdnost",
    introEn: "/en/tools/observability-reliability",
    introTitle: "Оценка на наблюдаемостта и надеждността",
    consult: "Заявете оценка с консултант",
  },
  {
    locale: "en",
    hub: "/en/tools",
    engineering: "Engineering assessments",
    planned: "Coming soon",
    count: /Tools shown: (\d+)/,
    intro: "/en/tools/observability-reliability",
    introEn: "/en/tools/observability-reliability",
    introTitle: "Observability & Reliability Assessment",
    consult: "Request the assessment from a consultant",
  },
] as const) {
  test(`tools hub (${l.locale}): featured tools, filters and honest cards`, async ({ page }) => {
    await page.goto(l.hub);
    const featured = page.getByTestId("tools-featured");
    await expect(featured.locator("article[data-status='live']")).toHaveCount(3);

    const directory = page.getByTestId("tools-directory");
    const count = directory.getByTestId("tools-count");
    await expect(count).toHaveText(l.count);
    expect(Number((await count.innerText()).match(/\d+/)![0])).toBe(15);

    // Keyboard: the category filter is a group of toggle buttons.
    const engineering = directory.getByRole("group").first().getByRole("button", { name: l.engineering });
    await engineering.focus();
    await page.keyboard.press("Enter");
    await expect(engineering).toHaveAttribute("aria-pressed", "true");
    await expect(directory.locator("article")).toHaveCount(5);
    await expect(directory.locator("article[data-status='live']")).toHaveCount(0);
    for (const card of await directory.locator("article").all()) {
      await expect(card).toContainText(l.planned);
      await expect(card.locator("button")).toHaveCount(0);
    }
    if (l.locale === "en") expect(await page.locator("main").innerText()).not.toMatch(CYRILLIC);

    await directory.locator("article").filter({ hasText: l.introTitle }).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`${l.intro}$`));
  });

  test(`planned tool intro (${l.locale}) is honest, noindex and routed in both languages`, async ({ page, request }) => {
    const response = await page.goto(l.intro);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(l.introTitle);
    await expect(page.getByTestId("tool-coming-soon")).toContainText(l.planned);
    const main = page.locator("main");
    await expect(main.locator("form, input, select, textarea")).toHaveCount(0);
    await expect(main.getByRole("button")).toHaveCount(0);
    await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
    expect(await page.locator("link[rel='canonical']").getAttribute("href")).toMatch(new RegExp(`${l.intro}$`));
    const alternates = await page.locator("link[rel='alternate'][hreflang]").evaluateAll((links) =>
      links.map((link) => new URL(link.getAttribute("href") ?? "").pathname),
    );
    expect(alternates).toContain(l.introEn);
    expect(alternates).toContain("/bg/instrumenti/nablyudaemost-i-nadezhdnost");

    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).not.toContain("nablyudaemost-i-nadezhdnost");
    expect(sitemap).not.toContain("observability-reliability");

    await main.getByRole("link", { name: l.consult }).click();
    await expect(page).toHaveURL(/\/(kontakti|contact)\?(usluga|service)=[a-z_]+$/);
    await expect(page.locator("form").first()).toBeVisible();
  });
}

test("the language switcher maps a planned tool intro and a live tool", async ({ page }) => {
  await page.goto("/bg/instrumenti/finops-i-ai-razhodi");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/tools\/finops-ai-cost$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("FinOps & AI Cost Assessment");
  await page.goto("/en/tools");
  await page.getByTestId("tools-featured").getByRole("link", { name: "AI readiness assessment" }).click();
  await expect(page).toHaveURL(/\/en\/tools\/ai-readiness$/);
});

test("unknown tool slugs return 404; a Bulgarian slug under /en redirects to the English one", async ({ request }) => {
  for (const path of ["/bg/instrumenti/oblak", "/en/tools/cloud-maturity", "/bg/instrumenti/observability-reliability"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  const redirect = await request.get("/en/tools/nablyudaemost-i-nadezhdnost", { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers().location).toMatch(/\/en\/tools\/observability-reliability$/);
});

test("the tools hub and an intro page fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/bg/instrumenti", "/en/tools", "/bg/instrumenti/arhitektura-na-online-magazin"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
