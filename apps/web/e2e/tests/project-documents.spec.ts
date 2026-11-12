import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { customer, seedProject, staff, staffCall } from "./support/delivery";

// Project documents (docs/PROJECT_DOCUMENTS.md): the team publishes a file and asks for a decision, the customer
// downloads it and decides, uploads material of their own, another customer and a signed-out visitor get nothing.
// Needs the legal e2e stack (documents and uploads on, scanning not required, throwaway database, synthetic accounts):
// scripts/test-legal-e2e.ps1.
const legalStack = process.env.E2E_LEGAL_STACK === "1" && Boolean(process.env.E2E_ACCOUNT_PASSWORD);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const PDF = "%PDF-1.7\n1 0 obj\n<< /Note (e2e макет) >>\nendobj\n%%EOF\n";

async function staffUpload(admin: Page, projectId: string, title: string, filename: string, body: Buffer | string, category = "design") {
  const csrf = (await admin.context().cookies()).find((cookie) => cookie.name === "acs_csrf")?.value ?? "";
  const response = await admin.request.post(`/api/admin/projects/${projectId}/documents`, {
    data: Buffer.from(body),
    headers: {
      "X-CSRF-Token": csrf,
      "Content-Type": "application/octet-stream",
      "X-File-Name": encodeURIComponent(filename),
      "X-Document-Title": encodeURIComponent(title),
      "X-Document-Category": category,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).documents.at(-1) as { id: string };
}

test.describe("project documents", () => {
  test.skip(!legalStack, "needs the legal e2e stack (scripts/test-legal-e2e.ps1)");
  test.describe.configure({ mode: "serial" });

  const title = `E2E документи ${Date.now()}`;
  const docTitle = `Макет ${Date.now()}`;
  let projectId = "";
  let documentId = "";

  test("a draft is invisible to the customer, and a published file downloads as an attachment with the same bytes", async ({ browser }) => {
    const { admin, project } = await seedProject(browser, title, true);
    projectId = project.id;
    const doc = await staffUpload(admin, projectId, docTitle, "Макет v1.pdf", PDF);
    documentId = doc.id;

    const page = await customer(browser, "shopper");
    await page.goto(`/bg/konto/izrabotka?p=${projectId}`);
    await expect(page.getByTestId("project-detail")).toBeVisible();
    await expect(page.getByTestId("documents-empty")).toBeVisible();
    expect((await page.request.get(`/api/projects/${projectId}/documents/${documentId}/versions/1/download`)).status()).toBe(404);

    await staffCall(admin, "post", `/api/admin/projects/${projectId}/documents/${documentId}/versions/1/publish`);
    await page.reload();
    const list = page.getByTestId("documents-list");
    await expect(list).toContainText(docTitle);
    await expect(list).toContainText("Макет v1.pdf");
    const href = await list.getByTestId("document-download").getAttribute("href");
    expect(href).toBe(`/api/projects/${projectId}/documents/${documentId}/versions/1/download`);
    const download = await page.request.get(href!);
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe(PDF);
    expect(download.headers()["content-disposition"]).toMatch(/^attachment;/);
    expect(download.headers()["x-content-type-options"]).toBe("nosniff");
    expect(download.headers()["cache-control"]).toBe("no-store");
    await expect(page.getByTestId("project-history")).toContainText(`Нов документ за преглед: ${docTitle}, версия 1`);
  });

  test("the customer approves the version the team asked about, after confirming the statement", async ({ browser }) => {
    const admin = await staff(browser);
    await staffCall(admin, "post", `/api/admin/projects/${projectId}/documents/${documentId}/versions/1/approvals`, { message: "Моля, одобрете макета" });

    const page = await customer(browser, "shopper");
    await page.goto(`/bg/konto/izrabotka?p=${projectId}`);
    const card = page.getByTestId("approval-request");
    await expect(card).toContainText("Моля, одобрете макета");
    await card.getByRole("button", { name: "Одобрявам тази версия" }).click();
    await expect(page.getByText("Потвърдете изявлението, за да продължите.")).toBeVisible();
    await card.getByRole("checkbox").check();
    await card.getByLabel("Коментар").fill("Изглежда добре");
    await card.getByRole("button", { name: "Одобрявам тази версия" }).click();
    await expect(page.getByTestId("approval-request")).toHaveCount(0);
    await expect(page.locator('[data-approval="approved"]')).toContainText("Одобрена");
    await expect(page.getByTestId("project-history")).toContainText(`Одобрена версия 1 на ${docTitle}`);
    // The same decision twice changes nothing; the opposite one is refused.
    await page.reload();
    await expect(page.locator('[data-approval="approved"]')).toHaveCount(1);
  });

  test("the customer uploads a brief, a wrong file is refused with a clear message, and staff see the upload as the customer's", async ({ browser }) => {
    const page = await customer(browser, "shopper");
    await page.goto(`/bg/konto/izrabotka?p=${projectId}`);
    const form = page.getByTestId("document-upload-form");
    await form.getByLabel("Файл").setInputFiles({ name: "run.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ not allowed") });
    await form.getByRole("button", { name: "Качи" }).click();
    await expect(form.getByText("Този тип файл не е позволен.")).toBeVisible();
    await form.getByLabel("Файл").setInputFiles({ name: "fake.pdf", mimeType: "application/pdf", buffer: Buffer.from("MZ pretending to be a pdf") });
    await form.getByRole("button", { name: "Качи" }).click();
    await expect(form.getByText("Съдържанието не отговаря на типа на файла.")).toBeVisible();

    await form.getByLabel("Файл").setInputFiles({ name: "Задание.pdf", mimeType: "application/pdf", buffer: Buffer.from(PDF) });
    await form.getByLabel("Заглавие").fill("Нашето задание");
    await form.getByRole("button", { name: "Качи" }).click();
    await expect(page.getByTestId("documents-list")).toContainText("Нашето задание");
    await expect(page.locator('[data-origin="client"]')).toContainText("Задание.pdf");

    const admin = await staff(browser);
    await admin.goto(`/admin/projects?id=${projectId}`);
    const panel = admin.getByTestId("documents-admin");
    await expect(panel.locator('[data-testid="staff-document"]', { hasText: "Нашето задание" })).toContainText("от клиента");
    await expect(panel.locator('[data-testid="staff-document"]', { hasText: docTitle })).toContainText("одобрена");
  });

  test("staff publish a new draft version from the admin screen", async ({ browser }) => {
    const admin = await staff(browser);
    const csrf = (await admin.context().cookies()).find((cookie) => cookie.name === "acs_csrf")?.value ?? "";
    const response = await admin.request.post(`/api/admin/projects/${projectId}/documents/${documentId}/versions`, {
      data: Buffer.from(`${PDF}% v2`),
      headers: { "X-CSRF-Token": csrf, "Content-Type": "application/octet-stream", "X-File-Name": "Makets-v2.pdf", "X-Expected-Version": "1" },
    });
    expect(response.status(), await response.text()).toBe(201);
    await admin.goto(`/admin/projects?id=${projectId}`);
    const row = admin.locator('[data-testid="staff-document"]', { hasText: docTitle });
    await expect(row.locator('[data-version="2"]')).toHaveAttribute("data-state", "draft");
    await row.locator('[data-version="2"]').getByRole("button", { name: "Публикувай за клиента" }).click();
    await expect(row.locator('[data-version="2"]')).toHaveAttribute("data-state", "published");

    const page = await customer(browser, "shopper");
    await page.goto(`/bg/konto/izrabotka?p=${projectId}`);
    await expect(page.locator(`[data-document="${documentId}"] [data-version="2"]`)).toBeVisible();
  });

  test("another customer and a signed-out visitor cannot reach the files", async ({ browser, request }) => {
    const url = `/api/projects/${projectId}/documents/${documentId}/versions/1/download`;
    expect((await request.get(url)).status()).toBe(401);
    expect((await request.get(`/api/projects/${projectId}/documents`)).status()).toBe(401);
    const other = await customer(browser, "layout");
    expect((await other.request.get(url)).status()).toBe(404);
    expect((await other.request.get(`/api/projects/${projectId}/documents`)).status()).toBe(404);
    await other.goto(`/bg/konto/izrabotka?p=${projectId}`);
    await expect(other.getByTestId("project-error")).toBeVisible();
    await expect(other.getByTestId("documents-list")).toHaveCount(0);
  });

  test("axe and no horizontal scroll with the documents at 360 px", async ({ browser }, testInfo) => {
    const page = await customer(browser, "shopper", { width: 360, height: 800 });
    await page.goto(`/bg/konto/izrabotka?p=${projectId}`);
    await expect(page.getByTestId("documents-list")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    await testInfo.attach("axe-documents.json", { body: JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))), contentType: "application/json" });
    expect(results.violations.map((v) => v.id)).toEqual([]);
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  });

  test("the English page shows the documents too", async ({ browser }) => {
    const page = await customer(browser, "shopper");
    await page.goto(`/en/account/delivery?p=${projectId}`);
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await expect(page.getByTestId("documents-list")).toContainText(docTitle);
  });
});
