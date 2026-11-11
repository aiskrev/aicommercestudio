import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Page, test } from "@playwright/test";

// The signed-in customer's own quote requests and the account status (docs/ACCOUNTS_HARDENING.md). Needs the legal
// e2e stack (customer accounts on, throwaway database, synthetic accounts): scripts/test-legal-e2e.ps1.
const legalStack = process.env.E2E_LEGAL_STACK === "1" && Boolean(process.env.E2E_ACCOUNT_PASSWORD);
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function signIn(browser: Browser, name: string, viewport = { width: 1280, height: 900 }): Promise<Page> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto("/bg/konto/vhod");
  await page.getByLabel("Имейл", { exact: true }).fill(`${name}.legal-e2e@example.com`);
  await page.getByLabel("Парола").fill(process.env.E2E_ACCOUNT_PASSWORD ?? "");
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/bg\/konto$/);
  // With the advisor workspace on (this stack) /konto is the workspace dashboard; the account's own page is /konto/sigurnost.
  await page.goto("/bg/konto/sigurnost");
  await expect(page.getByTestId("account-status")).toBeVisible();
  return page;
}

async function sendQuoteRequest(page: Page, email: string, company: string): Promise<string> {
  const token = (await (await page.request.get("/api/public/form-token")).json()).token as string;
  const response = await page.request.post("/api/public/quote-requests", {
    data: {
      service: "business_websites",
      name: "E2E Заявка",
      company,
      email,
      message: "Искаме оферта за нов бизнес сайт с форма за запитване.",
      privacy_acknowledged: true,
      marketing_consent: false,
      website: "",
      form_token: token,
      platform: "custom",
      budget_range: "2500_10000",
      timeline: "flexible",
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()).reference as string;
}

test.describe("account area with customer accounts on", () => {
  test.skip(!legalStack, "needs the legal e2e stack (scripts/test-legal-e2e.ps1)");

  test("the account shows its status and only the requests sent from its own address", async ({ browser }) => {
    const mine = await signIn(browser, "plain");
    const status = mine.getByTestId("account-status");
    await expect(status).toContainText("Акаунтът е активен.");
    await expect(status).toContainText("Имейлът е потвърден.");
    await expect(status).toContainText("Приета версия на информацията за поверителност");
    const section = mine.getByTestId("account-quote-requests");
    await expect(section).toContainText("Още няма запитвания от този адрес.");

    // A request sent anonymously from the account's address, one from someone else's, none from a stranger's company.
    const own = await sendQuoteRequest(mine, "plain.legal-e2e@example.com", "Моята фирма");
    const foreign = await sendQuoteRequest(mine, "someone.else.e2e@example.com", "Чужда фирма");
    await mine.reload();
    const row = mine.getByTestId("account-quote-requests").locator(`[data-reference="${own}"]`);
    await expect(row).toContainText("Заявка за оферта");
    await expect(row).toContainText(own);
    await expect(mine.getByTestId("account-quote-requests").locator(`[data-reference="${foreign}"]`)).toHaveCount(0);
    await expect(mine.getByTestId("account-quote-requests")).not.toContainText("Чужда фирма");
    await expect(mine.getByTestId("account-quote-requests")).not.toContainText("someone.else");

    // Another customer sees neither.
    const other = await signIn(browser, "rights");
    await expect(other.getByTestId("account-quote-requests")).toContainText("Още няма запитвания от този адрес.");
    await expect(other.getByTestId("account-quote-requests").locator(`[data-reference="${own}"]`)).toHaveCount(0);
    // The anonymous routes still work for someone who is signed in (nothing was linked or changed by sending).
    const again = await sendQuoteRequest(other, "unregistered.e2e@example.com", "Без акаунт");
    expect(again).toMatch(/^[0-9A-F]{8}$/);
  });

  test("the API answers 401 without a sign-in and never returns another address's requests", async ({ browser, request }) => {
    expect((await request.get("/api/accounts/quote-requests")).status()).toBe(401);
    const page = await signIn(browser, "layout");
    const reference = await sendQuoteRequest(page, "someone.else.e2e2@example.com", "Друга фирма");
    const list = await (await page.request.get("/api/accounts/quote-requests")).json();
    expect(JSON.stringify(list)).not.toContain(reference);
    expect(page.url()).toMatch(/\/bg\/konto\/sigurnost$/);
  });

  test("axe on the account page with its status and the list, and the sections at 360 px", async ({ browser }, testInfo) => {
    const page = await signIn(browser, "plain", { width: 360, height: 800 });
    await expect(page.getByTestId("account-quote-requests")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    await testInfo.attach("axe-account.json", { body: JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))), contentType: "application/json" });
    expect(results.violations.map((v) => v.id)).toEqual([]);
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  });
});
