import { expect, test } from "@playwright/test";

/** Information architecture: navigation, tools hub, service template and legacy routes. */

test("every pre-existing public route still answers 200", async ({ request }) => {
  const legacy = [
    "/bg", "/bg/uslugi", "/bg/ai-resheniya", "/bg/ai-automation-advisor", "/bg/za-kogo", "/bg/proces", "/bg/za-nas",
    "/bg/kontakti", "/bg/statii", "/bg/uslugi/poddrazhka-na-online-magazini", "/bg/uslugi/seo-optimizatsiya",
    "/bg/uslugi/ai-instrumenti-za-biznesa", "/bg/uslugi/avtomatizatsiya-na-procesi", "/bg/uslugi/analizi-i-konversii",
    "/bg/uslugi/api-integratsii-oblak-i-sigurnost", "/bg/uslugi/ai-managed-services", "/bg/uslugi/tehnicheski-odit",
    "/en", "/en/services", "/en/ai-solutions", "/en/ai-automation-advisor", "/en/industries", "/en/process", "/en/about",
    "/en/contact", "/en/insights", "/en/services/ai-managed-services",
  ];
  for (const path of legacy) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
});

for (const [locale, path, heading] of [
  ["bg", "/bg/instrumenti", "Интерактивни инструменти за първа оценка"],
  ["en", "/en/tools", "Interactive tools for a first assessment"],
] as const) {
  test(`tools hub (${locale}) links every live tool and never links a planned tool to a tool page`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    const all = page.locator("section[aria-labelledby='tools-all-title']");
    const links = await all.locator("article[data-status='live'] a").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    expect(links).toEqual(
      locale === "bg"
        ? [
            "/bg/ai-automation-advisor",
            "/bg/instrumenti/ai-gotovnost",
            "/bg/instrumenti/ai-ekip",
            "/bg/instrumenti/roi-kalkulator",
            "/bg/instrumenti/avtomatizatsii",
            "/bg/instrumenti/ai-reshenie",
            "/bg/ai-agenti",
            "/bg/instrumenti/zrelost-na-oblak-i-platforma",
            "/bg/instrumenti/zrelost-na-devops-dostavkata",
            "/bg/instrumenti/nablyudaemost-i-nadezhdnost",
            "/bg/instrumenti/arhitektura-na-online-magazin",
            "/bg/instrumenti/integratsiya-na-danni",
            "/bg/instrumenti/otgovoren-ai",
            "/bg/instrumenti/gotovnost-za-ai-operatsii",
            "/bg/instrumenti/finops-i-ai-razhodi",
          ]
        : [
            "/en/ai-automation-advisor",
            "/en/tools/ai-readiness",
            "/en/tools/ai-team",
            "/en/tools/roi-calculator",
            "/en/tools/automation-finder",
            "/en/tools/solution-builder",
            "/en/ai-agents",
            "/en/tools/cloud-platform-maturity",
            "/en/tools/devops-delivery-maturity",
            "/en/tools/observability-reliability",
            "/en/tools/ecommerce-architecture",
            "/en/tools/data-integration",
            "/en/tools/responsible-ai-governance",
            "/en/tools/ai-operations-readiness",
            "/en/tools/finops-ai-cost",
          ],
    );
    // Every tool is live now; nothing is listed as "Coming soon".
    const planned = all.locator("article[data-status='planned']");
    await expect(planned).toHaveCount(0);
    for (const href of await planned.locator("a").evaluateAll((els) => els.map((el) => el.getAttribute("href")))) {
      expect(href).toMatch(locale === "bg" ? /^\/bg\/instrumenti\/[a-z-]+$/ : /^\/en\/tools\/[a-z-]+$/);
      expect(links).not.toContain(href);
    }
    await expect(planned.locator("button")).toHaveCount(0);
  });
}

test("language switcher maps the tools hub and the AI agents page", async ({ page }) => {
  await page.goto("/bg/instrumenti");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/tools$/);
  await page.goto("/en/services/ai-agent-development");
  await page.locator("header").getByRole("link", { name: "Превключи на български" }).first().click();
  await expect(page).toHaveURL(/\/bg\/uslugi\/razrabotka-na-ai-agenti$/);
});

test("the AI agents service page follows the service template and preselects the service in contact", async ({ page }) => {
  await page.goto("/en/services/ai-agent-development");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("AI agent development");
  for (const id of ["problems-title", "approach-title", "capabilities-title", "use-cases-title", "service-process-title", "service-tools-title", "service-faq-title"]) {
    await expect(page.locator(`[id="${id}"]`), id).toBeVisible();
  }
  const toolLinks = await page
    .locator("section[aria-labelledby='service-tools-title']")
    .getByRole("link")
    .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
  expect(toolLinks).toEqual(["/en/ai-automation-advisor", "/en/tools/ai-team", "/en/tools/solution-builder", "/en/ai-agents"]);
  await page.locator("main").getByRole("link", { name: "Request a quote" }).first().click();
  await expect(page).toHaveURL(/\/en\/contact\?service=ai_agents&type=quote$/);
  await expect(page.getByLabel(/^Service/)).toHaveValue("ai_agents");
});

