import { expect, test } from "@playwright/test";

/** BG slug → EN slug of the ten domain hubs (docs/SERVICE_TAXONOMY.md §2). */
const HUBS: [string, string][] = [
  ["ai-strategiya-i-transformatsiya", "ai-strategy-and-transformation"],
  ["ai-agenti-i-biznes-avtomatizatsiya", "ai-agents-and-business-automation"],
  ["ai-prilozheniya-i-sistemi-za-znaniya", "ai-applications-and-knowledge-systems"],
  ["inzhenering-za-elektronna-targoviya", "commerce-engineering"],
  ["oblachen-i-platformen-inzhenering", "cloud-and-platform-engineering"],
  ["devops-sre-i-nablyudaemost", "devops-sre-and-observability"],
  ["inzhenering-na-danni-i-integratsii", "data-and-integration-engineering"],
  ["ai-upravlenie-sigurnost-i-nadezhdnost", "ai-governance-security-and-assurance"],
  ["upravlyavani-ai-i-platformeni-operatsii", "managed-ai-and-platform-operations"],
  ["konsultatsii-otsenki-i-obuchenie", "advisory-assessments-and-enablement"],
];

test.describe("domain hubs", () => {
  test("every hub renders in both languages with canonical, hreflang and Service JSON-LD", async ({ page }) => {
    const titles = new Set<string>();
    for (const [bg, en] of HUBS) {
      for (const [path, other] of [
        [`/bg/uslugi/${bg}`, `/en/services/${en}`],
        [`/en/services/${en}`, `/bg/uslugi/${bg}`],
      ]) {
        const response = await page.goto(path);
        expect(response?.status(), path).toBe(200);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        titles.add(await page.title());
        expect(await page.locator("link[rel='canonical']").getAttribute("href")).toMatch(new RegExp(`${path}$`));
        const alternates = await page.locator("link[rel='alternate'][hreflang]").evaluateAll((links) =>
          links.map((l) => new URL(l.getAttribute("href") ?? "").pathname),
        );
        expect(alternates, path).toContain(other);
        const jsonLd = (await page.locator("script[type='application/ld+json']").allTextContents()).join(" ");
        expect(jsonLd).toContain('"@type":"Service"');
        expect(jsonLd).toContain('"@type":"BreadcrumbList"');
        expect(jsonLd).not.toMatch(/"offers"|"aggregateRating"|"review"/);
      }
    }
    expect(titles.size).toBe(HUBS.length * 2);
  });

  test("a hub shows statuses, links its services and pre-selects the contact form", async ({ page }) => {
    await page.goto("/bg/uslugi/ai-agenti-i-biznes-avtomatizatsiya");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI агенти и бизнес автоматизация");
    await expect(page.getByText("Налично").first()).toBeVisible();
    const families = page.locator("section[aria-labelledby='domain-families-title']");
    await expect(families.getByRole("link", { name: "Разработка на AI агенти" }).first()).toHaveAttribute(
      "href",
      "/bg/uslugi/razrabotka-na-ai-agenti",
    );
    await page.getByRole("link", { name: "Опишете процеса за автоматизация" }).first().click();
    await expect(page).toHaveURL(/\/bg\/kontakti\?usluga=automation$/);
  });

  test("a planned family is labelled with its prerequisite", async ({ page }) => {
    await page.goto("/en/services/managed-ai-and-platform-operations");
    const families = page.locator("section[aria-labelledby='domain-families-title']");
    await expect(families.getByText("Planned")).toBeVisible();
    await expect(families.getByText(/Prerequisite:/)).toBeVisible();
  });

  test("the language switcher moves between paired hubs", async ({ page }) => {
    await page.goto("/bg/uslugi/devops-sre-i-nablyudaemost");
    await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
    await expect(page).toHaveURL(/\/en\/services\/devops-sre-and-observability$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("DevOps, SRE & Observability");
  });

  test("the services index groups the domains into three bands", async ({ page }) => {
    await page.goto("/en/services");
    for (const band of ["AI systems", "Engineering and platforms", "Operations and advisory"]) {
      await expect(page.getByRole("heading", { level: 3, name: band, exact: true })).toBeVisible();
    }
    const domains = page.locator("section[aria-labelledby='services-domains-title']");
    await expect(domains.getByRole("heading", { level: 4 })).toHaveCount(10);
    await domains.getByRole("link", { name: "Commerce Engineering" }).click();
    await expect(page).toHaveURL(/\/en\/services\/commerce-engineering$/);
  });

  test("service pages show their primary domain in the breadcrumb", async ({ page }) => {
    for (const [path, domain] of [
      ["/bg/uslugi/seo-optimizatsiya", "Инженеринг за електронна търговия"],
      ["/en/services/ai-managed-services", "Managed AI & Platform Operations"],
    ]) {
      await page.goto(path);
      const crumbs = page.getByRole("navigation", { name: /Breadcrumb|Навигационна пътека|Път/i });
      await expect(crumbs.getByRole("link", { name: domain })).toBeVisible();
    }
  });

  test("hubs are in the sitemap", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const [bg, en] of HUBS) {
      expect(xml).toContain(`/bg/uslugi/${bg}`);
      expect(xml).toContain(`/en/services/${en}`);
    }
  });

  test("hubs fit the mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    for (const path of ["/bg/uslugi", "/bg/uslugi/ai-upravlenie-sigurnost-i-nadezhdnost", "/en/services/data-and-integration-engineering"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
});
