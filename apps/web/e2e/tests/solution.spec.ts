import { expect, test } from "@playwright/test";

/** Agent library (static pages) and AI solution builder (client-side design tool). */

const SUPPORT_CODE = "1.faster_response.support_resolution.023.35.personal.before_external.managed_cloud.01";

test("the agent library lists, filters and links every agent in Bulgarian", async ({ page }) => {
  const response = await page.goto("/bg/ai-agenti");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Библиотека с AI агенти");
  await expect(page.getByText("Каталог за планиране.", { exact: false })).toBeVisible();
  const cards = page.getByTestId("library-cards").locator("article");
  await expect(cards).toHaveCount(12);
  await page.getByLabel("Риск").selectOption("high");
  await expect(cards).toHaveCount(2);
  await expect(page.getByTestId("library-count")).toHaveText("2 от 12 агента");
  await page.getByRole("button", { name: "Изчисти филтрите" }).click();
  await expect(cards).toHaveCount(12);

  await page.getByRole("link", { name: "Агент за обработка на документи" }).click();
  await expect(page).toHaveURL(/\/bg\/ai-agenti\/obrabotka-na-dokumenti$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Агент за обработка на документи");
  await expect(page.getByTestId("agent-workflows")).toContainText("Приемане на документи");
  await expect(page.getByRole("link", { name: "Използвайте в конструктора на решение" }).first()).toHaveAttribute(
    "href",
    "/bg/instrumenti/ai-reshenie?w=document_intake",
  );
});

test("agent pages switch language with the localized slug and are in the sitemap", async ({ page, request }) => {
  await page.goto("/bg/ai-agenti/obrabotka-na-dokumenti");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/ai-agents\/document-processing-agent$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Document Processing Agent");
  await expect(page.getByText("Minimum: Sample review")).toBeVisible();

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/en/ai-agents/document-processing-agent");
  expect(sitemap).toContain("/bg/ai-agenti/kontrol-na-odobreniyata");
  expect(sitemap).toContain("/en/tools/solution-builder");
});

test("the solution builder designs an architecture and a phased plan in English", async ({ page }) => {
  const response = await page.goto("/en/tools/solution-builder");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI solution builder");
  const form = page.getByTestId("solution-form");
  const next = () => form.getByRole("button", { name: "Next" }).click();

  await form.getByRole("radio", { name: /^Faster responses/ }).check();
  await next();
  await form.getByRole("radio", { name: /^Resolving a customer question/ }).check();
  await next();
  await expect(form.getByRole("checkbox", { name: /^Knowledge retrieval \(RAG\)/ })).toBeChecked();
  await next();
  await expect(form.getByText("Never enter API keys or passwords here.", { exact: false })).toBeVisible();
  await next();
  // No field to type a key, token or password into on any step.
  await expect(form.locator("input:not([type=radio]):not([type=checkbox]), textarea")).toHaveCount(0);

  await form.getByRole("radio", { name: /^Personal data/ }).check();
  await expect(form.getByRole("radio", { name: /^Sample review/ })).toBeDisabled();
  await form.getByRole("radio", { name: /^Approval before external actions/ }).check();
  await form.getByRole("radio", { name: "Managed cloud environment" }).check();
  await next();

  const diagram = page.getByTestId("solution-diagram");
  await expect(diagram.locator("[data-stage]")).toHaveCount(6);
  await expect(diagram.locator("[data-stage]").first()).toHaveAttribute("data-stage", "trigger");
  await expect(diagram.locator("[data-approval=before]").first()).toContainText("Human approval");
  await diagram.getByRole("button", { name: "Knowledge index (RAG)" }).click();
  await expect(page.getByRole("region", { name: "Selected component" })).toContainText("Searches approved documents");
  await form.getByRole("button", { name: "Generate the plan" }).click();

  const result = page.getByTestId("solution-result");
  await expect(result.getByRole("heading", { name: "Proposed AI solution" })).toBeFocused();
  await expect(page.getByTestId("solution-complexity")).toHaveText("Medium");
  await expect(page.getByTestId("solution-roadmap").locator("[data-phase]")).toHaveCount(4);
  await expect(page.getByTestId("solution-integrations")).toContainText("OAuth with a limited scope");
  await expect(result.getByText("A design tool: the diagram is a reference architecture, not a running system.", { exact: false })).toBeVisible();
  await expect(page.getByTestId("solution-approvals").locator("[data-component]")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Download summary (.txt)" })).toBeVisible();
});

test("a shared design opens straight on the plan; an invalid code is ignored", async ({ page }) => {
  await page.goto(`/bg/instrumenti/ai-reshenie?s=${SUPPORT_CODE}`);
  await expect(page.getByText("Резултатът е зареден от споделена връзка.")).toBeVisible();
  await expect(page.getByTestId("solution-complexity")).toHaveText("Средна");
  await page.getByRole("button", { name: "Започнете отначало" }).click();
  await expect(page.getByTestId("solution-form")).toBeVisible();
  await expect(page).toHaveURL(/\/bg\/instrumenti\/ai-reshenie$/);

  await page.goto("/en/tools/solution-builder?s=1.nonsense");
  await expect(page.getByTestId("solution-form")).toBeVisible();
});

test("library-only archetypes have every profile field and open their own workflow in the builder", async ({ page }) => {
  await page.goto("/en/ai-agents/ecommerce-catalog-assistant");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("E-commerce catalog assistant");
  for (const id of ["agent-prerequisites", "agent-risks", "agent-approvals"]) {
    await expect(page.getByTestId(id).getByRole("listitem").first()).toBeVisible();
  }
  await expect(page.getByText("Minimum: Approval before external actions")).toBeVisible();
  await expect(page.getByText("It is not in \"Build your AI team\"", { exact: false })).toBeVisible();
  await page.locator("header").getByRole("link", { name: "Превключи на български" }).first().click();
  await expect(page).toHaveURL(/\/bg\/ai-agenti\/produkten-katalog$/);
  await page.goto("/bg/ai-agenti/izgotvyane-na-oferti");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Асистент за изготвяне на оферти");
  await page.getByRole("link", { name: "Използвайте в конструктора на решение" }).first().click();
  await expect(page).toHaveURL(/\/bg\/instrumenti\/ai-reshenie\?w=proposal_drafting$/);
});

test("incompatible and unsafe compositions are rejected in the builder and by the API", async ({ page, request }) => {
  await page.goto("/en/tools/solution-builder");
  const form = page.getByTestId("solution-form");
  const next = () => form.getByRole("button", { name: "Next" }).click();
  await form.getByRole("radio", { name: /^Access to knowledge/ }).check();
  await next();
  await form.getByRole("radio", { name: /^Answers from internal knowledge/ }).check();
  await next();
  await form.getByRole("checkbox", { name: /^Knowledge retrieval \(RAG\)/ }).uncheck();
  await next();
  await expect(page.getByTestId("solution-composition-errors")).toContainText("cannot work without");
  await expect(page.getByRole("heading", { name: "AI capabilities" })).toBeVisible();
  await form.getByRole("checkbox", { name: /^Knowledge retrieval \(RAG\)/ }).check();
  await next();
  await form.getByRole("checkbox", { name: /^Documents and knowledge/ }).uncheck();
  await next();
  await expect(page.getByTestId("solution-composition-errors")).toContainText("RAG has nothing to search");

  // The enquiry endpoint applies the same rules: an approval below the floor or regulated data outside the EU/EEA.
  const meta = { name: "E2E Rules", email: "e2e.rules@example.com", company: "Example Ltd", privacy_acknowledged: true, locale: "en" };
  const { token } = await (await request.get("/api/public/form-token")).json();
  await page.waitForTimeout(3500); // the form token is valid only after a human-like pause
  for (const code of [SUPPORT_CODE.replace(".before_external.", ".none."), "2.fewer_errors.document_intake.125.15.regulated.every_action.on_premise.00"]) {
    const response = await request.post("/api/public/solution/enquiries", {
      data: { ...meta, model_version: "2026-11.1", code, form_token: token },
      headers: { "X-Forwarded-For": `10.96.0.${Math.floor(Math.random() * 200) + 1}` },
    });
    expect(response.status(), code).toBe(422);
    expect((await response.json()).code).toBe("solution_invalid");
  }
});

test("a design can be sent with an optional enquiry", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(`/en/tools/solution-builder?s=${SUPPORT_CODE}`);
  const section = page.getByTestId("solution-consultation");
  await section.getByRole("button", { name: "Send an enquiry" }).click();
  await section.getByLabel(/^Name/).fill("E2E Solution");
  await section.getByLabel(/^Work email/).fill("e2e.solution@example.com");
  await section.getByLabel(/^Company/).fill(`E2E Solution ${Date.now()}`);
  await section.getByTestId("consult-privacy").check();
  await expect(section.getByTestId("consult-marketing")).not.toBeChecked();
  await page.waitForTimeout(3500);
  const response = page.waitForResponse((r) => r.url().endsWith("/api/public/solution/enquiries") && r.request().method() === "POST");
  await section.getByRole("button", { name: "Send the enquiry" }).click();
  expect((await response).status()).toBe(201);
  await expect(section.getByRole("status")).toContainText("Enquiry reference");
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("the library and the plan fit the screen", async ({ page }) => {
    for (const path of ["/en/ai-agents", "/bg/ai-agenti/obsluzhvane-na-klienti", `/en/tools/solution-builder?s=${SUPPORT_CODE}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });
});
