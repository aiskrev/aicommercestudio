import { expect, type Page, test } from "@playwright/test";

/** Reference scenarios and integration patterns: labels, navigation, localisation, sitemap, accessibility basics. */

async function basics(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the scenario library lists 20 fictional scenarios by category in Bulgarian", async ({ page }) => {
  expect((await page.goto("/bg/referentni-stsenarii"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Референтни сценарии");
  await expect(page.getByTestId("fictional-notice")).toContainText("Всички сценарии са измислени");
  await expect(page.locator("[data-scenario]")).toHaveCount(20);
  const nav = page.getByTestId("scenario-categories");
  await expect(nav.getByRole("link")).toHaveCount(7);
  await nav.getByRole("link", { name: /Облак и платформа/ }).click();
  await expect(page).toHaveURL(/#cloud$/);
  await basics(page);
});

test("a scenario page has every section, a labelled diagram and contextual links, and switches language", async ({ page }) => {
  await page.goto("/bg/referentni-stsenarii/azure-osnovna-zona");
  await expect(page.getByTestId("fictional-label")).toContainText("Измислен сценарий");
  await expect(page.getByTestId("reference-diagram").locator("[data-stage]")).toHaveCount(4);
  await expect(page.getByTestId("scenario-interfaces").locator("tbody tr")).toHaveCount(3);
  for (const id of ["scenario-data-flow", "scenario-approvals", "scenario-phases", "scenario-patterns"]) {
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await page.getByTestId("scenario-patterns").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/bg\/integratsionni-modeli\/osnovna-zona-hub-spoke$/);
  await page.goto("/bg/referentni-stsenarii/azure-osnovna-zona");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/reference-scenarios\/azure-landing-zone$/);
  await expect(page.getByTestId("fictional-label")).toContainText("Fictional scenario");
  await basics(page);
});

test("the pattern catalogue is searchable and shows an honest status for every pattern", async ({ page }) => {
  await page.goto("/en/integration-patterns");
  await expect(page.getByTestId("pattern-status-notice")).toContainText("No pattern is a \"certified connector\"");
  await expect(page.getByTestId("status-legend").locator("[data-status]")).toHaveCount(5);
  const cards = page.getByTestId("pattern-cards").locator("[data-pattern]");
  await expect(cards).toHaveCount(11);
  await page.getByRole("searchbox", { name: "Search the patterns" }).fill("kubernetes");
  await expect(cards).toHaveCount(1);
  await expect(page.getByTestId("pattern-count")).toHaveText("1 of 11 patterns");
  await page.getByRole("searchbox", { name: "Search the patterns" }).fill("zzzz");
  await expect(page.getByText("No patterns match this search.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search the patterns" }).fill("");
  // Nothing claims to be a configured integration.
  await expect(page.getByTestId("pattern-cards").locator("[data-status=configured]")).toHaveCount(0);
  await basics(page);
});

test("a pattern page explains when not to use it, its failure modes and the scenarios that use it", async ({ page }) => {
  await page.goto("/en/integration-patterns/opentelemetry-collection");
  await expect(page.getByTestId("pattern-status").locator("[data-status]")).toHaveAttribute("data-status", "future");
  await expect(page.getByTestId("pattern-when-not").getByRole("listitem").first()).toBeVisible();
  await expect(page.getByTestId("pattern-failure-modes").locator("tbody tr")).toHaveCount(3);
  await expect(page.getByTestId("pattern-scenarios").getByRole("link").first()).toBeVisible();
  await basics(page);
});

test("reference pages are in the sitemap with both languages", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/bg/referentni-stsenarii", "/en/reference-scenarios/ci-cd-and-gitops", "/en/integration-patterns", "/bg/integratsionni-modeli/odobrenie-ot-chovek"]) {
    expect(sitemap, path).toContain(path);
  }
  expect((await request.get("/robots.txt").then((r) => r.text()))).toContain("Disallow: /portal");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("scenario and pattern pages fit the screen", async ({ page }) => {
    for (const path of ["/en/reference-scenarios", "/bg/referentni-stsenarii/potok-ot-danni", "/en/integration-patterns/human-approval-workflow"]) {
      await page.goto(path);
      await basics(page);
    }
  });
});
