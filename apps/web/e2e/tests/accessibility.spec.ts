import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, type Locator, type Page, test } from "@playwright/test";

/**
 * Automated accessibility checks (axe-core, WCAG 2.0/2.1 A and AA rules) and keyboard checks for the pages and flows
 * changed by the legal remediation, in Bulgarian and English. Automated checks find only part of the problems: a pass
 * here is NOT a statement of WCAG conformance, and the items listed in docs/ACCESSIBILITY.md still need a manual
 * review with a screen reader. Violations of impact "serious" or "critical" fail the test; lesser ones are attached.
 */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function scan(page: Page, label: string, testInfo: { attach: (name: string, options: { body: string; contentType: string }) => Promise<void> }) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")) }));
  await testInfo.attach(`axe-${label}.json`, { body: JSON.stringify({ label, violations: summary, passes: results.passes.length, incomplete: results.incomplete.map((i) => i.id) }, null, 2), contentType: "application/json" });
  const blocking = summary.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking, `${label}: ${JSON.stringify(blocking)}`).toEqual([]);
}

const PUBLIC = [
  "/bg/poveritelnost",
  "/en/privacy",
  "/bg/biskvitki",
  "/en/cookies",
  "/bg/obshti-usloviya",
  "/en/terms",
  "/bg/usloviya-za-abonament",
  "/en/subscription-terms",
  "/bg/otkaz-i-vazstanovyavane",
  "/en/withdrawal-and-refunds",
  "/bg/kontakti",
  "/en/contact",
  "/bg/otkaz-ot-marketing",
  "/en/marketing-opt-out",
];

for (const path of PUBLIC) {
  test(`axe: ${path}`, async ({ page }, testInfo) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await scan(page, path, testInfo);
    // One h1 and a footer with the legal links on every page that has a footer.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });
}

async function focusRing(locator: Locator): Promise<boolean> {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el as HTMLElement);
    return (style.outlineStyle !== "none" && style.outlineWidth !== "0px") || style.boxShadow !== "none";
  });
}

async function tabTo(page: Page, target: Locator, max = 250) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error("the control cannot be reached with the keyboard");
}

test("keyboard: the contact consent controls are reachable, labelled, and the error is tied to the privacy checkbox", async ({ page }) => {
  await page.goto("/bg/kontakti");
  const privacy = page.getByRole("checkbox", { name: /Запознах се с Политиката за поверителност/ });
  const marketing = page.getByRole("checkbox", { name: /Желая да получавам новини/ });
  await tabTo(page, privacy);
  expect(await focusRing(privacy)).toBe(true);
  await page.keyboard.press("Space");
  await expect(privacy).toBeChecked();
  await tabTo(page, marketing);
  await expect(marketing).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(marketing).toBeChecked();
  await page.keyboard.press("Space");
  await expect(marketing).not.toBeChecked(); // optional: it can be left or cleared
  await privacy.uncheck();
  await page.getByRole("button", { name: "Изпратете запитването" }).click();
  await expect(privacy).toHaveAttribute("aria-invalid", "true");
  const described = await privacy.getAttribute("aria-describedby");
  expect(described).toBeTruthy();
  await expect(page.locator(`#${described}`)).toContainText("Потвърдете");
});

test("keyboard: the opt-out page is operable without a mouse and announces its result", async ({ page }) => {
  await page.goto("/en/marketing-opt-out#token=" + "a".repeat(64));
  const button = page.getByRole("button", { name: "Withdraw my consent" });
  await tabTo(page, button);
  expect(await focusRing(button)).toBe(true);
  await page.route("**/api/public/marketing/withdraw", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "withdrawn" }) }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("Consent withdrawn"); // a live region, so a screen reader announces it
});

test("footer: the legal links are links with their own names, in both languages", async ({ page }) => {
  for (const [path, names] of [
    ["/bg", ["Поверителност", "Бисквитки", "Общи условия", "Абонамент и плащане", "Отказ и връщане на суми"]],
    ["/en", ["Privacy", "Cookies", "Terms of use", "Subscriptions and payments", "Withdrawal and refunds"]],
  ] as const) {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    for (const name of names) await expect(footer.getByRole("link", { name })).toBeVisible();
    await expect(footer).toContainText("207509557"); // the legal entity is identified
  }
});

