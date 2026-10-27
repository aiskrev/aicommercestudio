import { expect, test } from "@playwright/test";

/** Interactive tools: the readiness assessment end to end, shared links and safeguards. */

test("AI readiness assessment runs end to end in Bulgarian", async ({ page }) => {
  const response = await page.goto("/bg/instrumenti/ai-gotovnost");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Оценка на AI готовността");
  const form = page.getByTestId("readiness-form");

  await form.getByRole("button", { name: "Напред" }).click();
  await expect(form.getByRole("alert")).toContainText("Отговорете на всички въпроси");

  for (let step = 0; step < 6; step++) {
    for (const group of await form.getByRole("group").all()) await group.getByRole("radio").nth(2).check();
    if (step === 1) {
      // Going back keeps the answers of the previous step.
      await form.getByRole("button", { name: "Назад" }).click();
      await expect(form.getByRole("radio", { checked: true })).toHaveCount(2);
      await form.getByRole("button", { name: "Напред" }).click();
      for (const group of await form.getByRole("group").all()) await group.getByRole("radio").nth(2).check();
    }
    await form.getByRole("button", { name: step === 5 ? "Вижте резултата" : "Напред" }).click();
  }

  const result = page.getByTestId("readiness-result");
  await expect(result.getByTestId("tool-score")).toHaveText("50");
  await expect(result.getByTestId("tool-level")).toHaveText("Готовност за пилот");
  await expect(result.getByTestId("readiness-blockers")).toHaveCount(0);
  await expect(result.getByRole("heading", { name: "Три приоритетни действия" })).toBeVisible();
  await expect(result.getByRole("heading", { name: "План за първите 90 дни" })).toBeVisible();
  await expect(result.getByText("Как се изчислява оценката")).toBeVisible();
  await expect(result.getByRole("link", { name: "Заяви консултация" })).toHaveAttribute("href", "/bg/kontakti?usluga=audit");
  await expect(result.getByRole("button", { name: "Изтегли PDF отчета" })).toBeVisible();
  await expect(result.getByRole("button", { name: "Изтегли обобщение (.txt)" })).toHaveCount(0);
});

test("a shared readiness link restores the result without a form", async ({ page }) => {
  await page.goto("/en/tools/ai-readiness?r=444444444444");
  await expect(page.getByTestId("tool-score")).toHaveText("100");
  await expect(page.getByTestId("tool-level")).toHaveText("Scaling readiness");
  await expect(page.getByText("The result was loaded from a shared link.")).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("readiness-form")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/tools\/ai-readiness$/);
});

test("tools that are not built have no page", async ({ request }) => {
  for (const path of ["/bg/instrumenti/ai-biblioteka", "/en/tools/agent-marketplace", "/bg/instrumenti/nesashtestvuva", "/bg/ai-agenti/nesashtestvuva", "/en/ai-agents/unknown-agent"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test("tool pages switch language with the localized slug", async ({ page }) => {
  await page.goto("/bg/instrumenti/ai-gotovnost");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/tools\/ai-readiness$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI readiness assessment");
});

test("blockers are shown even when the overall score is high", async ({ page }) => {
  // Everything at level 4 except data protection (1): governance blocker, overall still high.
  await page.goto("/en/tools/ai-readiness?r=444444444414");
  await expect(page.getByTestId("readiness-blockers")).toContainText("Governance and data protection");
  await expect(page.getByRole("heading", { name: "Three priority actions" })).toBeVisible();
  await expect(page.getByText("Set rules for data and approval").first()).toBeVisible();
});
