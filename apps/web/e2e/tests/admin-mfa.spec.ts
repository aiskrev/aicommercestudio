import { createHmac } from "node:crypto";

import { expect, type Locator, type Page, test } from "@playwright/test";
import jsQR from "jsqr";

/**
 * Staff TOTP sign-in in a browser (launch blocker H-2): enrolment on the account page (QR code, key copy)
 * → password and a code → a used code is refused → a recovery code works once.
 *
 * scripts/test.ps1 creates e2e.mfa@example.com (viewer) with the per-run E2E_STAFF_PASSWORD and runs
 * `python -m app.cli reset-mfa` for it before the suite, so every run starts without a second factor.
 * ADMIN_MFA_REQUIRED stays off on the test stack: the other specs sign in with the password alone.
 */

const staffPassword = process.env.E2E_STAFF_PASSWORD ?? "";
const MFA_USER = "e2e.mfa@example.com";

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
  const wait = 30_000 - (Date.now() % 30_000) + 500;
  await new Promise((resolve) => setTimeout(resolve, wait));
  return totp(secret);
}

/** Reads a QR code the way a phone does: from the pixels on screen, so contrast and the quiet zone count. */
async function scanQr(page: Page, qr: Locator): Promise<string | undefined> {
  const png = (await qr.screenshot()).toString("base64");
  const image = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    return { width: bitmap.width, height: bitmap.height, pixels: Array.from(context.getImageData(0, 0, bitmap.width, bitmap.height).data) };
  }, png);
  return jsQR(Uint8ClampedArray.from(image.pixels), image.width, image.height)?.data;
}

async function enterPassword(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Имейл").fill(MFA_USER);
  await page.getByLabel("Парола").fill(staffPassword);
  await page.getByRole("button", { name: "Вход" }).click();
}

async function logout(page: Page) {
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === "acs_csrf")?.value ?? "";
  expect((await page.request.post("/api/admin/auth/logout", { headers: { "X-CSRF-Token": csrf } })).status()).toBe(204);
}

test.skip(!staffPassword, "E2E_STAFF_PASSWORD is required (scripts/test.ps1 creates the MFA test account)");

test("staff TOTP: enrol on the account page, sign in with password and code, replay refused, recovery code once", async ({ browser }) => {
  test.setTimeout(150_000);
  // Its own client address, so this flow does not share the per-IP login budget with the other specs.
  const octet = () => Math.floor(Math.random() * 250) + 1;
  const context = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": `10.97.${octet()}.${octet()}` } });
  const page = await context.newPage();
  // The stack is served over plain http://web:3000, where browsers offer no navigator.clipboard.
  await page.addInitScript(() => {
    const clipboard = { writeText: async (text: string) => void ((window as unknown as { copiedText: string }).copiedText = text) };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
  });
  const requests: string[] = [];
  const cspViolations: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("console", (message) => {
    if (/content security policy/i.test(message.text())) cspViolations.push(message.text());
  });

  // Without a second factor the password is enough.
  await enterPassword(page);
  await page.waitForURL(/\/admin(\/catalogue)?$/);

  // Enrolment: the key is shown, a first code switches it on, the recovery codes are shown once.
  await page.goto("/admin/account");
  const panel = page.getByTestId("mfa-panel");
  await expect(panel.getByTestId("mfa-status")).toContainText("Изключено");
  await panel.getByRole("button", { name: "Настрой двуфакторно удостоверяване" }).click();
  await panel.getByRole("button", { name: "Покажи ключа" }).click();
  const secret = (await panel.getByTestId("mfa-secret").getAttribute("data-secret")) ?? "";
  expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  await expect(panel.getByTestId("mfa-secret")).toHaveText(secret.match(/.{4}/g)!.join(" "));

  // The QR code scans to the same URI as the link, and neither it nor the key went anywhere.
  const uri = await panel.getByRole("link", { name: "Отвори в приложението за удостоверяване" }).getAttribute("href");
  expect(uri).toContain(`secret=${secret}`);
  const qr = panel.getByRole("img", { name: "QR код, който добавя ключа в приложението за удостоверяване" });
  await expect(qr).toBeVisible();
  expect(await scanQr(page, qr)).toBe(uri);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => url.includes(secret) || !url.startsWith(origin))).toEqual([]);
  expect(cspViolations).toEqual([]);

  // The copy button gives the key without the spaces of the display.
  await panel.getByRole("button", { name: "Копирай ключа без интервали" }).click();
  await expect(panel.getByRole("button", { name: "Копирано" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { copiedText: string }).copiedText)).toBe(secret);

  await panel.getByLabel("Код", { exact: true }).fill(totp(secret)); // "QR код…" is a label too
  await panel.getByRole("button", { name: "Включи" }).click();
  const list = panel.getByTestId("mfa-recovery-codes");
  await expect(list.getByRole("listitem")).toHaveCount(10);
  const codes = await list.getByRole("listitem").allTextContents();
  await expect(panel.getByRole("status")).toContainText("Двуфакторното удостоверяване е включено");
  await panel.getByRole("button", { name: "Запазих кодовете" }).click();
  await expect(panel.getByTestId("mfa-status")).toContainText("Включено от");
  await expect(panel).toContainText("Оставащи кодове за възстановяване: 10");
  await logout(page);

  // Now the password gives only a pending session: it reaches nothing but the code step.
  await enterPassword(page);
  const step = page.getByTestId("mfa-code-step");
  await expect(step).toBeVisible();
  const blocked = await page.request.get("/api/admin/auth/me");
  expect(blocked.status()).toBe(401);
  expect((await blocked.json()).code).toBe("mfa_required");

  // (Every password and code attempt counts against the per-account login limit, so the flow is lean.)
  const code = await nextCode(secret); // the enrolment code's step is already used
  await step.getByLabel("Код").fill(code);
  await step.getByRole("button", { name: "Потвърди" }).click();
  await page.waitForURL(/\/admin(\/catalogue)?$/);
  expect((await page.request.get("/api/admin/auth/me")).status()).toBe(200);
  await logout(page);

  // The same code again is a replay and is refused; a recovery code works instead.
  await enterPassword(page);
  await step.getByLabel("Код").fill(code);
  await step.getByRole("button", { name: "Потвърди" }).click();
  await expect(step.getByRole("alert")).toContainText("Кодът не е валиден");
  await step.getByLabel("Код").fill(codes[0]);
  await step.getByRole("button", { name: "Потвърди" }).click();
  await page.waitForURL(/\/admin(\/catalogue)?$/);
  await page.goto("/admin/account");
  await expect(page.getByTestId("mfa-panel")).toContainText("Оставащи кодове за възстановяване: 9");
  await logout(page);

  // Each recovery code works once; cancelling ends the pending session.
  await enterPassword(page);
  await step.getByLabel("Код").fill(codes[0]);
  await step.getByRole("button", { name: "Потвърди" }).click();
  await expect(step.getByRole("alert")).toContainText("Кодът не е валиден");
  await step.getByRole("button", { name: "Отказ" }).click();
  await expect(page.getByLabel("Парола")).toBeVisible();
  expect((await page.request.get("/api/admin/auth/me")).status()).toBe(401);
  await context.close();
});
