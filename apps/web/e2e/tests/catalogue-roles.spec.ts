import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * Role-based admin flows. scripts/test.ps1 creates e2e.editor@example.com and e2e.viewer@example.com
 * with a per-run password (E2E_STAFF_PASSWORD) before the suite starts.
 */
const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const staffPassword = process.env.E2E_STAFF_PASSWORD ?? "";
const EDITOR = "e2e.editor@example.com";
const VIEWER = "e2e.viewer@example.com";

test.describe.configure({ mode: "serial" });
test.skip(!adminEmail || !adminPassword || !staffPassword, "admin and E2E_STAFF_PASSWORD credentials are required");

async function loginAs(browser: Browser, email: string, password: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/admin(\/catalogue)?$/);
  return page;
}

async function csrf(page: Page): Promise<string> {
  return (await page.context().cookies()).find((cookie) => cookie.name === "acs_csrf")?.value ?? "";
}

let draftUrl = "";
const draftKey = `e2e_editor_draft_${Date.now()}`;

test("an editor writes drafts but cannot publish or reach leads", async ({ browser }) => {
  const page = await loginAs(browser, EDITOR, staffPassword);
  await page.waitForURL(/\/admin\/catalogue$/); // the dashboard sends non-admins to the catalogue
  const nav = page.getByRole("navigation", { name: "Администрация" });
  await expect(nav.getByRole("link", { name: "Каталог", exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Запитвания" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Персонал и роли" })).toHaveCount(0);

  await page.getByRole("link", { name: "Нов запис" }).click();
  await page.getByLabel("Вид на записа").selectOption("assessment");
  await page.getByLabel("Ключ").fill(draftKey);
  await page.getByLabel("Основно направление").selectOption("advisory_enablement");
  await page.getByLabel("Име (български)").fill("Е2Е чернова на редактор");
  await page.getByLabel("Име (английски)").fill("E2E editor draft");
  await page.getByRole("button", { name: "Създай чернова" }).click();
  await page.waitForURL(/\/admin\/catalogue\/[0-9a-f-]{36}$/);
  draftUrl = page.url();

  const actions = page.getByTestId("editor-actions");
  await expect(actions.getByRole("button", { name: "Публикувай" })).toHaveCount(0);
  await expect(actions.getByRole("button", { name: "Изтрий черновата" })).toHaveCount(0);
  await page.getByLabel("Кратко описание").fill("Чернова, записана от редактор.");
  await page.getByRole("button", { name: "Запази чернова" }).click();
  await expect(page.getByText("Черновата е запазена.")).toBeVisible();

  // The API refuses what the UI hides.
  const id = draftUrl.split("/").pop();
  const publish = await page.request.post(`/api/admin/catalogue/entities/${id}/publish`, {
    headers: { "X-CSRF-Token": await csrf(page), "If-Match": '"2"' },
  });
  expect(publish.status()).toBe(403);
  expect((await publish.json()).code).toBe("forbidden_role");
  await page.goto("/admin/leads");
  await expect(page.getByText("Ролята ви не позволява това действие.").first()).toBeVisible();
  await page.context().close();
});

test("a viewer reads the catalogue without write controls", async ({ browser }) => {
  test.skip(!draftUrl, "depends on the editor test");
  const page = await loginAs(browser, VIEWER, staffPassword);
  await page.waitForURL(/\/admin\/catalogue$/);
  await expect(page.getByTestId("catalogue-table")).toBeVisible();
  await expect(page.getByRole("link", { name: "Нов запис" })).toHaveCount(0);
  await page.goto(draftUrl);
  await expect(page.getByText("Ролята ви позволява да разглеждате записа, но не и да го променяте.")).toBeVisible();
  await expect(page.getByLabel("Име", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Запази чернова" })).toHaveCount(0);
  await page.context().close();
});

test("an administrator changes roles and deletes the never-published draft", async ({ browser }) => {
  test.skip(!draftUrl, "depends on the editor test");
  const page = await loginAs(browser, adminEmail, adminPassword);
  await page.getByRole("link", { name: "Персонал и роли" }).click();
  const table = page.getByTestId("staff-table");
  const viewerRow = table.getByRole("row").filter({ hasText: VIEWER });
  await expect(table.getByRole("row").filter({ hasText: EDITOR })).toBeVisible();
  await viewerRow.getByRole("combobox").selectOption("editor");
  await viewerRow.getByRole("button", { name: "Запази ролята" }).click();
  await expect(page.getByRole("status")).toContainText("Ролята на");
  await viewerRow.getByRole("combobox").selectOption("viewer");
  await viewerRow.getByRole("button", { name: "Запази ролята" }).click();
  await expect(viewerRow.getByRole("combobox")).toHaveValue("viewer");
  await expect(table.getByRole("row").filter({ hasText: adminEmail }).getByRole("combobox")).toBeDisabled();

  await page.goto(draftUrl);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Изтрий черновата" }).click();
  await page.waitForURL(/\/admin\/catalogue$/);
  const id = draftUrl.split("/").pop();
  expect((await page.request.get(`/api/admin/catalogue/entities/${id}`)).status()).toBe(404);
  expect((await page.request.get(`/api/public/catalogue/services/${draftKey}`)).status()).toBe(404);
  await page.context().close();
});
