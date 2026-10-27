import { readFile } from "node:fs/promises";

import { type APIRequestContext, expect, test } from "@playwright/test";

/** AI team configurator: cost estimate, PDF plan, saved links and consultation (real API). */

const octet = () => Math.floor(Math.random() * 250) + 1;
// Its own client address keeps this file out of the rate-limit buckets of the other specs.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.94.${octet()}.${octet()}` } });

const MODEL_VERSION = "2026-10.1";

/** Same format as encodeTeam in src/lib/ai-team.ts. */
function shareCode(): string {
  const payload = {
    c: ["ecommerce", "s51_250", "support", "slow_response", "v1k_10k"],
    d: ["support", "sales"],
    a: ["customer_support", "lead_qualification", "scheduling"],
    g: {},
    p: ["managed_cloud", "shared"],
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

const apiConfig = {
  context: { industry: "ecommerce", size: "s11_50", lead_department: "support", challenge: "slow_response", volume: "v100_1k" },
  departments: ["support"],
  chosen: ["customer_support"],
  agents: {},
  deployment: "managed_cloud",
  operations: "shared",
};

async function agedToken(request: APIRequestContext): Promise<string> {
  const { token } = await (await request.get("/api/public/form-token")).json();
  await new Promise((resolve) => setTimeout(resolve, 3500));
  return token;
}

test("the result shows transparent costs that recalculate with the visitor's rates", async ({ page }) => {
  await page.goto(`/en/tools/ai-team?t=${shareCode()}`);
  const costs = page.getByTestId("team-costs");
  await expect(costs.getByTestId("team-cost-ranges")).toContainText("€");
  await expect(page.getByTestId("team-security")).toContainText("Inbound content");
  await expect(page.getByTestId("team-data-flows")).toContainText("Customer Support Agent reads from Knowledge base");
  await expect(costs.getByTestId("team-cost-disclaimer")).toContainText("does not create or run working agents");
  await expect(costs).toContainText("Assumptions version: 2026-10.1");

  const expectedTotal = await costs.getByTestId("team-one_time-total").innerText();
  await costs.getByRole("radio", { name: "Higher usage" }).check();
  await expect(costs.getByTestId("team-costs-higher")).toBeVisible();
  await costs.getByRole("radio", { name: "Expected" }).check();

  await costs.getByLabel("Implementation day rate (EUR)").fill("50");
  await costs.getByRole("button", { name: "Recalculate" }).click();
  await expect(costs.getByText("Enter a value between 200 and 2500.")).toBeVisible();
  await costs.getByLabel("Implementation day rate (EUR)").fill("1200");
  await costs.getByRole("button", { name: "Recalculate" }).click();
  await expect(costs.getByText("With your rates")).toBeVisible();
  await expect(costs.getByTestId("team-one_time-total")).not.toHaveText(expectedTotal);
});

test("the PDF plan downloads and a saved link reopens the configuration", async ({ page, browser }) => {
  await page.goto(`/bg/instrumenti/ai-ekip?t=${shareCode()}`);
  await expect(page.getByTestId("team-cost-ranges")).toBeVisible();
  await page.waitForTimeout(3500);

  const report = page.getByTestId("team-report");
  const [download] = await Promise.all([page.waitForEvent("download"), report.getByRole("button", { name: "Изтегли PDF плана" }).click()]);
  expect(download.suggestedFilename()).toBe("ai-ekip-plan.pdf");
  expect((await readFile((await download.path())!)).subarray(0, 5).toString()).toBe("%PDF-");

  await page.getByTestId("team-save").getByRole("button", { name: "Запази и вземи връзка" }).click();
  const link = await page.getByTestId("team-saved-link").inputValue();
  expect(link).toMatch(/\/bg\/instrumenti\/ai-ekip\?c=[\w-]{40,}$/);

  const other = await browser.newPage();
  await other.goto(link);
  await expect(other.getByText("Конфигурацията е заредена от запазена връзка.")).toBeVisible();
  await expect(other.getByTestId("team-roles")).toContainText("Агент за обслужване на клиенти");
  await other.close();
});

test("a consultation request needs explicit consent and returns a reference", async ({ page }) => {
  await page.goto(`/en/tools/ai-team?t=${shareCode()}`);
  const consult = page.getByTestId("team-consult");
  await consult.getByRole("button", { name: "Request a consultation" }).click();
  await expect(consult.getByTestId("team-consult-storage")).toContainText("We do not send automatic e-mails");
  await consult.getByRole("button", { name: "Send the request" }).click();
  await expect(consult.getByText("Please confirm that you have read the privacy information.")).toBeVisible();

  await page.waitForTimeout(3500);
  await consult.getByLabel(/^Full name/).fill("E2E Team");
  await consult.getByLabel(/^Work e-mail/).fill("e2e.team@example.com");
  await consult.getByLabel(/^Company \*/).fill(`E2E Team ${Date.now()}`);
  await consult.getByLabel(/^Role/).fill("CTO");
  await consult.getByRole("checkbox", { name: /privacy information/ }).check();
  await consult.getByRole("button", { name: "Send the request" }).click();
  const success = page.getByTestId("team-consult-success");
  await expect(success).toBeFocused();
  await expect(success).toContainText(/[0-9A-F]{8}/);
});

test("the team API validates versions and configurations and hides unknown links", async ({ request }) => {
  const base = { schema_version: "1", model_version: MODEL_VERSION, locale: "en", config: apiConfig };
  const ok = await request.post("/api/public/team/estimate", { data: base });
  expect(ok.status()).toBe(200);
  const plan = await ok.json();
  expect(plan.estimate.currency).toBe("EUR");
  expect(Object.keys(plan.estimate.scenarios)).toEqual(["conservative", "expected", "higher"]);

  expect((await request.post("/api/public/team/estimate", { data: { ...base, model_version: "2025-01.1" } })).status()).toBe(422);
  expect((await request.post("/api/public/team/estimate", { data: { ...base, config: { ...apiConfig, chosen: ["workflow_coordinator"] } } })).status()).toBe(422);
  expect((await request.post("/api/public/team/estimate", { data: { ...base, overrides: { day_rate: 5 } } })).status()).toBe(422);
  expect((await request.post("/api/public/team/configurations/lookup", { data: { token: "x".repeat(43) } })).status()).toBe(404);
  expect((await request.post("/api/public/team/report", { data: { ...base, form_token: "" } })).status()).toBe(400);
  const token = await agedToken(request);
  const saved = await request.post("/api/public/team/configurations", { data: { ...base, form_token: token } });
  expect(saved.status()).toBe(201);
  const lookup = await request.post("/api/public/team/configurations/lookup", { data: { token: (await saved.json()).token } });
  expect((await lookup.json()).config.chosen).toEqual(["customer_support"]);
});
