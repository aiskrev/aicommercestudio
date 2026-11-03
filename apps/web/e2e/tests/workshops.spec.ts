import { expect, type Page, test } from "@playwright/test";

/**
 * Workshops & Advisory catalogue (docs/CONTENT_STRATEGY_BG_EN.md §5.5): pages in both languages,
 * SEO basics, navigation entry points, the enquiry hand-off to the contact form, the engineering
 * topics without invented articles, and phone layouts.
 */

// The contact form's rate limit is per client address: this spec uses its own.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.97.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` } });

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function seoBasics(page: Page, path: string, other: string) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  expect(await page.locator("link[rel='canonical']").getAttribute("href")).toMatch(new RegExp(`${path}$`));
  const alternates = await page.locator("link[rel='alternate'][hreflang]").evaluateAll((links) =>
    links.map((l) => `${l.getAttribute("hreflang")} ${new URL(l.getAttribute("href")!).pathname}`),
  );
  expect(alternates).toEqual(expect.arrayContaining([expect.stringMatching(new RegExp(` ${path}$`)), expect.stringMatching(new RegExp(` ${other}$`))]));
  const ld = await page.locator("script[type='application/ld+json']").allTextContents();
  const blob = ld.join("\n");
  expect(blob).not.toMatch(/"offers"|"price"|"aggregateRating"/);
}

test("the Bulgarian catalogue lists ten offers by group and states that nothing is priced", async ({ page }) => {
  expect((await page.goto("/bg/rabotni-sreshti"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Работни срещи и консултантски оценки");
  await expect(page.getByTestId("workshops-notice")).toContainText("Не публикуваме цени");
  await expect(page.locator("[data-workshop]")).toHaveCount(10);
  // Grouped by the band of each offer's primary domain: AI, and engineering (observability's primary
  // domain is DevOps/SRE); the operations band has no offer of its own, so it is not listed.
  await expect(page.getByTestId("workshop-bands").getByRole("link")).toHaveCount(2);
  await expect(page.locator("main")).not.toContainText(/€|лв\.|BGN|гарантира/);
  await seoBasics(page, "/bg/rabotni-sreshti", "/en/workshops");
  await noOverflow(page);
});

test("an offer page has every section, related links and an enquiry that pre-fills the contact form", async ({ page }) => {
  await page.goto("/en/workshops/kubernetes-platform-review");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kubernetes Platform Review");
  for (const id of ["workshop-audience", "workshop-problems", "workshop-prerequisites", "workshop-format", "workshop-agenda", "workshop-deliverables", "workshop-limitations", "workshop-services", "workshop-assessments", "workshop-scenarios", "workshop-patterns", "workshop-insights"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("workshop-notice")).toContainText("We do not guarantee specific outcomes");
  // No article exists for this topic yet, and none is invented.
  await expect(page.getByTestId("workshop-insights")).toContainText("No articles on this topic have been published yet.");
  await seoBasics(page, "/en/workshops/kubernetes-platform-review", "/bg/rabotni-sreshti/pregled-na-kubernetes-platforma");

  await page.getByTestId("workshop-enquiry").click();
  await expect(page).toHaveURL(/\/en\/contact\?service=integrations&workshop=kubernetes_review$/);
  await expect(page.getByTestId("contact-workshop")).toContainText("Enquiry about: Kubernetes Platform Review");
});

test("an enquiry about a workshop is stored with it", async ({ page }) => {
  await page.goto("/bg/kontakti?usluga=audit&sreshta=ai_strategy_discovery");
  await expect(page.getByTestId("contact-workshop")).toContainText("Работна среща за AI стратегия");
  await page.getByLabel(/Име и фамилия/).fill("E2E Работна Среща");
  await page.getByLabel(/^Фирма/).fill(`E2E Среща ${Date.now()}`);
  await page.getByLabel(/^Имейл/).fill("e2e.workshop@example.com");
  await page.getByLabel(/Описание на проекта/).fill("Автоматизиран E2E тест: искаме работна среща за AI стратегия за екипа.");
  await page.getByRole("checkbox", { name: /информацията за поверителност/ }).check();
  await page.waitForTimeout(3500); // the anti-bot timing check
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith("/api/public/leads") && r.method() === "POST"),
    page.getByRole("button", { name: "Изпрати запитването" }).click(),
  ]);
  expect(JSON.parse(request.postData() ?? "{}").workshop).toBe("ai_strategy_discovery");
  await expect(page.getByTestId("contact-success")).toBeVisible();
});

test("the catalogue is reachable from navigation, hubs, service pages and industries", async ({ page }) => {
  await page.goto("/bg");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Работни срещи и консултантски оценки" })).toHaveAttribute("href", "/bg/rabotni-sreshti");
  await page.setViewportSize({ width: 1280, height: 800 });
  const services = page.locator("header nav").first().getByRole("button", { name: "Услуги" });
  await services.click();
  const panel = page.locator(`[id="${await services.getAttribute("aria-controls")}"]`);
  await expect(panel.getByTestId("menu-start-here").getByRole("link", { name: /Работни срещи и консултантски оценки/ })).toHaveAttribute("href", "/bg/rabotni-sreshti");
  // Industries list up to two offers per segment.
  await page.goto("/bg/za-kogo");
  await expect(page.getByTestId("industry-workshops").first().getByRole("link").first()).toHaveAttribute("href", /^\/bg\/rabotni-sreshti\//);
  // Domain hubs list the offers of their domain (every domain has at least one).
  await page.goto("/bg/uslugi");
  const hubs = await page.locator("a[href^='/bg/uslugi/']").evaluateAll((links) => [...new Set(links.map((l) => l.getAttribute("href")!))]);
  let found = false;
  for (const href of hubs) {
    await page.goto(href);
    if ((await page.getByTestId("domain-workshops").count()) > 0) {
      await expect(page.getByTestId("domain-workshops").locator("[data-workshop]").first()).toBeVisible();
      found = true;
      break;
    }
  }
  expect(found).toBe(true);
});

test("the engineering topics exist without invented articles and point to workshops", async ({ page }) => {
  expect((await page.goto("/en/insights/topic/devops-and-sre"))?.status()).toBe(200);
  await expect(page.getByText("There are no published articles on this topic yet.")).toBeVisible();
  await expect(page.locator("meta[name='robots']")).toHaveAttribute("content", /noindex/);
  await expect(page.getByTestId("topic-workshops").locator("[data-workshop]").first()).toBeVisible();
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/en/insights/topic/devops-and-sre");
  expect(sitemap).toContain("/en/workshops/kubernetes-platform-review");
  expect(sitemap).toContain("/bg/rabotni-sreshti/pregled-na-kubernetes-platforma");
});

test("the language switch keeps the offer, and pages fit a phone", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/bg/rabotni-sreshti/otsenka-na-oblachna-osnovna-zona");
  await noOverflow(page);
  await page.goto("/en/workshops");
  await noOverflow(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/bg/rabotni-sreshti/otsenka-na-oblachna-osnovna-zona");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/workshops\/cloud-landing-zone-assessment$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cloud Landing Zone Assessment");
});
