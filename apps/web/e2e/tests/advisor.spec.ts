import { expect, test } from "@playwright/test";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";

// Synthetic example: no real business, no personal data.
const PROCESS =
  "Всеки ден ръчно преписваме новите поръчки от WooCommerce в Excel таблица, после създаваме товарителници " +
  "в профила на куриера и пишем на клиентите номера на пратката по имейл.";

/** The anti-bot form token is only accepted a few seconds after it was issued. */
const humanPause = () => new Promise((resolve) => setTimeout(resolve, 3500));

test("advisor works in demo mode end to end: assessment → consultation → admin sees it", async ({ page }) => {
  test.setTimeout(90_000);
  const company = `E2E Съветник ${Date.now()}`;

  await page.goto("/ai-automation-advisor");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("автоматизация");
  await expect(page.getByTestId("advisor-demo-notice")).toContainText("не е анализ, генериран от изкуствен интелект");

  await page.getByLabel(/Вид бизнес/).selectOption("online_store");
  await page.getByLabel(/Кой процес искате да автоматизирате/).fill(PROCESS);
  await page.getByLabel(/Приблизителен обем/).selectOption("500_2000");
  await page.getByLabel(/Размер на екипа/).selectOption("2_5");
  for (const tool of ["WooCommerce", "Excel / Google Sheets", "Куриер с онлайн профил"]) {
    await page.getByRole("checkbox", { name: tool }).check();
  }
  await humanPause();
  await page.getByRole("button", { name: "Изготви оценка" }).click();

  const result = page.getByTestId("advisor-result");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute("data-mode", "demo");
  await expect(page.getByTestId("advisor-disclaimer")).toContainText("Демонстрационен режим");
  for (const heading of ["Възможности за автоматизация", "Предложен работен поток", "Изисква човешко одобрение", "Въпроси за уточняване"]) {
    await expect(result.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(result).toContainText("WooCommerce");
  await expect(result).toContainText("Нужно одобрение");
  // No invented financial outcomes in the output.
  await expect(result).not.toContainText(/ROI|възвръщаемост|\d\s?%|\d\s?(лв|лева|€|евро)/);
  const reference = (await result.locator("strong.font-mono").first().textContent())?.trim() ?? "";
  expect(reference).toMatch(/^[0-9A-F]{8}$/);

  await page.getByRole("button", { name: "Заяви консултация по тази оценка" }).click();
  const consultation = page.getByTestId("advisor-consultation");
  await expect(consultation).toContainText(reference);
  await expect(consultation.getByLabel(/Услуга/)).toHaveValue("automation");
  await consultation.getByLabel(/Име и фамилия/).fill("E2E Съветник Тест");
  await consultation.getByLabel(/^Фирма/).fill(company);
  await consultation.getByLabel(/^Имейл/).fill("e2e.advisor@example.com");
  await consultation.getByLabel(/Описание на проекта/).pressSequentially("поръчки и товарителници.");
  await consultation.getByRole("checkbox", { name: /информацията за поверителност/ }).check();
  await humanPause();
  await consultation.getByRole("button", { name: "Изпрати запитването" }).click();
  await expect(page.getByTestId("contact-success")).toBeVisible();

  // Administrator sees the assessment attached to the lead.
  await page.goto("/admin/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Запитвания" }).first().click();
  await page.getByLabel("Търсене").fill(company);
  await page.getByRole("button", { name: "Търси" }).click();
  await page.getByRole("link", { name: "E2E Съветник Тест" }).first().click();
  const linked = page.getByTestId("linked-assessment");
  await expect(linked).toBeVisible();
  await expect(page.getByText(`AI оценка #${reference}`)).toBeVisible();
  await expect(linked).toContainText("Демонстрационен режим");
});

test("advisor API rejects invalid input and never asks for personal data", async ({ request }) => {
  const status = await (await request.get("/api/public/advisor/status")).json();
  expect(status.mode).toBe("demo");

  const { token } = await (await request.get("/api/public/form-token")).json();
  const invalid = await request.post("/api/public/advisor/assessments", {
    data: { business_type: "online_store", process_description: "кратко", monthly_volume: "100_500", team_size: "solo", tools: [], email: "x@example.com", form_token: token },
  });
  expect(invalid.status()).toBe(422);
  const fields = (await invalid.json()).errors.map((e: { field: string }) => e.field);
  expect(fields).toEqual(expect.arrayContaining(["process_description", "email"]));
});

test("advisor page is linked from the AI solutions page", async ({ page }) => {
  await page.goto("/ai-resheniya");
  await page.getByTestId("advisor-promo").getByRole("link", { name: "Изпробвай съветника" }).click();
  await expect(page).toHaveURL(/\/ai-automation-advisor$/);
});
