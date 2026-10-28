import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
/** Shared with the web container by scripts/test.ps1; regenerates the catalogue pages at once. */
const revalidateSecret = process.env.CATALOGUE_REVALIDATE_SECRET ?? "";
const COMMERCE_HUB = { bg: "/bg/uslugi/inzhenering-za-elektronna-targoviya", en: "/en/services/commerce-engineering" };

async function revalidateCatalogue(request: APIRequestContext) {
  const response = await request.post("/api/catalogue-revalidate", { headers: { "X-Revalidate-Secret": revalidateSecret } });
  expect(response.status()).toBe(200);
}

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/admin$/);
}

test.describe("public service catalogue API", () => {
  test("serves the published domains and services in both languages", async ({ request }) => {
    const bg = await (await request.get("/api/public/catalogue/domains")).json();
    expect(bg.total).toBe(10);
    expect(bg.items[0].key).toBe("ai_strategy");
    const en = await request.get("/api/public/catalogue/services/by-slug/seo-optimization?locale=en");
    expect(en.status()).toBe(200);
    expect(en.headers()["cache-control"]).toContain("max-age=60");
    const service = await en.json();
    expect(service.key).toBe("seo");
    expect(service.capabilities.length).toBeGreaterThan(0);
    const filtered = await request.get("/api/public/catalogue/services?domain=nope");
    expect(filtered.status()).toBe(422);
    expect((await filtered.json()).code).toBe("invalid_filter");
  });
});

