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

test.describe("admin access control", () => {
  test("unauthenticated visitors are redirected to login", async ({ page }) => {
    await page.goto("/admin/leads");
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fleads/);
    await expect(page.getByRole("heading", { name: "Вход за администратори" })).toBeVisible();
  });

  test("admin API rejects anonymous requests", async ({ request }) => {
    for (const path of ["/api/admin/leads", "/api/admin/dashboard/stats", "/api/admin/audit"]) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
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

    await page.getByRole("button", { name: "Изход" }).last().click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
