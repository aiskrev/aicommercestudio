import { expect, type Page, test } from "@playwright/test";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";

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
  });
});