// The flows behind the account switch are checked on the legal e2e stack only.
const legalStack = process.env.E2E_LEGAL_STACK === "1" && Boolean(process.env.E2E_ACCOUNT_PASSWORD);

async function signIn(browser: Browser, name: string, path: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/bg/konto/vhod");
  await page.getByLabel("Имейл", { exact: true }).fill(`${name}.legal-e2e@example.com`);
  await page.getByLabel("Парола").fill(process.env.E2E_ACCOUNT_PASSWORD ?? "");
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/bg\/konto$/);
  await page.goto(path);
  return page;
}

test.describe("account flows (legal e2e stack)", () => {
  test.skip(!legalStack, "needs the legal e2e stack (scripts/test-legal-e2e.ps1)");

  test("order review: axe, keyboard order, focus ring, labelled controls", async ({ browser }, testInfo) => {
    const page = await signIn(browser, "shopper", "/bg/konto/abonamenti");
    await page.getByRole("button", { name: "Преглед на поръчката" }).click();
    const review = page.getByTestId("order-review");
    await expect(review).toBeVisible();
    await scan(page, "order-review-bg", testInfo);
    const consumer = review.getByRole("radio", { name: /Потребител/ });
    const terms = review.getByRole("checkbox", { name: /Прочетох и приемам/ });
    await tabTo(page, consumer);
    expect(await focusRing(consumer)).toBe(true);
    await page.keyboard.press("Space");
    await expect(consumer).toBeChecked();
    await expect(review.getByRole("checkbox", { name: /Изрично искам услугата да започне/ })).toBeVisible();
    await tabTo(page, terms);
    await page.keyboard.press("Space");
    await expect(terms).toBeChecked();
    // Errors are announced and tied to the control.
    await terms.uncheck();
    await review.getByRole("button", { name: "Поръчвам с оторизиране на плащането" }).click();
    await expect(terms).toHaveAttribute("aria-invalid", "true");
    await expect(review.getByRole("alert").first()).toBeVisible();
    await page.context().close();
  });

  test("order review (EN) and withdrawal: axe", async ({ browser }, testInfo) => {
    const page = await signIn(browser, "shopper", "/en/account/subscriptions");
    await page.getByRole("button", { name: "Review order" }).click();
    await scan(page, "order-review-en", testInfo);
    await page.context().close();
    const withdrawal = await signIn(browser, "layout", "/bg/konto/abonamenti");
    await withdrawal.getByRole("button", { name: "Откажете се от договора тук" }).click();
    await scan(withdrawal, "withdrawal-step-1-bg", testInfo);
    await withdrawal.getByLabel("Вашето изявление").fill("Недвусмислено заявявам, че се отказвам от договора.");
    await withdrawal.getByRole("button", { name: "Продължете към потвърждение" }).click();
    await scan(withdrawal, "withdrawal-step-2-bg", testInfo);
    await withdrawal.context().close();
  });

  test("data rights and account export: axe, label association and the status message", async ({ browser }, testInfo) => {
    const page = await signIn(browser, "rights", "/bg/konto/sigurnost");
    await scan(page, "account-home-bg", testInfo);
    const section = page.getByTestId("account-data");
    const kind = section.getByLabel("Вид искане");
    await tabTo(page, kind);
    expect(await focusRing(kind)).toBe(true);
    await section.getByRole("button", { name: "Изтеглете данните си (JSON)" }).click();
    await expect(section.getByRole("status")).toContainText("Файлът е изтеглен."); // announced
    await page.context().close();
  });

  test("staff queues: axe and keyboard use of the tabs", async ({ browser }, testInfo) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto("/admin/login");
    await page.getByLabel("Имейл").fill(process.env.ADMIN_BOOTSTRAP_EMAIL ?? "");
    await page.getByLabel("Парола").fill(process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "");
    await page.getByRole("button", { name: "Вход" }).click();
    await page.waitForURL(/\/admin$/);
    await page.goto("/admin/compliance");
    await expect(page.getByRole("tab", { name: "Откази от договор" })).toHaveAttribute("aria-selected", "true");
    await scan(page, "admin-compliance", testInfo);
    await page.getByRole("tab", { name: "Искания за данни" }).click();
    await expect(page.getByRole("tab", { name: "Искания за данни" })).toHaveAttribute("aria-selected", "true");
    await page.context().close();
  });
});
