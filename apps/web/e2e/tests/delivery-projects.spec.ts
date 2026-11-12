import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { ADMIN_EMAIL, customer, seedProject, staff } from "./support/delivery";

// The customer's delivery projects (docs/COMMERCIAL_PROJECTS.md): staff create and move a project, the customer reads it
// and writes to the team, another customer and a signed-out visitor see nothing. Needs the legal e2e stack (customer
// accounts and COMMERCIAL_PROJECTS_ENABLED on, throwaway database, synthetic accounts): scripts/test-legal-e2e.ps1.
const legalStack = process.env.E2E_LEGAL_STACK === "1" && Boolean(process.env.E2E_ACCOUNT_PASSWORD);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("delivery projects with customer accounts on", () => {
  test.skip(!legalStack, "needs the legal e2e stack (scripts/test-legal-e2e.ps1)");
  test.describe.configure({ mode: "serial" });

  const title = `E2E проект ${Date.now()}`;
  const draftTitle = `E2E чернова ${Date.now()}`;
  let projectId = "";

  test("a signed-out visitor is sent to sign in, and the API answers 401", async ({ page, request }) => {
    expect((await request.get("/api/projects")).status()).toBe(401);
    await page.goto("/bg/konto/izrabotka");
    await page.waitForURL(/\/bg\/konto\/vhod/);
  });

  test("the customer sees the project staff moved to the quotation stage, never the draft or the internal note", async ({ browser }) => {
    const moved = await seedProject(browser, title, true);
    projectId = moved.project.id;
    await seedProject(browser, draftTitle, false);

    const page = await customer(browser, "shopper");
    await page.goto("/bg/konto/izrabotka");
    const list = page.getByTestId("projects-list");
    await expect(list).toContainText(title);
    await expect(list).not.toContainText(draftTitle);
    await page.getByRole("link", { name: title }).click();

    const detail = page.getByTestId("project-detail");
    await expect(detail).toContainText("Нов сайт за e2e проверка.");
    await expect(page.getByTestId("project-status")).toHaveText("Оферта");
    await expect(page.getByTestId("project-milestones")).toContainText("Дизайн");
    await expect(page.getByTestId("project-history")).toContainText("Започнахме подготовката.");
    await expect(detail).not.toContainText("Вътрешна бележка за екипа.");
    await expect(detail).not.toContainText(ADMIN_EMAIL);
    // Nothing to approve before the scope is awaiting approval.
    await expect(page.getByRole("button", { name: "Одобрявам обхвата" })).toHaveCount(0);
    // The page is private: never indexed, never cached.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  });

  test("the customer sends a support request and it appears in the history", async ({ browser }) => {
    const page = await customer(browser, "shopper");
    await page.goto(`/bg/konto/izrabotka?p=${projectId}`);
    await page.getByLabel("Съобщение").fill("Кога ще имаме първите макети?");
    await page.getByRole("button", { name: "Изпрати заявката" }).click();
    await expect(page.getByText("Заявката е изпратена.")).toBeVisible();
    await expect(page.getByTestId("project-history")).toContainText("Кога ще имаме първите макети?");
  });

  test("staff see the request and answer it; the customer reads the answer without the author's identity", async ({ browser }) => {
    const admin = await staff(browser);
    await admin.goto(`/admin/projects?id=${projectId}`);
    const manager = admin.getByTestId("project-manager");
    await expect(manager).toContainText("Кога ще имаме първите макети?");
    await manager.getByTestId("project-reply-form").getByLabel("Отговор", { exact: true }).first().fill("Първите макети ще получите тук.");
    await manager.getByRole("button", { name: "Изпрати отговор" }).click();
    await expect(admin.getByTestId("project-history")).toContainText("Първите макети ще получите тук.");

    const page = await customer(browser, "shopper");
    await page.goto(`/bg/konto/izrabotka?p=${projectId}`);
    const history = page.getByTestId("project-history");
    await expect(history).toContainText("Първите макети ще получите тук.");
    await expect(history).toContainText("Екипът");
    await expect(page.getByTestId("project-detail")).not.toContainText(ADMIN_EMAIL);
  });

  test("another customer sees no project and gets the same answer as for a project that does not exist", async ({ browser }) => {
    const other = await customer(browser, "layout");
    await other.goto("/bg/konto/izrabotka");
    await expect(other.getByTestId("projects-empty")).toBeVisible();
    await other.goto(`/bg/konto/izrabotka?p=${projectId}`);
    const foreign = await other.getByTestId("project-error").textContent();
    await other.goto("/bg/konto/izrabotka?p=00000000-0000-4000-8000-000000000000");
    expect(await other.getByTestId("project-error").textContent()).toBe(foreign);
    expect((await other.request.get(`/api/projects/${projectId}`)).status()).toBe(404);
  });

  test("the English page exists at /en/account/delivery", async ({ browser }) => {
    const page = await customer(browser, "shopper");
    await page.goto("/en/account/delivery");
    await expect(page.getByTestId("projects-list")).toContainText(title);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Delivery projects");
  });

  test("axe and no horizontal scroll on the list and the project at 360 px", async ({ browser }, testInfo) => {
    const page = await customer(browser, "shopper", { width: 360, height: 800 });
    for (const url of ["/bg/konto/izrabotka", `/bg/konto/izrabotka?p=${projectId}`]) {
      await page.goto(url);
      await expect(page.getByTestId(url.includes("?p=") ? "project-detail" : "projects-list")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      await testInfo.attach(`axe-${url.includes("?p=") ? "detail" : "list"}.json`, { body: JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))), contentType: "application/json" });
      expect(results.violations.map((v) => v.id)).toEqual([]);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
    }
  });

  test("the staff list shows both projects, with the draft marked as a draft", async ({ browser }) => {
    const admin = await staff(browser);
    await admin.goto("/admin/projects");
    const table = admin.getByTestId("projects-table");
    await expect(table).toContainText(title);
    await expect(table).toContainText(draftTitle);
    await expect(table.locator("tr", { hasText: draftTitle })).toContainText("Чернова");
  });

  test("staff see the delivery of the e-mail about the project, without an address or a text", async ({ browser }) => {
    const admin = await staff(browser);
    await admin.goto(`/admin/projects?id=${projectId}`);
    const table = admin.getByTestId("notifications-table");
    await expect(table).toContainText("Проектът е достъпен");
    await expect(table).toContainText("Обновление");
    await expect(table.locator("[data-status]").first()).toBeVisible();
    expect(await table.textContent()).not.toMatch(/@/);
  });
});
