import { expect, test } from "@playwright/test";

/**
 * Service discovery on the public site: the catalogue index, the assessments-and-workshops block on
 * the domain hubs, the managed-operations relation on build services and the catalogue routing rules.
 * The publish → page → archive lifecycle of a catalogue-only entry is covered in catalogue.spec.ts.
 */
const CYRILLIC = /[Ѐ-ӿ]/;

for (const l of [
  { locale: "bg", index: "/bg/uslugi", title: "Целият каталог", domain: "Направление", count: /Показани записи: \d+/ },
  { locale: "en", index: "/en/services", title: "The full catalogue", domain: "Domain", count: /Entries shown: \d+/ },
] as const) {
  test(`services index lists the catalogue and filters it by domain (${l.locale})`, async ({ page }) => {
    await page.goto(l.index);
    const section = page.locator("section", { has: page.getByRole("heading", { level: 2, name: l.title }) });
    const browser = section.getByTestId("catalogue-browser");
    const count = browser.getByTestId("catalogue-count");
    await expect(count).toHaveText(l.count);
    const total = Number((await count.innerText()).match(/\d+/)![0]);
    expect(total).toBeGreaterThanOrEqual(9); // the nine existing services, plus any published assessments and workshops
    await expect(browser.getByTestId("offering-card")).toHaveCount(total);

    // Keyboard: the domain filter is a labelled native select.
    const select = browser.getByLabel(l.domain);
    await select.focus();
    await expect(select).toBeFocused();
    await select.selectOption("commerce_engineering");
    const filtered = Number((await count.innerText()).match(/\d+/)![0]);
    expect(filtered).toBeGreaterThanOrEqual(3);
    expect(filtered).toBeLessThan(total);
    await expect(browser.getByTestId("offering-card")).toHaveCount(filtered);
    await browser.getByTestId("offering-card").first().getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`^.*/${l.locale === "bg" ? "bg/uslugi" : "en/services"}/[a-z0-9-]+$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (l.locale === "en") expect(await page.locator("main").innerText()).not.toMatch(CYRILLIC);
  });
}

test("a domain hub states plainly when no assessment or workshop is published", async ({ page }) => {
  await page.goto("/bg/uslugi/devops-sre-i-nablyudaemost");
  const block = page.getByTestId("catalogue-offerings");
  await expect(block.getByRole("heading", { level: 2, name: "Оценки и работни срещи" })).toBeVisible();
  await expect(block.getByTestId("offerings-empty")).toContainText("все още няма публикувани оценки или работни срещи");
  const contact = block.getByRole("link", { name: "Заявете разговор" });
  await expect(contact).toHaveAttribute("href", /^\/bg\/kontakti\?usluga=[a-z_]+$/);
  await contact.click();
  await expect(page).toHaveURL(/\/bg\/kontakti\?usluga=/);
  await expect(page.locator("form").first()).toBeVisible();
});

test("a build service links to the managed operation of what it builds", async ({ page }) => {
  await page.goto("/en/services/seo-optimization");
  const panel = page.getByTestId("managed-relation");
  await expect(panel.getByRole("heading", { level: 2, name: "After launch: ongoing operation" })).toBeVisible();
  await panel.getByRole("link", { name: "AI Managed Services" }).click();
  await expect(page).toHaveURL(/\/en\/services\/ai-managed-services$/);
  // The managed service page does not point to itself.
  await expect(page.getByTestId("managed-relation")).toHaveCount(0);
});

test("unknown or malformed catalogue slugs are 404, existing pages keep their URLs", async ({ request }) => {
  for (const path of ["/bg/uslugi/nyama-takava-usluga", "/en/services/no-such-service", "/bg/uslugi/Not_A_Slug"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
  for (const path of ["/bg/uslugi", "/en/services", "/bg/uslugi/seo-optimizatsiya", "/en/services/ai-managed-services", "/bg/uslugi/tehnicheski-odit"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
});

test("the revalidation endpoint accepts only POST with the shared secret", async ({ request }) => {
  expect((await request.get("/api/catalogue-revalidate")).status()).toBe(405);
  const wrong = await request.post("/api/catalogue-revalidate", { headers: { "X-Revalidate-Secret": "not-the-secret-value" } });
  // 401 when the endpoint is enabled, 404 when the stack runs without CATALOGUE_REVALIDATE_SECRET.
  expect([401, 404]).toContain(wrong.status());
  expect(wrong.headers()["cache-control"]).toBe("no-store");
});

test("the catalogue pages fit a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of ["/bg/uslugi", "/en/services", "/bg/uslugi/devops-sre-i-nablyudaemost", "/en/services/seo-optimization"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
  }
});
