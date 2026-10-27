import { type APIRequestContext, expect, test } from "@playwright/test";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";

async function createLead(request: APIRequestContext, company: string) {
  const { token } = await (await request.get("/api/public/form-token")).json();
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const response = await request.post("/api/public/leads", {
    data: {
      service: "seo",
      name: "E2E Админ Тест",
      company,
      email: "e2e.admin@example.com",
      message: "Автоматизиран E2E тест за администраторския панел и смяна на статус.",
      privacy_acknowledged: true,
      marketing_consent: false,
      website: "",
      form_token: token,
    },
  });
  expect(response.status()).toBe(201);
}

/** An AI readiness submission (every answer at level 1 → 25/100), from its own client address. */
async function createReadinessSubmission(request: APIRequestContext, company: string): Promise<string> {
  const { token } = await (await request.get("/api/public/form-token")).json();
  await new Promise((resolve) => setTimeout(resolve, 3500));
  const ids = [
    "strategy_goals", "strategy_use_cases", "data_access", "data_quality", "process_definition", "process_repeatability",
    "tech_environment", "tech_integration", "people_ownership", "people_change", "gov_data_protection", "gov_oversight",
  ];
  const response = await request.post("/api/public/readiness/submissions", {
    headers: { "X-Forwarded-For": `10.95.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` },
    data: {
      schema_version: "1",
      model_version: "2026-10.2",
      locale: "bg",
      answers: Object.fromEntries(ids.map((id) => [id, 1])),
      name: "E2E Готовност",
      email: "e2e.readiness@example.com",
      company,
      role: "Управител",
      message: "",
      consultation_requested: true,
      privacy_acknowledged: true,
      marketing_consent: true,
      website: "",
      form_token: token,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).reference;
}

test.describe("admin access control", () => {
  test("unauthenticated visitors are redirected to login", async ({ page }) => {
    await page.goto("/admin/leads");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fleads/);
    await expect(page.getByRole("heading", { name: "Вход за администратори" })).toBeVisible();
  });

  test("admin API rejects anonymous requests", async ({ request }) => {
    for (const path of ["/api/admin/leads", "/api/admin/dashboard/stats", "/api/admin/audit", "/api/admin/auth/sessions"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);
      expect((await response.json()).code).toBe("unauthorized");
    }
    expect((await request.post("/api/admin/retention/run", { data: { confirm: true } })).status()).toBe(401);
    expect((await request.patch("/api/admin/leads/00000000-0000-0000-0000-000000000000", { data: { status: "WON" } })).status()).toBe(401);
  });

  test("wrong credentials are rejected", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Имейл").fill("nobody@example.com");
    await page.getByLabel("Парола").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "Вход" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Невалиден имейл или парола." })).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("admin lead management", () => {
  test.skip(!email || !password, "ADMIN_BOOTSTRAP_EMAIL/PASSWORD not provided");

  test("login, view leads, update status, add note, logout", async ({ page, request }) => {
    const company = `E2E Админ ${Date.now()}`;
    await createLead(request, company);
    const readinessCompany = `E2E Готовност ${Date.now()}`;
    const readinessReference = await createReadinessSubmission(request, readinessCompany);

    await page.goto("/admin/login");
    await page.getByLabel("Имейл").fill(email);
    await page.getByLabel("Парола").fill(password);
    await page.getByRole("button", { name: "Вход" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Табло" })).toBeVisible();
    await expect(page.getByText("Общо запитвания")).toBeVisible();

    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === "acs_session");
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");

    await page.getByRole("link", { name: "Запитвания" }).first().click();
    await page.getByLabel("Търсене").fill(company);
    await page.getByRole("button", { name: "Търси" }).click();
    await expect(page.getByTestId("leads-table")).toContainText(company);
    await page.getByRole("link", { name: "E2E Админ Тест" }).first().click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Админ Тест");
    await page.getByLabel("Статус на запитването").selectOption("CONTACTED");
    await page.getByRole("button", { name: "Запази статуса" }).click();
    await expect(page.getByText("Статусът е запазен.")).toBeVisible();
    await expect(page.getByText("Осъществен контакт").first()).toBeVisible();

    await page.getByLabel("Нова бележка").fill("E2E бележка: обаждане насрочено.");
    await page.getByRole("button", { name: "Добави бележка" }).click();
    await expect(page.getByTestId("notes-list")).toContainText("E2E бележка: обаждане насрочено.");

    await page.reload();
    await expect(page.getByLabel("Статус на запитването")).toHaveValue("CONTACTED");
    await expect(page.getByText("Промяна на статус").first()).toBeVisible();

    await page.getByRole("button", { name: "Анализирай" }).click();
    await expect(page.getByTestId("ai-triage")).toContainText("mock");

    // The status change is recorded in the audit log with the administrator as actor.
    const leadId = page.url().split("/").pop()!;
    await page.goto(`/admin/activity?action=lead.status_changed&entity=${leadId}`);
    const log = page.getByTestId("activity-list");
    await expect(log).toContainText("Промяна на статус");
    await expect(log).toContainText(email.toLowerCase());
    await expect(log).toContainText("Ново → Осъществен контакт");
    // Viewing the lead's personal data was audited as well.
    await page.goto(`/admin/activity?action=lead.viewed&entity=${leadId}`);
    await expect(page.getByTestId("activity-list")).toContainText("Преглед на лични данни");

    // An AI readiness submission shows its server-computed result and a PDF only admins can download.
    await page.goto(`/admin/leads?q=${encodeURIComponent(readinessCompany)}`);
    await page.getByRole("link", { name: "E2E Готовност" }).first().click();
    await expect(page.getByText(`#${readinessReference}`)).toBeVisible();
    const readiness = page.getByTestId("readiness-details");
    await expect(readiness).toContainText("25 / 100");
    await expect(readiness).toContainText("Изграждане на основи");
    await expect(readiness).toContainText("Заявена консултацияДа");
    await expect(readiness.getByRole("listitem").first()).toContainText("Стратегия");
    await expect(page.getByText(/Дадено на .* \(версия /)).toBeVisible();
    const reportHref = (await readiness.getByTestId("readiness-report-download").getAttribute("href"))!;
    const pdf = await page.request.get(reportHref);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    expect((await request.get(reportHref)).status()).toBe(401);

    await page.getByRole("button", { name: "Изход" }).last().click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
