import { expect, test } from "@playwright/test";

async function sitemapPaths(request: import("@playwright/test").APIRequestContext): Promise<string[]> {
  const xml = await (await request.get("/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

test("every sitemap page has one H1, a unique title, description, canonical and valid JSON-LD", async ({ page, request }) => {
  test.setTimeout(180_000);
  const paths = await sitemapPaths(request);
  expect(paths.length).toBeGreaterThan(20);
  const titles = new Map<string, string>();

  for (const path of paths) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("h1"), path).toHaveCount(1);

    const title = await page.title();
    expect(titles.has(title), `duplicate title "${title}" on ${path} and ${titles.get(title)}`).toBe(false);
    titles.set(title, path);

    const description = await page.locator("meta[name='description']").getAttribute("content");
    expect(description?.length ?? 0, `${path} description`).toBeGreaterThanOrEqual(70);
    const canonical = await page.locator("link[rel='canonical']").getAttribute("href");
    expect(new URL(canonical!).pathname, `${path} canonical`).toBe(path);
    expect(await page.locator("meta[property='og:title']").count(), `${path} og:title`).toBe(1);

    const robots = await page.evaluate(() => document.querySelector("meta[name='robots']")?.getAttribute("content") ?? null);
    expect(robots ?? "", `${path} must be indexable`).not.toContain("noindex");

    for (const raw of await page.locator("script[type='application/ld+json']").allTextContents()) {
      const data = JSON.parse(raw);
      for (const node of Array.isArray(data) ? data : [data]) {
        expect(node["@context"], path).toBe("https://schema.org");
        expect(typeof node["@type"], path).toBe("string");
      }
    }
  }
});

test("draft legal pages and thin topic pages are noindex but reachable", async ({ page }) => {
  for (const path of ["/bg/poveritelnost", "/bg/biskvitki", "/bg/obshti-usloviya", "/bg/statii/tema/seo", "/en/privacy", "/en/insights/topic/seo"]) {
    expect((await page.goto(path))?.status(), path).toBe(200);
    await expect(page.locator("meta[name='robots']"), path).toHaveAttribute("content", /noindex/);
  }
});

test("article pages render key points, a contextual CTA and related links", async ({ page }) => {
  await page.goto("/bg/statii/shopify-ili-woocommerce");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Shopify или WooCommerce");
  await expect(page.getByRole("heading", { name: "Накратко" })).toBeVisible();
  await expect(page.locator("table")).toHaveCount(1);
  await expect(page.getByTestId("inline-cta")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Услуги по темата" })).toBeVisible();
  const jsonLd = (await page.locator("script[type='application/ld+json']").allTextContents()).join(" ");
  expect(jsonLd).toContain('"@type":"Article"');
  expect(jsonLd).toContain('"dateModified"');
});

test("case study pages do not exist until a verified case study is published", async ({ page }) => {
  expect((await page.goto("/bg/proekti"))?.status()).toBe(404);
  expect((await page.goto("/en/case-studies"))?.status()).toBe(404);
  expect((await page.goto("/bg/proekti/nyakakav-proekt"))?.status()).toBe(404);
});

test("quote CTAs open the quote form for the right service", async ({ page }) => {
  await page.goto("/bg/uslugi/seo-optimizatsiya");
  await page.getByRole("link", { name: "Поискай оферта" }).first().click();
  await expect(page).toHaveURL(/\/kontakti\?usluga=seo&tip=oferta/);
  await expect(page.getByRole("radio", { name: /Заявка за оферта/ })).toBeChecked();
  await expect(page.getByLabel(/Услуга/)).toHaveValue("seo");
});

test("message outline helper and inline validation", async ({ page }) => {
  await page.goto("/bg/kontakti");
  await page.getByRole("button", { name: "Попълни примерна структура" }).click();
  await expect(page.getByLabel(/Описание на проекта/)).toHaveValue(/Платформа и адрес на магазина/);
  await page.getByLabel(/^Имейл/).fill("not-an-email");
  await page.getByLabel(/^Имейл/).blur();
  await expect(page.getByText("Въведете валиден имейл адрес.")).toBeVisible();
});

test("navigation marks the current page", async ({ page }) => {
  await page.goto("/bg/proces");
  await expect(page.locator("header nav").first().getByRole("link", { name: "Процес" })).toHaveAttribute("aria-current", "page");
});
