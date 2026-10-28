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
  // Relevant workshops: the domain hubs that list the fixed-scope formats.
  await expect(result.getByTestId("readiness-workshops").getByRole("link", { name: "AI стратегия и трансформация" })).toHaveAttribute(
    "href",
    "/bg/uslugi/ai-strategiya-i-transformatsiya",
  );
  await expect(result.getByRole("link", { name: "Заяви консултация" })).toHaveAttribute("href", "/bg/kontakti?usluga=audit");
  await expect(result.getByRole("button", { name: "Изтегли PDF отчета" })).toBeVisible();
  await expect(result.getByRole("button", { name: "Изтегли обобщение (.txt)" })).toHaveCount(0);
});

test("a shared readiness link restores the result without a form", async ({ page }) => {
  await page.goto("/en/tools/ai-readiness?r=b444444444444");
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
  await page.goto("/en/tools/ai-readiness?r=b444444144444");
  await expect(page.getByTestId("readiness-blockers")).toContainText("Governance and data protection");
  await expect(page.getByRole("heading", { name: "Three priority actions" })).toBeVisible();
  await expect(page.getByText("Set rules for data and approval").first()).toBeVisible();
});

test("the methodology and limitations are published without taking the assessment", async ({ page }) => {
  for (const [path, title, limitation, band] of [
    ["/bg/instrumenti/ai-gotovnost", "Методология и ограничения", "няма външен бенчмарк", "Готовност за пилот"],
    ["/en/tools/ai-readiness", "Methodology and limitations", "there is no external benchmark", "Pilot ready"],
  ] as const) {
    await page.goto(path);
    const methodology = page.getByTestId("readiness-methodology");
    await expect(methodology.getByRole("heading", { level: 2, name: title })).toBeVisible();
    await expect(methodology).toContainText(limitation);
    await expect(methodology.locator("[data-band]")).toHaveCount(4);
    await expect(methodology.locator("[data-band='pilot_ready']")).toContainText(band);
    await expect(methodology.locator("[data-band='pilot_ready']")).toContainText("50–74");
    await expect(methodology.locator("tbody tr")).toHaveCount(6);
  }
});

test("a link of the previous question set opens the form instead of a wrong result", async ({ page }) => {
  await page.goto("/en/tools/ai-readiness?r=444444444444");
  await expect(page.getByTestId("readiness-form")).toBeVisible();
  await expect(page.getByTestId("readiness-result")).toHaveCount(0);
});

test("the basic result needs no contact details; sending it to the team is an explicit opt-in", async ({ page }) => {
  await page.goto("/bg/instrumenti/ai-gotovnost?r=b333333333333");
  const result = page.getByTestId("readiness-result");
  await expect(result.getByTestId("tool-score")).toBeVisible();
  await expect(result.getByRole("textbox")).toHaveCount(1); // only the optional company name for the PDF
  const send = page.getByTestId("readiness-send");
  await expect(send.getByRole("textbox")).toHaveCount(0); // the contact form stays closed until requested
  await send.getByRole("button", { name: "Изпрати резултата на екипа" }).click();
  await expect(send.getByLabel(/^Служебен имейл/)).toBeVisible();
});
