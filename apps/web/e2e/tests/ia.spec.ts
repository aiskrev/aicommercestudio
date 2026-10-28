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
  test(`tools hub (${locale}) links every live tool and lists no unfinished one`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    const live = page.locator("section[aria-labelledby='tools-live-title']");
    const links = await live.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href")));
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
          ]
        : [
            "/en/ai-automation-advisor",
            "/en/tools/ai-readiness",
            "/en/tools/ai-team",
            "/en/tools/roi-calculator",
            "/en/tools/automation-finder",
            "/en/tools/solution-builder",
            "/en/ai-agents",
          ],
    );
    // Every registered tool is live, so the "in preparation" section is not rendered.
    await expect(page.locator("section[aria-labelledby='tools-upcoming-title']")).toHaveCount(0);
    await expect(page.locator("article[data-status='planned']")).toHaveCount(0);
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

test("desktop Company menu works with the keyboard (formerly About)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");
  const company = page.locator("header nav").first().getByRole("button", { name: "Company" });
  await company.focus();
  await page.keyboard.press("Enter");
  await expect(company).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveText("Who we are");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(":focus")).toHaveText("Founder");
  await page.keyboard.press("End");
  await expect(page.locator(":focus")).toHaveText("Contact");
  await page.keyboard.press("Escape");
  await expect(company).toHaveAttribute("aria-expanded", "false");
  await expect(company).toBeFocused();
});

test("desktop services mega-menu: three bands, ten domains, keyboard and navigation", async ({ page }) => {
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/bg");
    const nav = page.locator("header nav").first();
    const services = nav.getByRole("button", { name: "Услуги" });
    await services.click();
    const panel = page.locator(`[id="${await services.getAttribute("aria-controls")}"]`);
    await expect(panel).toBeVisible();
    for (const band of ["ai", "engineering", "operations"]) await expect(panel.getByTestId(`menu-band-${band}`)).toBeVisible();
    await expect(panel.locator("[data-testid^='menu-band-'] [data-nav-column] > li > a")).toHaveCount(10);
    await expect(panel.getByTestId("menu-start-here").getByRole("link", { name: /Всички услуги/ })).toHaveAttribute("href", "/bg/uslugi");
    // Every link resolves; the panel stays inside the viewport.
    const box = await panel.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.keyboard.press("Escape");
    await expect(services).toBeFocused();
  }
  const nav = page.locator("header nav").first();
  await nav.getByRole("button", { name: "Услуги" }).click();
  const first = page.getByTestId("menu-band-ai").locator("[data-nav-column] a").first();
  await first.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByTestId("menu-band-ai").locator("[data-nav-column] a").nth(1)).toBeFocused();
  await page.getByTestId("menu-band-engineering").getByRole("link", { name: /^Инженеринг за електронна търговия/ }).click();
  await expect(page).toHaveURL(/\/bg\/uslugi\/inzhenering-za-elektronna-targoviya$/);
  await expect(nav.getByRole("button", { name: "Услуги" })).toHaveAttribute("aria-expanded", "false");
});

test("mobile menu at 360px groups services and keeps keyboard focus inside", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/bg");
  const toggle = page.getByRole("button", { name: "Отвори менюто" });
  await toggle.click();
  const close = page.getByRole("button", { name: "Затвори менюто" });
  const panel = page.locator(`[id="${await close.getAttribute("aria-controls")}"]`);
  // Accordion groups in the header order; Services expands into the three bands.
  const services = panel.getByRole("button", { name: "Услуги" });
  await expect(services).toHaveAttribute("aria-expanded", "false");
  await services.click();
  await expect(services).toHaveAttribute("aria-expanded", "true");
  for (const band of ["AI системи", "Инженеринг и платформи", "Операции и консултации"]) {
    await expect(panel.getByText(band, { exact: true })).toBeVisible();
  }
  await expect(panel.getByRole("link", { name: "Разработка на AI агенти" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "DevOps, SRE и наблюдаемост" })).toBeVisible();
  await panel.getByRole("button", { name: "Компания" }).click();
  await expect(services).toHaveAttribute("aria-expanded", "false"); // one group at a time
  await expect(panel.getByRole("link", { name: "За основателя" })).toBeVisible();
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
