import { expect, test } from "@playwright/test";

/** Interactive tools: the readiness assessment end to end, shared links and safeguards. */

test("AI readiness assessment runs end to end in Bulgarian", async ({ page }) => {
  const response = await page.goto("/bg/instrumenti/ai-gotovnost");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Оценка на AI готовността");
  const form = page.getByTestId("readiness-form");

  await form.getByRole("button", { name: "Напред" }).click();
  await expect(form.getByRole("alert")).toContainText("Отговорете на всички въпроси");

  for (let step = 0; step < 5; step++) {
    for (const group of await form.getByRole("group").all()) await group.getByRole("radio").nth(2).check();
    await form.getByRole("button", { name: step === 4 ? "Вижте резултата" : "Напред" }).click();
  }

  const result = page.getByTestId("readiness-result");
  await expect(result.getByTestId("tool-score")).toHaveText("67");
  await expect(result.getByText("В развитие", { exact: true })).toBeVisible();
  await expect(result.getByRole("link", { name: "Заяви консултация" })).toHaveAttribute("href", "/bg/kontakti?usluga=audit");
  await expect(result.getByRole("button", { name: "Изтегли обобщение (.txt)" })).toBeVisible();
});

test("a shared readiness link restores the result without a form", async ({ page }) => {
  await page.goto("/en/tools/ai-readiness?r=3333333333");
  await expect(page.getByTestId("tool-score")).toHaveText("100");
  await expect(page.getByText("The result was loaded from a shared link.")).toBeVisible();
  await page.getByRole("button", { name: "Start over" }).click();
  await expect(page.getByTestId("readiness-form")).toBeVisible();
  await expect(page).toHaveURL(/\/en\/tools\/ai-readiness$/);
});

test("tools that are not built have no page", async ({ request }) => {
  for (const path of ["/bg/instrumenti/ai-ekip", "/en/tools/roi-calculator", "/bg/instrumenti/nesashtestvuva"]) {
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