test.describe("admin service catalogue", () => {
  test.skip(!email || !password, "ADMIN_BOOTSTRAP_EMAIL/PASSWORD not configured");

  test("create a draft, publish it, edit without publishing, archive", async ({ page, request }) => {
    test.setTimeout(150_000);
    const key = `e2e_workshop_${Date.now()}`;
    const slug = key.replace(/_/g, "-");
    await login(page);

    await page.getByRole("link", { name: "Каталог", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Каталог на услугите" })).toBeVisible();
    await expect(page.getByTestId("catalogue-table")).toContainText("DevOps, SRE и наблюдаемост");

    await page.getByRole("link", { name: "Нов запис" }).click();
    await page.getByLabel("Вид на записа").selectOption("workshop");
    await page.getByLabel("Ключ").fill(key);
    await page.getByLabel("Основно направление").selectOption("commerce_engineering");
    await page.getByLabel("Име (български)").fill("Е2Е работна среща за миграция");
    await page.getByLabel("Име (английски)").fill("E2E migration workshop");
    await page.getByRole("button", { name: "Създай чернова" }).click();
    await page.waitForURL(/\/admin\/catalogue\/[0-9a-f-]{36}$/);
    await expect(page.getByText("Чернова", { exact: true })).toBeVisible();

    // Drafts never reach the public API.
    expect((await request.get(`/api/public/catalogue/services/${key}`)).status()).toBe(404);

    const fill = async (texts: Record<string, string>) => {
      for (const [label, value] of Object.entries(texts)) await page.getByLabel(label, { exact: true }).fill(value);
    };
    await fill({
      "Адрес (slug)": `${slug}-bg`,
      "Кратко описание": "Половин ден с екипа ви преди смяна на платформата.",
      "Основен текст": "Преглеждаме пренасочванията, структурираните данни и проследяването преди превключването.",
      "SEO заглавие": "Работна среща за SEO миграция",
      "SEO описание": "Половиндневна работна среща, която подготвя пренасочванията, структурираните данни и проследяването за миграция на онлайн магазин.",
    });
    await page.getByTestId("items-deliverables").getByRole("button", { name: "Добави" }).click();
    await page.getByLabel("1. Резултат").fill("Карта на пренасочванията");

    await page.getByRole("tab", { name: /English/ }).click();
    await fill({
      "Адрес (slug)": slug,
      "Кратко описание": "Half a day with your team before a platform switch.",
      "Основен текст": "We review redirects, structured data and tracking before the cut-over.",
      "SEO заглавие": "SEO migration workshop",
      "SEO описание": "A half-day workshop that prepares redirects, structured data and tracking for an online store migration without losing visibility.",
    });
    await page.getByLabel("1. Резултат").fill("A redirect map");
    await page.getByLabel("Продължителност от (дни)").fill("0,5");
    await page.getByLabel("Продължителност до (дни)").fill("1");

    // Markup is rejected before anything is sent.
    await page.getByLabel("Кратко описание").fill("<b>Bold</b> claims");
    await expect(page.getByText("Използвайте само обикновен текст, без HTML или Markdown.").first()).toBeVisible();
    await page.getByLabel("Кратко описание").fill("Half a day with your team before a platform switch.");

    await page.getByRole("button", { name: "Запази чернова" }).click();
    await expect(page.getByText("Черновата е запазена.")).toBeVisible();
    await expect(page.getByTestId("editor-actions").getByRole("button", { name: "Публикувай" })).toBeEnabled();
    await page.getByRole("button", { name: "Публикувай" }).click();
    await expect(page.getByText("Записът е публикуван.")).toBeVisible();

    const published = await (await request.get(`/api/public/catalogue/services/${key}?locale=en`)).json();
    expect(published.offering_type).toBe("workshop");
    expect(published.summary).toBe("Half a day with your team before a platform switch.");
    expect(published.duration).toEqual({ min_days: 0.5, max_days: 1 });
    const related = await (await request.get("/api/public/catalogue/services/seo/related")).json();
    expect(related.related.workshops.map((w: { key: string }) => w.key)).toContain(key);

    // The public website shows the published workshop (pages regenerated on demand).
    if (revalidateSecret) {
      await revalidateCatalogue(request);
      const site = await page.context().browser()!.newPage();
      const bgPath = `/bg/uslugi/${slug}-bg`;
      const enPath = `/en/services/${slug}`;
      expect((await site.goto(bgPath))?.status()).toBe(200);
      await expect(site.getByRole("heading", { level: 1 })).toHaveText("Е2Е работна среща за миграция");
      await expect(site.getByTestId("offering-page")).toHaveAttribute("data-offering-type", "workshop");
      await expect(site.getByText("0,5–1").first()).toBeVisible();
      await expect(site.getByText("Карта на пренасочванията")).toBeVisible();
      await expect(site.getByRole("navigation", { name: "Навигационна пътека" }).getByRole("link", { name: "Инженеринг за електронна търговия" })).toBeVisible();
      expect(await site.locator("link[rel='canonical']").getAttribute("href")).toMatch(new RegExp(`${bgPath}$`));
      const alternates = await site.locator("link[rel='alternate'][hreflang]").evaluateAll((links) =>
        links.map((link) => `${link.getAttribute("hreflang")} ${new URL(link.getAttribute("href") ?? "").pathname}`),
      );
      expect(alternates).toEqual(expect.arrayContaining([`bg ${bgPath}`, `en ${enPath}`, `x-default ${bgPath}`]));
      const jsonLd = (await site.locator("script[type='application/ld+json']").allTextContents()).join(" ");
      expect(jsonLd).toContain('"@type":"Service"');

      // The language switcher follows the page's hreflang (the slug is not in the static map).
      await site.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
      await expect(site).toHaveURL(new RegExp(`${enPath}$`));
      await expect(site.getByRole("heading", { level: 1 })).toHaveText("E2E migration workshop");
      await expect(site.getByText("Half a day with your team before a platform switch.").first()).toBeVisible();

      // Cross-links: domain hub, the SEO service page (same domain), the index filter and the sitemap.
      await site.goto(COMMERCE_HUB.bg);
      await expect(site.getByTestId("catalogue-offerings").getByRole("link", { name: "Е2Е работна среща за миграция" })).toBeVisible();
      await site.goto("/bg/uslugi/seo-optimizatsiya");
      await expect(site.getByTestId("catalogue-offerings").getByRole("link", { name: "Е2Е работна среща за миграция" })).toBeVisible();
      await site.goto("/en/services");
      const browser = site.getByTestId("catalogue-browser");
      await browser.getByRole("button", { name: "Workshops" }).click();
      await expect(browser.getByRole("link", { name: "E2E migration workshop" })).toBeVisible();
      await expect(browser.getByRole("link", { name: "SEO", exact: false })).toHaveCount(0);
      const sitemap = await (await request.get("/sitemap.xml")).text();
      expect(sitemap).toContain(bgPath);
      expect(sitemap).toContain(enPath);
      await site.close();
    }

    // A saved edit stays private until it is published again.
    await page.getByLabel("Кратко описание").fill("An edited summary that is not published yet.");
    await page.getByRole("button", { name: "Запази чернова" }).click();
    await expect(page.getByText("Непубликувани промени")).toBeVisible();
    const live = await (await request.get(`/api/public/catalogue/services/${key}?locale=en`)).json();
    expect(live.summary).toBe("Half a day with your team before a platform switch.");

    // Unsaved changes: leaving asks first.
    await page.getByLabel("Кратко описание").fill("Typed but not saved");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "← Към каталога" }).click();
    await expect(page).toHaveURL(/\/admin\/catalogue\/[0-9a-f-]{36}$/);
    await page.getByLabel("Кратко описание").fill("An edited summary that is not published yet.");

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Архивирай" }).click();
    await expect(page.getByText("Записът е архивиран.")).toBeVisible();
    expect((await request.get(`/api/public/catalogue/services/${key}`)).status()).toBe(404);

    // Archived: the page is gone, the hub shows its empty state again and the sitemap drops it.
    if (revalidateSecret) {
      await revalidateCatalogue(request);
      expect((await request.get(`/bg/uslugi/${slug}-bg`)).status()).toBe(404);
      expect((await request.get(`/en/services/${slug}`)).status()).toBe(404);
      const sitemap = await (await request.get("/sitemap.xml")).text();
      expect(sitemap).not.toContain(slug);
      const hub = await (await request.get(COMMERCE_HUB.en)).text();
      expect(hub).not.toContain("E2E migration workshop");
    }
  });
});
