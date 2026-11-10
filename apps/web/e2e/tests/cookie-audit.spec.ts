import { expect, type Page, test } from "@playwright/test";

/**
 * Repeatable cookie and browser-storage audit (docs/COOKIE_AUDIT.md).
 *
 * It records, step by step, what a visitor's browser actually receives: cookies, localStorage, sessionStorage, the
 * hosts it talks to and every Set-Cookie header. The result is attached as JSON (and printed), so the same spec can be
 * pointed at a local stack, staging or production:
 *
 *   E2E_BASE_URL=https://staging.example npx playwright test tests/cookie-audit.spec.ts
 *
 * Against a deployment that sits behind Cloudflare, set COOKIE_AUDIT_REPORT_ONLY=1 first: the spec then attaches what
 * it saw and only fails on what the privacy documents say can never happen (an analytics, advertising or tracking
 * technology). An unexpected cookie is a finding for the legal review, not a reason to hide the result.
 *
 * Steps that need a feature that is switched off (customer accounts, Turnstile) are reported as "not run" with the
 * reason; they are never reported as clean.
 */
test.use({ storageState: { cookies: [], origins: [] } });

type Snapshot = {
  step: string;
  cookies: { name: string; httpOnly: boolean; secure: boolean; sameSite: string; session: boolean }[];
  localStorage: string[];
  sessionStorage: string[];
};

const reportOnly = process.env.COOKIE_AUDIT_REPORT_ONLY === "1";
const SESSION_STORAGE_ALLOWED = new Set(["acs-quote-bar-dismissed", "acs:roi:process"]);
const TRACKING = /analytics|_ga|_gid|_fbp|_gcl|hotjar|clarity|matomo|plausible|posthog|ads|utm/i;

async function snapshot(page: Page, step: string): Promise<Snapshot> {
  const cookies = (await page.context().cookies()).map((c) => ({
    name: c.name,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    session: c.expires === -1,
  }));
  const storage = await page.evaluate(() => ({
    local: Object.keys(window.localStorage),
    session: Object.keys(window.sessionStorage),
  }));
  return { step, cookies, localStorage: storage.local, sessionStorage: storage.session };
}

test("the browser receives no cookie before interaction, only the choices made afterwards, and no third party", async ({ page }, testInfo) => {
  const hosts = new Set<string>();
  const setCookieHeaders: { url: string; names: string[] }[] = [];
  const own = new URL(testInfo.project.use.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000").host;
  page.on("request", (request) => {
    const host = new URL(request.url()).host;
    if (host && host !== own && !request.url().startsWith("data:") && !request.url().startsWith("blob:")) hosts.add(host);
  });
  page.on("response", async (response) => {
    const headers = await response.headersArray().catch(() => []);
    const names = headers
      .filter((header) => header.name.toLowerCase() === "set-cookie")
      .map((header) => header.value.split("=")[0]);
    if (names.length) setCookieHeaders.push({ url: new URL(response.url()).pathname, names });
  });

  const steps: Snapshot[] = [];

  await page.goto("/bg");
  await expect(page.getByTestId("cookie-notice")).toBeVisible();
  steps.push(await snapshot(page, "1 first visit, before any interaction (notice visible)"));

  await page.getByRole("link", { name: /^EN$|English/ }).first().click();
  await page.waitForURL(/\/en(\/|$)/);
  steps.push(await snapshot(page, "2 after choosing English with the language switcher"));

  await page.getByRole("button", { name: /Got it|Разбрах/ }).click();
  steps.push(await snapshot(page, "3 after closing the cookie notice"));

  for (const path of ["/en/contact", "/en/privacy", "/en/cookies", "/bg/uslugi", "/bg/instrumenti"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  steps.push(await snapshot(page, "4 after opening the contact, legal, services and tools pages"));

  const names = (index: number) => steps[index].cookies.map((c) => c.name).sort();
  const report = {
    base: own,
    when: new Date().toISOString(),
    steps,
    externalHosts: [...hosts],
    setCookieHeaders,
    notRun: [
      "staff sign-in cookies (run the staff step below with E2E_STAFF_PASSWORD)",
      "customer account cookies: the feature is off on this stack; check them when accounts are switched on in a safe test environment",
      "Turnstile: loads only with TURNSTILE_ENABLED=true; check its cookies and requests when it is enabled",
      "Stripe-hosted checkout: runs on Stripe's own domain and is not observable from here",
    ],
  };
  await testInfo.attach("cookie-audit.json", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  console.log("COOKIE_AUDIT " + JSON.stringify(report));

  // What the privacy documents promise can never happen, whatever the environment:
  const every = steps.flatMap((s) => s.cookies.map((c) => c.name));
  expect(every.filter((name) => TRACKING.test(name)), "an analytics, advertising or tracking cookie appeared").toEqual([]);
  for (const step of steps) {
    expect(step.localStorage, `${step.step}: localStorage must stay empty`).toEqual([]);
    for (const key of step.sessionStorage) expect(SESSION_STORAGE_ALLOWED.has(key), `unexpected sessionStorage key ${key}`).toBe(true);
  }
  if (reportOnly) return;

  // The local stack has no Cloudflare in front: the application's own behaviour, exactly.
  expect(names(0)).toEqual([]);
  expect(names(1)).toEqual(["acs_locale"]);
  expect(names(2)).toEqual(["acs_cookie_notice", "acs_locale"]);
  expect(names(3)).toEqual(["acs_cookie_notice", "acs_locale"]);
  expect([...hosts], "the pages talk only to their own origin").toEqual([]);
  expect(setCookieHeaders, "no response sets a cookie on public pages").toEqual([]);
  for (const cookie of steps[2].cookies) expect(cookie.httpOnly).toBe(false); // both are readable preferences, no secrets
});

const staffPassword = process.env.E2E_STAFF_PASSWORD ?? "";

test("staff sign-in sets exactly the session and CSRF cookies, with the documented flags", async ({ page }, testInfo) => {
  test.skip(!staffPassword, "E2E_STAFF_PASSWORD is required (scripts/test.ps1 creates the staff test account)");
  await page.goto("/admin/login");
  await page.getByLabel("Имейл").fill("e2e.viewer@example.com");
  await page.getByLabel("Парола").fill(staffPassword);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/admin(\/catalogue)?$/);
  const after = await snapshot(page, "5 after staff sign-in");
  await testInfo.attach("cookie-audit-staff.json", { body: JSON.stringify(after, null, 2), contentType: "application/json" });
  const byName = Object.fromEntries(after.cookies.map((c) => [c.name, c]));
  expect(Object.keys(byName).filter((name) => name.startsWith("acs_")).sort()).toEqual(
    expect.arrayContaining(["acs_csrf", "acs_session"]),
  );
  expect(byName.acs_session.httpOnly).toBe(true);
  expect(byName.acs_csrf.httpOnly).toBe(false); // the CSRF token is read by the page and sent as a header
  expect(byName.acs_session.sameSite).toBe("Lax");
  if (new URL(testInfo.project.use.baseURL ?? "http://localhost:3000").protocol === "https:") expect(byName.acs_session.secure).toBe(true);
  expect(after.localStorage).toEqual([]);
});
