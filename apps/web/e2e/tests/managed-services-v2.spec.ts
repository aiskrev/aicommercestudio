import { expect, test } from "@playwright/test";

/**
 * AI Managed Services v2 (docs/AI_MANAGED_SERVICES_V2.md): three proposed service levels described on
 * every dimension, current and planned capability kept apart, the optional qualification questions and
 * the admin categorisation. The existing inquiry flow is covered in i18n.spec.ts.
 */

const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const humanPause = () => new Promise((resolve) => setTimeout(resolve, 3500));
const LEVELS = ["essential", "managed", "advanced"] as const;

// Own client address: the inquiry rate limit is per IP and shared with the other specs.
test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.97.1.${Math.floor(Math.random() * 200) + 1}` } });

for (const [path, names] of [
  ["/bg/uslugi/ai-managed-services", { proposed: "работни предложения", current: "Налично сега", planned: "Планирано" }],
  ["/en/services/ai-managed-services", { proposed: "working proposals", current: "Available today", planned: "Planned" }],
] as const) {
  test(`${path}: every level on every dimension, current and planned capability apart`, async ({ page }) => {
    expect((await page.goto(path))?.status()).toBe(200);
    await expect(page.getByTestId("levels-proposed-note")).toContainText(names.proposed);
    for (const key of LEVELS) {
      const level = page.getByTestId(`level-${key}`);
      await level.evaluate((el) => ((el as HTMLDetailsElement).open = true));
      await expect(level.locator("[data-dimension]").first()).toBeVisible();
      await expect(level.locator("[data-dimension]")).toHaveCount(13);
      await expect(level).not.toContainText(/€|лв\.|\$\d|24\/7|SLA|uptime|99[.,]\d/i);
    }
    await expect(page.getByTestId("capability-current")).toContainText(names.current);
    await expect(page.getByTestId("capability-planned")).toContainText(names.planned);
    await expect(page.getByTestId("ai-qualification")).toBeVisible();
    // The page and the levels stay readable on a phone.
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the qualification questions are optional and validated by the API", async ({ request }) => {
  const { token } = await (await request.get("/api/public/form-token")).json();
  await humanPause();
  const base = {
    service: "ai_managed",
    name: "E2E Qualification",
    company: "Example Ltd",
    email: "e2e.qualification@example.com",
    message: "Synthetic E2E test: we run an AI support agent and want a monthly review.",
    privacy_acknowledged: true,
    locale: "en",
    form_token: token,
    ai_managed: {
      sector: "ecommerce",
      system_types: ["customer_support"],
      agents_count: "1",
      support_interests: ["monitoring"],
      communication_language: "en",
      desired_level: "platinum",
    },
  };
  const headers = { "X-Forwarded-For": `10.97.0.${Math.floor(Math.random() * 200) + 1}` };
  const invalid = await request.post("/api/public/leads", { data: base, headers });
  expect(invalid.status()).toBe(422);
  const body = await (await request.post("/api/public/leads", { data: { ...base, ai_managed: { ...base.ai_managed, desired_level: "essential" } }, headers })).json();
  expect(body.reference).toBeTruthy();
  // The triage is for the team only.
  expect(Object.keys(body).sort()).toEqual(["inquiry_type", "message", "reference", "status"]);
});

test("a qualified inquiry is categorised for the administrator", async ({ page }) => {
  test.skip(!email || !password, "ADMIN_BOOTSTRAP_EMAIL/PASSWORD not provided");
  test.setTimeout(90_000);
  const company = `E2E AMS v2 ${Date.now()}`;
  await page.goto("/en/services/ai-managed-services#ams-inquiry");
  const form = page.locator("#ams-inquiry");
  await form.getByLabel(/^Full name/).fill("E2E AMS Qualified");
  await form.getByLabel(/^Company/).fill(company);
  await form.getByLabel(/^Email/).fill("e2e.ams.v2@example.com");
  await form.getByLabel(/^Industry/).selectOption("logistics");
  await form.getByLabel(/^Number of agents/).selectOption("over_20");
  await form.getByRole("checkbox", { name: "AI workflow automation" }).check();
  await form.getByRole("checkbox", { name: "Full managed service" }).check();
  const q = form.getByTestId("ai-qualification");
  await q.getByLabel(/^Which level looks closest/).selectOption("managed");
  await q.getByLabel(/^State of the system/).selectOption("production");
  await q.getByLabel(/^Is there a technical owner/).selectOption("yes");
  await q.getByLabel(/^Can you grant read-only access/).selectOption("read_access");
  await q.getByLabel(/^Is there a non-production environment/).selectOption("no");
  await form.getByLabel(/^Main operational problems/).fill("Synthetic E2E test: several workflow agents, frequent prompt changes, no test environment.");
  await form.getByRole("checkbox", { name: /I have read the Privacy Policy/ }).check();
  await humanPause();
  const response = page.waitForResponse((r) => r.url().endsWith("/api/public/leads") && r.request().method() === "POST");
  await form.getByRole("button", { name: "Request an AI assessment" }).click();
  expect((await response).status()).toBe(201);

  await page.goto("/admin/login");
  await page.getByLabel(/^(Имейл|Email)$/).fill(email);
  await page.getByLabel(/^(Парола|Password)$/).fill(password);
  await page.getByRole("button", { name: /^(Вход|Log in)$/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  if ((await page.locator("html").getAttribute("lang")) !== "en") {
    await page.locator("[data-testid=admin-language-switch]:visible").first().click();
  }
  await page.goto(`/admin/leads?ams_level=advanced&q=${encodeURIComponent(company)}`);
  await expect(page.getByTestId("leads-table")).toContainText(company);
  await expect(page.getByTestId("lead-ams-level").first()).toContainText("Advanced AI Reliability & Optimization");
  await page.getByRole("link", { name: "E2E AMS Qualified" }).first().click();
  const triage = page.getByTestId("ai-qualification-triage");
  await expect(triage.locator("[data-level=advanced]")).toBeVisible();
  await expect(triage.locator("[data-readiness=needs_preparation]")).toBeVisible();
  await expect(triage).toContainText("no test environment");
  await expect(page.getByTestId("ai-qualification-answers")).toContainText("Managed AI Operations");
});
