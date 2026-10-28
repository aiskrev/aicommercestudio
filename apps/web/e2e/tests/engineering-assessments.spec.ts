import { readFile } from "node:fs/promises";

import { expect, type Locator, type Page, test } from "@playwright/test";

/** Cloud & Platform and DevOps Delivery assessments (engine API), reports, consultation and Advisor V2. */

const octet = () => Math.floor(Math.random() * 250) + 1;

// This file submits forms too; its own client address keeps it out of the per-IP rate-limit bucket
// that the other specs of the same run use (local stacks have no reverse proxy).
test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.92.${octet()}.${octet()}` } });

/** The anti-bot form token is only accepted a few seconds after it was issued. */
const humanPause = () => new Promise((resolve) => setTimeout(resolve, 3500));

/** Answers every single-choice question on each step with the option `pick` chooses, then submits. */
async function answerAll(page: Page, form: Locator, pick: "first" | "last", finish: string, next: string, before?: (step: number) => Promise<void>) {
  for (let step = 0; step < 20; step++) {
    // Wait for the area to render before answering (slower CI machines otherwise answer the previous one).
    await expect(form.getByText(new RegExp(`^(Област|Area) ${step + 1} (от|of) [0-9]+$`))).toBeVisible();
    if (before) await before(step);
    const groups = form.locator("fieldset:has(input[type=radio])");
    const count = await groups.count();
    for (let i = 0; i < count; i++) {
      const group = groups.nth(i);
      if ((await group.locator("input:checked").count()) > 0) continue;
      const radios = group.getByRole("radio");
      const optional = /\((optional|по желание)\)$/.test((await group.locator("legend").innerText()).trim());
      if (optional) continue;
      await (pick === "first" ? radios.first() : radios.last()).check();
    }
    const finishButton = form.getByRole("button", { name: finish });
    if (await finishButton.count()) {
      await finishButton.click();
      return;
    }
    await form.getByRole("button", { name: next }).click();
  }
  throw new Error("the wizard did not finish");
}

test("cloud & platform maturity in Bulgarian: explained findings, roadmap, report, PDF and an optional consultation", async ({ page }) => {
  test.setTimeout(90_000);
  const response = await page.goto("/bg/instrumenti/zrelost-na-oblak-i-platforma");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Оценка на зрелостта на облака и платформата");
  const form = page.getByTestId("engine-form");
  await expect(form.getByText("Област 1 от 10")).toBeVisible();

  await form.getByRole("button", { name: "Напред" }).click();
  await expect(form.getByRole("alert")).toContainText("Отговорете на отбелязаните въпроси");
  await form.getByRole("checkbox", { name: "AWS" }).check();
  await form.getByRole("checkbox", { name: /Хибридно/ }).check();
  await answerAll(page, form, "first", "Вижте резултата", "Напред");

  const result = page.getByTestId("engine-result");
  await expect(result.getByRole("heading", { level: 2, name: "Вашият резултат" })).toBeFocused();
  await expect(result.getByTestId("tool-score")).toHaveText("0");
  const risks = result.getByTestId("engine-findings-risk");
  await expect(risks).toContainText("Всичко в един общ акаунт");
  await expect(risks).toContainText("„Как са организирани облачните акаунти, абонаменти или проекти?“: Един общ акаунт/абонамент за всичко");
  await expect(result.getByTestId("engine-findings-quick_win")).toContainText("SSO и MFA");
  await expect(result.getByTestId("engine-findings-recommendation")).toContainText("Landing zones и организация: 0/100 — под прага 50");
  const context = result.getByTestId("engine-findings-context");
  await expect(context).toContainText("AWS: термини");
  await expect(context).toContainText("Хибридни и частни среди");
  await expect(context).not.toContainText("Няколко облака");
  await expect(result.getByTestId("engine-roadmap")).toContainText("30 дни");
  await expect(result.getByTestId("engine-services").getByRole("link", { name: "Облачен и платформен инженеринг" })).toHaveAttribute(
    "href",
    /^\/bg\/uslugi\//,
  );

  // The basic result needs no contact details; the consultation is offered separately.
  const consultation = page.getByTestId("engine-consultation");
  await expect(consultation.getByRole("link", { name: "Към формата за контакт" })).toBeVisible();

  await page.getByRole("button", { name: "Запазете и създайте доклад" }).click();
  await expect(page.getByTestId("engine-saved")).toContainText("Референция");
  await page.getByRole("button", { name: "Покажете доклада" }).click();
  const report = page.getByTestId("engine-report-view");
  await expect(report).toHaveAttribute("lang", "bg");
  await expect(report.getByRole("heading", { level: 3, name: "Вашите отговори и допускания" })).toBeVisible();
  await expect(report.getByRole("heading", { level: 3, name: "Ограничения" })).toBeVisible();
  await expect(report).toContainText("Изчисленията не са проверени от независима страна.");

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Изтеглете PDF" }).click()]);
  expect(download.suggestedFilename()).toBe("doklad-ocenka.pdf");
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.includes("DejaVuSans")).toBe(true);

  await consultation.getByRole("button", { name: "Поискайте консултация" }).click();
  const consultForm = page.getByTestId("engine-consultation-form");
  await expect(consultForm.getByTestId("consult-marketing")).not.toBeChecked();
  await consultForm.getByLabel(/^Име/).fill("Тест Тестов");
  await consultForm.getByLabel(/Служебен имейл/).fill("cloud-e2e@example.com");
  await consultForm.getByLabel(/^Компания/).fill(`E2E Облак ${Date.now()}`);
  await consultForm.getByTestId("consult-privacy").check();
  await humanPause();
  await consultForm.getByRole("button", { name: "Изпратете запитването" }).click();
  await expect(consultation).toContainText("Благодарим! Референция:");
});

test("DevOps delivery in English: metrics stay optional, unverified and unscored", async ({ page }) => {
  await page.goto("/en/tools/devops-delivery-maturity");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("DevOps Delivery Maturity Assessment");
  const form = page.getByTestId("engine-form");
  await expect(form.getByText("Area 1 of 11")).toBeVisible();
  await answerAll(page, form, "last", "See the result", "Next", async () => {
    const deployments = form.getByLabel(/Production deployments in the last 30 days/);
    if (await deployments.count()) {
      await expect(form.getByText(/Optional metrics: enter actual numbers only/)).toBeVisible();
      await deployments.fill("40");
      await form.getByRole("group", { name: /Where do these numbers come from/ }).getByRole("radio", { name: "Our own estimate" }).check();
    }
  });

  const result = page.getByTestId("engine-result");
  await expect(result.getByTestId("tool-score")).toHaveText("100");
  await expect(result.getByTestId("engine-findings-risk")).toHaveCount(0);
  const metrics = result.getByTestId("engine-metrics");
  await expect(metrics).toContainText("Stated as your own estimate");
  await expect(metrics).toContainText("40 deployments");
  await expect(metrics).toContainText("Not verified by us and not scored.");
  await expect(result.getByTestId("engine-findings-context")).toContainText("Your metrics are estimates");
});

test("the assessment API keeps old versions out of scoring and reports behind the token", async ({ request }) => {
  const definition = await (await request.get("/api/public/assessments/devops_delivery?locale=en")).json();
  expect(definition.version).toBe("1.1.0");
  const outdated = await request.post("/api/public/assessments/devops_delivery/score", {
    data: { schema_version: "1", definition_version: "1.0.0", locale: "en", answers: {} },
  });
  expect(outdated.status()).toBe(409);
  const report = await request.post("/api/public/assessments/results/report", { data: { token: "x".repeat(43) } });
  expect(report.status()).toBe(404);
});

test("both assessments switch language with their localized slugs", async ({ page }) => {
  await page.goto("/bg/instrumenti/zrelost-na-devops-dostavkata");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/tools\/devops-delivery-maturity$/);
  await page.goto("/en/tools/cloud-platform-maturity");
  await page.locator("header").getByRole("link", { name: "Превключи на български" }).first().click();
  await expect(page).toHaveURL(/\/bg\/instrumenti\/zrelost-na-oblak-i-platforma$/);
});

test("Advisor V2: optional context, explainable insights and a 30/60/90-day roadmap", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/en/ai-automation-advisor");
  const form = page.getByTestId("advisor-form");
  await page.getByLabel(/Type of business/).selectOption("online_store");
  await page
    .getByLabel(/Which process would you like to automate/)
    .fill("Every day we copy new orders from the online store into a spreadsheet, create courier labels by hand and email customers the tracking number.");
  await page.getByLabel(/Approximate volume/).selectOption("500_2000");
  await page.getByLabel(/Team size/).selectOption("2_5");
  await page.getByRole("checkbox", { name: "WooCommerce" }).check();
  await page.getByLabel(/Keep the assessment for/).uncheck();
  await form.getByRole("checkbox", { name: "Add context for a more detailed analysis (version 2)" }).check();
  await page.getByLabel(/Main goal/).selectOption("save_time");
  await page.getByLabel(/What data does the process handle/).selectOption("personal");
  await page.getByLabel(/How can the systems be accessed/).selectOption("api");
  await page.getByLabel(/Who will maintain the solution/).selectOption("external_it");
  await form.getByRole("group", { name: /Does the process directly affect customers/ }).getByRole("radio", { name: "Yes" }).check();
  await form.getByRole("checkbox", { name: "Add an indicative 30/60/90-day roadmap" }).check();
  await humanPause();
  await form.getByRole("button", { name: "Generate assessment" }).click();

  const insights = page.getByTestId("advisor-insights");
  await expect(insights.getByRole("heading", { level: 2, name: "Detailed analysis (version 2)" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("v2-feasibility")).toContainText("Basis: Access to the systems: APIs available");
  await expect(page.getByTestId("v2-risk")).toContainText("Processing personal data");
  await expect(page.getByTestId("v2-checkpoints")).toContainText("Approval of every outgoing customer message");
  await expect(page.getByTestId("v2-roadmap")).toContainText("By 90 days: decision");
  await expect(insights).not.toContainText(/\d+\s*%|ROI/);
});
