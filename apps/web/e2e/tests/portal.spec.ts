import { createHmac } from "node:crypto";

import { expect, type APIRequestContext, test } from "@playwright/test";

/**
 * Read-only client portal, end to end in a browser: invitation → password → TOTP enrolment →
 * sign-in with password and a second code → dashboard with the "not connected" state → isolation and
 * read-only checks → sign-out.
 *
 * The portal is switched off by default (CLIENT_PORTAL_ENABLED=false) and must not be released
 * without explicit approval, so this spec skips itself while the portal API answers 404. It runs
 * against a test stack started with the portal on and a non-demo organisation `e2e-portal`
 * (docs/CLIENT_PORTAL.md → "End-to-end test").
 */

const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const CLIENT_PASSWORD = "Client-Portal-E2e-2026";

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) from a base32 secret. */
function totp(secret: string, at = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, "0");
}

/** A code from the next 30-second step (each step is accepted only once: no replay). */
async function nextCode(secret: string): Promise<string> {
  const now = Date.now();
  const wait = 30_000 - (now % 30_000) + 500;
  await new Promise((resolve) => setTimeout(resolve, wait));
  return totp(secret);
}

async function staffSession(request: APIRequestContext): Promise<Record<string, string>> {
  const login = await request.post("/api/admin/auth/login", { data: { email, password } });
  expect(login.status()).toBe(200);
  const csrf = (await request.storageState()).cookies.find((c) => c.name === "acs_csrf")?.value ?? "";
  return { "X-CSRF-Token": csrf };
}

test.describe("client portal (enabled test stack only)", () => {
  test.skip(!email || !password, "ADMIN_BOOTSTRAP_EMAIL/PASSWORD not provided");

  test("invitation, activation with TOTP, sign-in, read-only dashboard, isolation and sign-out", async ({ page, request, playwright }) => {
    test.setTimeout(150_000);
    const probe = await request.get("/api/portal/me");
    test.skip(probe.status() === 404, "the client portal is switched off (CLIENT_PORTAL_ENABLED=false)");

    // Staff side: invite a client user into the non-demo test organisation.
    const headers = await staffSession(request);
    const orgs = (await (await request.get("/api/ops/organizations")).json()) as { id: string; slug: string; is_demo: boolean }[];
    const org = orgs.find((o) => o.slug === "e2e-portal");
    test.skip(!org, "organisation e2e-portal not created for this run");
    const demo = orgs.find((o) => o.is_demo);
    const clientEmail = `client.${Date.now()}@example.com`;
    const invite = await request.post(`/api/ops/organizations/${org!.id}/portal-users`, {
      headers,
      data: { email: clientEmail, full_name: "E2E Client" },
    });
    expect(invite.status()).toBe(201);
    const { path } = (await invite.json()) as { path: string };
    expect(path).toMatch(/^\/portal\/activate#/);
    if (demo) {
      const refused = await request.post(`/api/ops/organizations/${demo.id}/portal-users`, { headers, data: { email: `demo.${Date.now()}@example.com`, full_name: "Demo Client" } });
      expect(refused.status()).toBe(409); // no client access to demo organisations
    }

    // Client side, in a browser with no staff cookies.
    await page.goto(path);
    await expect(page).toHaveURL(/\/portal\/activate$/); // the token left the address bar
    const enrolment = page.getByTestId("portal-enrolment");
    await enrolment.getByLabel(/^(Парола|Password)/).fill(CLIENT_PASSWORD);
    await enrolment.getByRole("button", { name: /^(Задай парола|Set password)$/ }).click();
    const secret = (await page.getByTestId("portal-secret").textContent())!.trim();
    await enrolment.getByLabel(/^(Код|Code)/).fill(totp(secret));
    await enrolment.getByRole("button", { name: /^(Потвърди и активирай|Confirm and activate)$/ }).click();
    await expect(enrolment.getByRole("status")).toBeVisible();

    // Password, then a fresh code (the enrolment step cannot be replayed).
    await page.goto("/portal");
    const login = page.getByTestId("portal-login");
    await login.getByLabel(/^(Имейл|E-mail)/).fill(clientEmail);
    await login.getByLabel(/^(Парола|Password)/).fill(CLIENT_PASSWORD);
    await login.getByRole("button", { name: /^(Вход|Sign in)$/ }).click();
    const mfa = page.getByTestId("portal-mfa");
    await expect(mfa).toBeVisible();
    await mfa.getByLabel(/^(Код|Code)/).fill(await nextCode(secret));
    await mfa.getByRole("button", { name: /^(Потвърди|Verify)$/ }).click();

    await expect(page.getByTestId("portal-organization")).toBeVisible();
    await expect(page.getByTestId("portal-not-connected")).toBeVisible();

    // The client session: tenant from the session only, read-only, no staff or Ops access.
    const client = page.request;
    const me = await (await client.get("/api/portal/me")).json();
    expect(me.email).toBe(clientEmail);
    const own = await (await client.get("/api/portal/dashboard")).json();
    if (demo) {
      const other = await (await client.get(`/api/portal/dashboard?organization_id=${demo.id}`)).json();
      expect(other).toEqual(own); // a query parameter never selects another tenant
    }
    expect((await client.post("/api/portal/agents", { data: {} })).status()).toBe(405);
    expect((await client.get("/api/admin/leads")).status()).toBe(401);
    expect((await client.get("/api/ops/organizations")).status()).toBe(401);

    // Sign-out revokes the session.
    await page.getByRole("button", { name: /^(Изход|Sign out)$/ }).click();
    await expect(page.getByTestId("portal-login")).toBeVisible();
    expect((await client.get("/api/portal/me")).status()).toBe(401);

    // An anonymous request never sees portal data.
    const anonymous = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });
    expect((await anonymous.get("/api/portal/dashboard")).status()).toBe(401);
    await anonymous.dispose();
  });
});
