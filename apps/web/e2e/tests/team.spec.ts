import { expect, test } from "@playwright/test";

/** "Build your AI team": the full journey, keyboard use, the share link and dependency rules. */

/** Same format as encodeTeam in src/lib/ai-team.ts (base64url JSON of enumerated values). */
function shareCode(): string {
  const payload = {
    c: ["saas", "s51_250", "sales", "lead_followup", "v1k_10k"],
    d: ["sales"],
    a: ["lead_qualification", "scheduling", "customer_support"],
    g: {},
    p: ["customer_cloud", "internal"],
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

test("the AI team configurator runs end to end in Bulgarian", async ({ page }) => {
  const response = await page.goto("/bg/instrumenti/ai-ekip");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Съберете своя AI екип");
  const form = page.getByTestId("team-form");

  // Step 1 — validation, then native keyboard selection inside a pill group.
  await form.getByRole("button", { name: "Напред" }).click();
  await expect(form.getByRole("alert")).toContainText("Попълнете отбелязаните полета");
  await form.getByRole("radio", { name: "Онлайн търговия" }).check();
  await form.getByRole("radio", { name: "Онлайн търговия" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(form.getByRole("radio", { name: "Професионални услуги" })).toBeChecked();
  await form.getByRole("radio", { name: "11–50 души" }).check();
  await form.getByRole("group", { name: "Отдел, който води инициативата" }).getByRole("radio", { name: "Обслужване на клиенти" }).check();
  await form.getByRole("radio", { name: "Бавни отговори на клиенти" }).check();
  await form.getByRole("radio", { name: "1 000–10 000" }).check();
  await form.getByRole("button", { name: "Напред" }).click();

  // Step 2 — the lead department is preselected.
  await expect(form.getByRole("heading", { level: 2, name: "Отдели" })).toBeFocused();
  await expect(form.getByRole("checkbox", { name: /^Обслужване на клиенти/ })).toBeChecked();
  await form.getByRole("checkbox", { name: /^Продажби/ }).check();
  await form.getByRole("button", { name: "Напред" }).click();

  // Step 3 — recommendations and the automatic dependency.
  await expect(form.getByTestId("agents-recommended")).toContainText("Агент за обслужване на клиенти");
  await form.getByRole("checkbox", { name: "Агент за обслужване на клиенти" }).check();
  const knowledge = form.getByRole("checkbox", { name: "Асистент за вътрешни знания" });
  await expect(knowledge).toBeChecked();
  await expect(knowledge).toBeDisabled();
  await form.getByRole("checkbox", { name: "Агент за квалификация на запитвания" }).check();
  await expect(page.getByTestId("team-summary")).toContainText("Асистент за вътрешни знания");
  await form.getByRole("button", { name: "Напред" }).click();

  // Step 4 — approval floor and deployment preferences.
  const support = form.getByTestId("settings-customer_support");
  await expect(support.getByRole("radio", { name: /^Без одобрение/ })).toBeDisabled();
  await expect(support.getByRole("radio", { name: /^Одобрение преди външно действие/ })).toBeChecked();
  await form.getByRole("radio", { name: /^Управлявана облачна среда/ }).check();
  await form.getByRole("radio", { name: /^Съвместно/ }).check();
  await form.getByRole("button", { name: "Напред" }).click();

  // Step 5 — the diagram is operable with the keyboard.
  const diagram = form.locator("svg[data-orientation='horizontal']");
  await expect(diagram).toBeVisible();
  await diagram.locator("[data-node='users:team']").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(diagram.locator("[data-node='agent:lead_qualification']")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(diagram.locator("[data-node='agent:lead_qualification']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("architecture-details")).toContainText("действа в CRM");
  await form.getByRole("button", { name: "Вижте резултата" }).click();

  // Result.
  const result = page.getByTestId("team-result");
  await expect(result.getByRole("heading", { level: 2, name: "Вашият препоръчан AI екип" })).toBeFocused();
  await expect(result.getByTestId("team-roles")).toContainText("Асистент за вътрешни знания");
  await expect(result.getByTestId("team-workflows")).toContainText("Разрешаване на клиентски въпрос");
  await expect(result.getByTestId("team-rollout")).toContainText("Пилот");
  await expect(result.getByTestId("team-effort-note")).toContainText("не са оферта");
  await expect(result.getByTestId("team-risks")).toContainText("Грешки пред клиенти");
  await expect(page.getByRole("button", { name: "Копирай връзка към резултата" })).toBeVisible();
  await expect(page.locator("section[aria-labelledby='tool-lead-title']").getByRole("link", { name: "Заяви консултация" })).toHaveAttribute(
    "href",
    "/bg/kontakti?usluga=ai_agents",
  );
});

test("a shared team link restores the plan in English", async ({ page }) => {
  await page.goto(`/en/tools/ai-team?t=${shareCode()}`);
  const result = page.getByTestId("team-result");
  await expect(result).toBeVisible();
  await expect(page.getByText("The result was loaded from a shared link.")).toBeVisible();
  // The support agent brought its required knowledge assistant with it.
  await expect(result.getByTestId("team-roles")).toContainText("Knowledge Assistant");
  await expect(result.getByTestId("team-workflows")).toContainText("From inquiry to meeting");
  await expect(result.getByTestId("team-prerequisites")).toContainText("Prepared environment");
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("team-form")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/tools\/ai-team$/);
});

test("an invalid share link falls back to an empty configurator", async ({ page }) => {
  await page.goto("/en/tools/ai-team?t=not-a-valid-code");
  await expect(page.getByTestId("team-form")).toBeVisible();
  await expect(page.getByTestId("team-summary")).toContainText("No agents selected yet.");
});

test("the team tool switches language with the localized slug", async ({ page }) => {
  await page.goto("/bg/instrumenti/ai-ekip");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/tools\/ai-team$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Build your AI team");
});
