import { expect, test } from "@playwright/test";

// Phase 15 (docs/SEO_IMPLEMENTATION.md, docs/ANALYTICS.md): what the commercial pages may and may not be indexed for, and a
// small page-weight budget for the new public pages. Runs on the default stack (every commercial feature flag off).
const PUBLIC_PAGES = [
  "/bg/tseni",
  "/bg/proektni-paketi",
  "/bg/demo-tsentar",
  "/bg/demo-tsentar/kvalifikatsiya-na-zapitvane",
  "/bg/demo-tsentar/odobrenie-ot-chovek",
];
/** Pages that must never be indexed: customer area, private projects, invoices, admin, portal, secret links, the basket. */
const PRIVATE_PREFIXES = ["/bg/konto", "/en/account", "/admin", "/portal", "/bg/oferta", "/en/quotation", "/bg/zayavka", "/en/quote-request", "/bg/konfigurator", "/en/configurator"];
const JS_BUDGET_BYTES = 520_000;

test("robots.txt keeps crawlers out of every private area and names the sitemap", async ({ request }) => {
  const text = await (await request.get("/robots.txt")).text();
  for (const path of ["/admin", "/portal", "/api/", "/bg/konto", "/en/account"]) expect(text, path).toContain(`Disallow: ${path}`);
  expect(text).toContain("Sitemap:");
});

test("the sitemap lists the public commercial pages and none of the private or switched-off ones", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/bg/proektni-paketi", "/bg/tseni", "/bg/demo-tsentar", "/bg/demo-tsentar/crm-avtomatizatsiya"]) expect(xml, path).toContain(path);
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  for (const location of locations) {
    expect(PRIVATE_PREFIXES.some((prefix) => location === prefix || location.startsWith(`${prefix}/`)), location).toBe(false);
  }
  // Every page of the sitemap has its other language at its own address (hreflang alternates).
  expect(xml).toContain('hreflang="en"');
});

test("each public commercial page has a canonical address, both hreflang alternates and no robots exclusion", async ({ page }) => {
  for (const path of PUBLIC_PAGES) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical, path).toContain(path);
    for (const hreflang of ["bg", "en", "x-default"]) await expect(page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`), `${path} ${hreflang}`).toHaveCount(1);
    expect(await page.locator('meta[name="robots"]').count(), path).toBe(0);
    await expect(page.locator("h1")).toHaveCount(1);
  }
});

test("private and switched-off pages are not found or carry noindex", async ({ page }) => {
  for (const path of ["/bg/konto", "/bg/konto/izrabotka", "/en/account/delivery", "/bg/oferta", "/bg/zayavka", "/bg/konfigurator"]) {
    const response = await page.goto(path);
    const status = response?.status() ?? 0;
    const noindex = (await page.locator('meta[name="robots"]').getAttribute("content").catch(() => null))?.includes("noindex") ?? false;
    const header = response?.headers()["x-robots-tag"]?.includes("noindex") ?? false;
    expect(status === 404 || noindex || header, `${path}: ${status}`).toBe(true);
  }
});

test("the new public pages load no third-party host and stay inside the script budget", async ({ page }) => {
  for (const path of PUBLIC_PAGES) {
    const hosts = new Set<string>();
    page.on("request", (request) => hosts.add(new URL(request.url()).host));
    await page.goto(path, { waitUntil: "networkidle" });
    const own = new URL(page.url()).host;
    expect([...hosts].filter((host) => host !== own), `third-party hosts on ${path}`).toEqual([]);
    const scripts = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => (entry as PerformanceResourceTiming).initiatorType === "script")
        .reduce((total, entry) => total + ((entry as PerformanceResourceTiming).encodedBodySize || 0), 0),
    );
    expect(scripts, `script bytes on ${path}`).toBeLessThan(JS_BUDGET_BYTES);
    page.removeAllListeners("request");
  }
});

test("funnel events reach the statistics only as names, never with an answer or a contact detail", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/public/analytics")) sent.push(request.postData() ?? "");
  });
  await page.goto("/bg/demo-tsentar/crm-avtomatizatsiya");
  await page.getByRole("button", { name: "Пуснете симулацията" }).click();
  await expect(page.getByTestId("demo-steps")).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.waitForTimeout(300);
  const body = sent.join(" ");
  expect(body).not.toMatch(/@|\d{6}|token|password/i);
});
