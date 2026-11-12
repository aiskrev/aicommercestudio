import { type Browser, expect, type Page } from "@playwright/test";

// Shared by the delivery-project specs (legal e2e stack): a staff session, a synthetic customer session and a project
// that staff created and moved with the API.
export const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
export const OWNER = "shopper.legal-e2e@example.com";

export async function staff(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Имейл").fill(ADMIN_EMAIL);
  await page.getByLabel("Парола").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/admin$/);
  return page;
}

export async function staffCall(page: Page, method: "post" | "put" | "patch", path: string, data?: object) {
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === "acs_csrf")?.value ?? "";
  const response = await page.request[method](path, { data, headers: { "X-CSRF-Token": csrf } });
  expect(response.status(), await response.text()).toBeLessThan(300);
  return response.json();
}

export async function customer(browser: Browser, name: string, viewport = { width: 1280, height: 900 }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/bg/konto/vhod");
  await page.getByLabel("Имейл", { exact: true }).fill(`${name}.legal-e2e@example.com`);
  await page.getByLabel("Парола").fill(process.env.E2E_ACCOUNT_PASSWORD ?? "");
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/bg\/konto$/);
  return page;
}

/** An inquiry from the owner's own address, then a project on it created (and optionally moved) by staff. */
export async function seedProject(browser: Browser, title: string, move: boolean) {
  const admin = await staff(browser);
  const token = (await (await admin.request.get("/api/public/form-token")).json()).token as string;
  const sent = await admin.request.post("/api/public/quote-requests", {
    data: {
      service: "business_websites",
      name: "E2E Проекти",
      company: "Проектна фирма",
      email: OWNER,
      message: "Искаме оферта за нов бизнес сайт с форма за запитване.",
      privacy_acknowledged: true,
      marketing_consent: false,
      website: "",
      form_token: token,
      platform: "custom",
      budget_range: "2500_10000",
      timeline: "flexible",
    },
  });
  expect(sent.status(), await sent.text()).toBe(201);
  const reference = (await sent.json()).reference as string;
  const leads = (await (await admin.request.get("/api/admin/leads")).json()).items as { id: string; reference: string }[];
  const lead = leads.find((item) => item.reference === reference);
  expect(lead).toBeTruthy();
  let project = await staffCall(admin, "post", `/api/admin/leads/${lead!.id}/projects`, { account_email: OWNER, title, summary: "Нов сайт за e2e проверка." });
  if (move) {
    project = await staffCall(admin, "put", `/api/admin/projects/${project.id}/milestones`, {
      expected_revision: project.revision,
      milestones: [{ title: "Дизайн", description: "Макети на страниците", indicative_timing: "2 седмици", status: "in_progress" }],
    });
    project = await staffCall(admin, "post", `/api/admin/projects/${project.id}/transition`, { expected_revision: project.revision, to: "quotation" });
    project = await staffCall(admin, "post", `/api/admin/projects/${project.id}/events`, { kind: "update", visibility: "client", body: "Започнахме подготовката." });
    await staffCall(admin, "post", `/api/admin/projects/${project.id}/events`, { kind: "update", visibility: "internal", body: "Вътрешна бележка за екипа." });
  }
  return { admin, project: project as { id: string; reference: string; revision: number } };
}
