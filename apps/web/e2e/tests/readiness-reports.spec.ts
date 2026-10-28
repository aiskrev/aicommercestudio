import { readFile } from "node:fs/promises";

import { type APIRequestContext, expect, test } from "@playwright/test";

/** Readiness PDF report (anonymous, nothing stored), optional submission and the admin view of it. */

const octet = () => Math.floor(Math.random() * 250) + 1;
const MODEL_VERSION = "2026-11.1";
const answers = (level: number) =>
  Object.fromEntries(
    [
      "strategy_goals", "strategy_use_cases", "tech_integration", "tech_environment", "data_access", "data_quality",
      "gov_data_protection", "gov_oversight", "talent_skills", "talent_support", "people_ownership", "people_change",
    ].map((id) => [id, level]),
  );

// This file sends reports and submissions; its own client address keeps it out of the rate-limit
// buckets the other specs of the same run use (local stacks have no reverse proxy).
test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.96.${octet()}.${octet()}` } });

/** The anti-bot form token is only accepted a few seconds after it was issued. */
async function agedToken(request: APIRequestContext): Promise<string> {
  const { token } = await (await request.get("/api/public/form-token")).json();
  await new Promise((resolve) => setTimeout(resolve, 3500));
  return token;
}

test("the PDF report downloads from the result without any personal data", async ({ page }) => {
  await page.goto("/bg/instrumenti/ai-gotovnost?r=b222222222222");
  await expect(page.getByTestId("tool-score")).toHaveText("50");
  const report = page.getByTestId("readiness-report");
  await expect(report).toContainText("нищо не се запазва");
  await page.waitForTimeout(3500);

  await report.getByLabel("Име на фирмата върху отчета").fill("E2E Фирма");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    report.getByRole("button", { name: "Изтегли PDF отчета" }).click(),
  ]);
  expect(download.suggestedFilename()).toBe("ai-gotovnost-otchet.pdf");
  const bytes = await readFile((await download.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await expect(report.getByRole("status")).toHaveText("Отчетът е изтеглен.");
  // The result never asked for contact details; the send form stays closed until requested.
  await expect(page.getByTestId("readiness-send").getByRole("textbox")).toHaveCount(0);
});

test("the report API validates versions, answers and the form token", async ({ request }) => {
  const token = await agedToken(request);
  const base = { schema_version: "1", model_version: MODEL_VERSION, locale: "en", answers: answers(3), form_token: token };

  const ok = await request.post("/api/public/readiness/report", { data: base });
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-type"]).toBe("application/pdf");
  expect(ok.headers()["cache-control"]).toBe("no-store");

  const stale = await request.post("/api/public/readiness/report", { data: { ...base, model_version: "2025-01.1" } });
  expect(stale.status()).toBe(422);
  const invalid = await request.post("/api/public/readiness/report", { data: { ...base, answers: { ...answers(3), data_quality: 9 } } });
  expect(invalid.status()).toBe(422);
  const noToken = await request.post("/api/public/readiness/report", { data: { ...base, form_token: "" } });
  expect(noToken.status()).toBe(400);
});

test("sending the result to the team validates consent and returns a reference", async ({ page }) => {
  await page.goto("/en/tools/ai-readiness?r=b333333333333");
  await expect(page.getByTestId("tool-score")).toHaveText("75");
  const send = page.getByTestId("readiness-send");
  await send.getByRole("button", { name: "Send the result to our team" }).click();
  await expect(send.getByTestId("readiness-send-storage")).toContainText("We do not send automatic e-mails");
  await expect(send.getByRole("checkbox", { name: /receive information about services/ })).not.toBeChecked();

  await send.getByRole("button", { name: "Send the result" }).click();
  await expect(send.getByRole("alert")).toHaveText("Please correct the highlighted fields.");
  await expect(send.getByText("Please confirm that you have read the privacy information.")).toBeVisible();

  await page.waitForTimeout(3500);
  await send.getByLabel(/^Full name/).fill("E2E Readiness");
  await send.getByLabel(/^Work e-mail/).fill("e2e.readiness@example.com");
  await send.getByLabel(/^Company/).fill(`E2E Readiness ${Date.now()}`);
  await send.getByLabel(/^Role/).fill("Operations director");
  await send.getByRole("checkbox", { name: "I would like a consultation about the result" }).check();
  await send.getByRole("checkbox", { name: /privacy information/ }).check();
  await send.getByRole("button", { name: "Send the result" }).click();

  const success = page.getByTestId("readiness-send-success");
  await expect(success).toBeFocused();
  await expect(success).toContainText("Reference number");
  await expect(success).toContainText(/[0-9A-F]{8}/);
  await expect(success).not.toContainText(/check your (inbox|e-mail)/i);
});

// The admin view of a submission is covered in admin.spec.ts, inside its logged-in session: the
// per-account login limit (10 per 15 min) leaves no room for another login in a full run.
