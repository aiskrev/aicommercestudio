import { expect, type Page, test } from "@playwright/test";

/**
 * Ops platform (staff-only) on the labelled demo organisation seeded for the run, and the client
 * portal, which stays switched off until it is explicitly approved for release.
 */

const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel(/^(Имейл|Email)$/).fill(email);
  await page.getByLabel(/^(Парола|Password)$/).fill(password);
  await page.getByRole("button", { name: /^(Вход|Log in)$/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  if ((await page.locator("html").getAttribute("lang")) !== "en") {
    await page.locator("[data-testid=admin-language-switch]:visible").first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  }
}

test("the client portal is off and says so; its API does not exist while off", async ({ page, request }) => {
  // A test stack started with the portal on (portal.spec.ts) checks the enabled flow instead.
  test.skip((await request.get("/api/portal/me")).status() !== 404, "the client portal is switched on in this stack");
  await page.goto("/portal");
  await expect(page.getByTestId("portal-unavailable")).toBeVisible();
  expect((await request.post("/api/portal/login", { data: { email: "a@example.com", password: "x" } })).status()).toBe(404);
  const robots = await (await request.get("/portal")).text();
  expect(robots).toContain("noindex");
});

test.describe("staff Ops platform on the demo organisation", () => {
  test.skip(!email || !password, "ADMIN_BOOTSTRAP_EMAIL/PASSWORD not provided");

  test("registry draft → review → approval, a simulated evaluation and an incident record", async ({ page }) => {
    test.setTimeout(120_000);
    const stamp = Date.now();
    await signIn(page);
    await page.goto("/admin/operations?tab=registry");
    await expect(page.getByTestId("ops-registry")).toBeVisible();
    await expect(page.getByTestId("ops-demo-notice")).toBeVisible();
    await expect(page.getByTestId("ops-tabs").getByRole("tab")).toHaveCount(7);

    // Registry: a staging (non-sensitive) version, submitted and approved.
    await page.getByTestId("ops-agent-picker").selectOption({ label: "Sample knowledge assistant" });
    const draft = page.getByTestId("ops-new-version");
    await draft.getByLabel("Prompt template").fill(`Answer from the sample documents.\nRule: cite the source.\nRule: never disclose personal data.`);
    await draft.getByLabel("Reason for the change").fill(`E2E draft ${stamp}`);
    await draft.getByRole("button", { name: "Create the draft" }).click();
    const detail = page.getByTestId("ops-version-detail");
    await expect(detail).toContainText("Draft");
    await expect(page.getByTestId("ops-integrity")).toContainText("Content hash verified");
    await detail.getByRole("button", { name: "Submit for review" }).click();
    await expect(detail).toContainText("In review");
    await page.getByTestId("ops-review").getByRole("button", { name: "Approve" }).click();
    await expect(detail).toContainText("Approved");

    // Evaluations: the synthetic template, locked and run — marked as simulated.
    // Wait for the new tab before using its controls (the previous tab's picker has the same test id).
    await page.getByTestId("ops-tabs").getByRole("tab", { name: "Evaluations" }).click();
    await expect(page.getByTestId("ops-evaluations")).toBeVisible();
    await page.getByTestId("ops-agent-picker").selectOption({ label: "Sample knowledge assistant" });
    await expect(page.getByTestId("ops-agent-picker").locator("option:checked")).toHaveText("Sample knowledge assistant");
    await page.getByRole("button", { name: "Add the synthetic support template" }).click();
    await page.getByRole("button", { name: "Lock this version" }).click();
    const versionSelect = page.getByTestId("ops-run-version");
    await versionSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Run against version" }).last().click();
    await expect(page.getByTestId("ops-results")).toBeVisible();
    await expect(page.getByTestId("simulated-badge").first()).toBeVisible();
    await expect(page.getByText("no model was called").first()).toBeVisible();

    // Observability: synthetic records for the demo organisation, never shown as live.
    await page.getByTestId("ops-tabs").getByRole("tab", { name: "Observability" }).click();
    await expect(page.getByTestId("ops-observability")).toBeVisible();
    await page.getByRole("button", { name: "Generate synthetic sample records" }).click();
    await expect(page.getByTestId("ops-freshness")).toContainText("Not live");
    await expect(page.getByTestId("ops-freshness")).toContainText("synthetic");

    // Incidents: record one and move it through the first step.
    await page.getByTestId("ops-tabs").getByRole("tab", { name: "Incidents" }).click();
    await expect(page.getByTestId("ops-incidents")).toBeVisible();
    const form = page.getByTestId("ops-new-incident");
    await form.getByLabel("Title").fill(`E2E incident ${stamp}`);
    await form.getByRole("button", { name: "Record" }).click();
    const incident = page.getByTestId("ops-incident-detail");
    await expect(page.getByRole("heading", { name: new RegExp(`E2E incident ${stamp}`) })).toBeVisible();
    await expect(incident).toContainText("Detected");
    await incident.getByRole("button", { name: "Move to: Triaged" }).click();
    await expect(incident.getByTestId("ops-timeline")).toContainText("Triaged");
    await expect(incident.getByRole("button", { name: "Move to: Resolved" })).toHaveCount(0);
  });
});
