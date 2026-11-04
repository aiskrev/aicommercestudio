import { expect, test } from "@playwright/test";

const SERVICES = [
  ["business_websites", "/bg/uslugi/interaktivni-biznes-saytove", "/en/services/interactive-business-websites"],
  ["store_development", "/bg/uslugi/izrabotka-na-online-magazini", "/en/services/online-store-development"],
  ["portals_web_apps", "/bg/uslugi/klientski-portali-i-uebprilozheniya", "/en/services/customer-portals-and-web-applications"],
  ["payments_subscriptions", "/bg/uslugi/abonamenti-i-online-plashtaniya", "/en/services/subscription-and-payment-integration"],
  ["security_performance", "/bg/uslugi/zashtita-i-uskoryavane-na-saytove", "/en/services/website-security-and-performance"],
  ["integration_care", "/bg/uslugi/poddrazhka-na-integratsii-i-avtomatizatsii", "/en/services/integration-and-automation-care"],
] as const;

for (const [key, bg, en] of SERVICES) {
  test(`${key}: both languages, reciprocal hreflang, canonical, and the service reaches the form`, async ({ page, request }) => {
    for (const [path, other] of [[bg, en], [en, bg]] as const) {
      expect((await page.goto(path))?.status(), path).toBe(200);
      await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", new RegExp(`${path}$`));
      const lang = other.startsWith("/en") ? "en" : "bg";
      await expect(page.locator(`link[rel='alternate'][hreflang^='${lang}']`).first()).toHaveAttribute("href", new RegExp(`${other}$`));
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("main")).not.toContainText(/24\/7|€|лв\./);
    }
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(bg);
    expect(sitemap).toContain(en);

    await page.goto(`/bg/kontakti?usluga=${key}`);
    await expect(page.locator("select").first()).toHaveValue(key);
  });
}

test("care plans: five comparable plans, no invented terms, AI Managed Services linked and unchanged", async ({ page }) => {
  for (const [path, price] of [["/bg/paketi", "След оценка и индивидуална оферта"], ["/en/care-plans", "After an assessment and an individual quote"]] as const) {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.getByTestId("care-plans").locator("article")).toHaveCount(5);
    await expect(page.getByTestId("care-plans").getByText(price)).toHaveCount(5);
    await expect(page.getByTestId("ai-managed-tiers").locator("li")).toHaveText(["Essential Monitoring & Advisory", "Managed AI Operations", "Advanced AI Reliability & Optimization"]);
  }
  await page.goto("/bg/paketi");
  await page.getByTestId("care-plan-security").getByRole("link").click();
  await expect(page.locator("select").first()).toHaveValue("security_performance");
});

test("demo centre: every kind is labelled and free tools stay without sign-up", async ({ page }) => {
  for (const path of ["/bg/demo-tsentar", "/en/demo-centre"]) {
    expect((await page.goto(path))?.status()).toBe(200);
    for (const kind of ["demo", "tool", "service", "future"]) {
      await expect(page.getByTestId(`demo-section-${kind}`).getByTestId(`demo-kind-${kind}`).first()).toBeVisible();
    }
  }
  await page.goto("/bg/demo-tsentar");
  await page.getByTestId("demo-section-tool").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/bg\/(ai-automation-advisor|instrumenti)/);
  await expect(page.locator("input[type='password']")).toHaveCount(0);
});