// V5 menus (lib/site-nav.ts, docs/V5_LINK_AUDIT.md). The full desktop bar is shown from 1440 px.
test("desktop Studio menu works with the keyboard (formerly Company)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en");
  const studio = page.locator("header nav").first().getByRole("button", { name: "Studio" });
  await studio.focus();
  await page.keyboard.press("Enter");
  await expect(studio).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveAttribute("href", "/en/about"); // the overview link
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText(/Examples & demonstrations/);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveText(/Reference scenarios/);
  await page.keyboard.press("End");
  await expect(page.locator(":focus")).toHaveText(/Insights/);
  await page.keyboard.press("Escape");
  await expect(studio).toHaveAttribute("aria-expanded", "false");
  await expect(studio).toBeFocused();
});

test("desktop mega-menus: every published domain, keyboard, inside the viewport and navigation", async ({ page }) => {
  const DOMAIN_SLUGS = [
    "ai-strategiya-i-transformatsiya",
    "ai-agenti-i-biznes-avtomatizatsiya",
    "ai-prilozheniya-i-sistemi-za-znaniya",
    "inzhenering-za-elektronna-targoviya",
    "oblachen-i-platformen-inzhenering",
    "devops-sre-i-nablyudaemost",
    "inzhenering-na-danni-i-integratsii",
    "ai-upravlenie-sigurnost-i-nadezhdnost",
    "upravlyavani-ai-i-platformeni-operatsii",
    "konsultatsii-otsenki-i-obuchenie",
  ];
  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/bg");
    const hrefs = new Set<string>();
    for (const id of ["websites", "ecommerce", "ai", "maintenance", "pricing", "studio"]) {
      const toggle = page.getByTestId(`menu-${id}`);
      await toggle.click();
      const panel = page.getByTestId(`panel-${id}`);
      await expect(panel).toBeVisible();
      // The panel stays inside the viewport and the page never scrolls sideways.
      const box = await panel.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      for (const href of await panel.locator("a").evaluateAll((els) => els.map((el) => el.getAttribute("href")!))) hrefs.add(href);
      await page.keyboard.press("Escape");
      await expect(toggle).toBeFocused();
    }
    for (const slug of DOMAIN_SLUGS) expect(hrefs.has(`/bg/uslugi/${slug}`), slug).toBe(true);
    expect(hrefs.has("/bg/uslugi")).toBe(true);
  }
  const ecommerce = page.getByTestId("menu-ecommerce");
  await ecommerce.click();
  const column = page.getByTestId("panel-ecommerce").locator("[data-nav-column]").first();
  await column.locator("a").first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(column.locator("a").nth(1)).toBeFocused();
  await page.getByTestId("panel-ecommerce").getByRole("link", { name: /^Инженеринг за електронна търговия/ }).click();
  await expect(page).toHaveURL(/\/bg\/uslugi\/inzhenering-za-elektronna-targoviya$/);
  await expect(ecommerce).toHaveAttribute("aria-expanded", "false");
});

test("mobile menu at 360px groups the offer and keeps keyboard focus inside", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/bg");
  const toggle = page.getByRole("button", { name: "Отворете менюто" });
  await toggle.click();
  const close = page.getByRole("button", { name: "Затворете менюто" });
  const panel = page.locator(`[id="${await close.getAttribute("aria-controls")}"]`);
  // Accordion groups in the header order; one group open at a time.
  const websites = panel.getByRole("button", { name: "Изработка на сайтове" });
  await expect(websites).toHaveAttribute("aria-expanded", "false");
  await websites.click();
  await expect(websites).toHaveAttribute("aria-expanded", "true");
  for (const label of ["Видове сайтове", "Свързани услуги"]) await expect(panel.getByText(label, { exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Статичен фирмен сайт" })).toBeVisible();
  await panel.getByRole("button", { name: "AI и автоматизация" }).click();
  await expect(websites).toHaveAttribute("aria-expanded", "false");
  await expect(panel.getByRole("link", { name: "Разработка на AI агенти" })).toBeVisible();
  await panel.getByRole("button", { name: "Поддръжка" }).click();
  await expect(panel.getByRole("link", { name: "DevOps, SRE и наблюдаемост" })).toBeVisible();
  await panel.getByRole("button", { name: "Студио" }).click();
  await expect(panel.getByRole("link", { name: "За основателя" })).toBeVisible();
  await expect(page.getByTestId("mobile-cta")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  // The page behind the sheet is inert: tabbing never leaves the header and the sheet.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(
      (id) => Boolean(document.activeElement?.closest(`header, [id="${id}"]`)) || document.activeElement === document.body,
      await close.getAttribute("aria-controls"),
    );
    expect(inside, `tab ${i}`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
});
