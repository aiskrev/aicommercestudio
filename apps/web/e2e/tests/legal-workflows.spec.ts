import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";

/**
 * Browser tests of the legal workflows on a stack with customer accounts and billing routes switched ON and no Stripe
 * (scripts/test-legal-e2e.ps1 starts it with docker-compose.legal-e2e.yml and seeds synthetic accounts):
 * order review, withdrawal, data rights, deletion safety, marketing consent. Nothing is paid and nothing reaches Stripe:
 * the redirect to Stripe is intercepted. Server rules are exercised for real (acceptance versions, duplicates,
 * authorization, deletion gates); the API is only replaced for the final Stripe redirect.
 */
const PASSWORD = process.env.E2E_ACCOUNT_PASSWORD ?? "";
const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const email = (name: string) => `${name}.legal-e2e@example.com`;

test.describe.configure({ mode: "serial" });
test.skip(process.env.E2E_LEGAL_STACK !== "1" || !PASSWORD, "needs the legal e2e stack (scripts/test-legal-e2e.ps1)");

async function signIn(browser: Browser, name: string, path = "/bg/konto/abonamenti"): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/bg/konto/vhod");
  await page.getByLabel("Имейл", { exact: true }).fill(email(name));
  await page.getByLabel("Парола").fill(PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/bg\/konto$/);
  await page.goto(path);
  return page;
}

async function csrf(page: Page): Promise<string> {
  return (await page.context().cookies()).find((cookie) => cookie.name === "acs_account_csrf")?.value ?? "";
}

async function staff(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/admin/login");
  await page.getByLabel("Имейл").fill(ADMIN_EMAIL);
  await page.getByLabel("Парола").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/admin$/);
  return page;
}

async function staffCsrf(page: Page): Promise<string> {
  return (await page.context().cookies()).find((cookie) => cookie.name === "acs_csrf")?.value ?? "";
}

// ---------------------------------------------------------------------------------------------- order review

test.describe("order review (BG)", () => {
  test("shows the seller, the price, the currency and the renewal, with nothing accepted in advance", async ({ browser }) => {
    const page = await signIn(browser, "shopper");
    const posts: string[] = [];
    page.on("request", (request) => request.method() === "POST" && request.url().includes("/api/billing/checkout") && posts.push(request.url()));

    await page.getByRole("button", { name: "Преглед на поръчката" }).click();
    const review = page.getByTestId("order-review");
    await expect(review).toBeVisible();
    const seller = page.getByTestId("order-seller");
    await expect(seller).toContainText("„ИСКРЕВ КОНСУЛТИНГ“ ЕООД");
    await expect(seller).toContainText("207509557");
    await expect(seller).toContainText("София");
    await expect(seller).toContainText("+359 882 377 753");
    await expect(seller.getByRole("link", { name: /@/ })).toBeVisible();
    await expect(review).toContainText("29,00");
    await expect(review).toContainText("евро (EUR)");
    await expect(review).toContainText("месец");
    await expect(review).toContainText("подновява автоматично");
    await expect(review.getByRole("link", { name: "Общите условия" })).toHaveAttribute("href", "/bg/obshti-usloviya");
    await expect(review.getByRole("link", { name: "Условията за абонамент и плащане" })).toHaveAttribute("href", "/bg/usloviya-za-abonament");
    await expect(review.getByRole("link", { name: "Политиката за поверителност" })).toHaveAttribute("href", "/bg/poveritelnost");

    const accept = review.getByRole("checkbox", { name: /Прочетох и приемам Общите условия и Условията за абонамент и плащане/ });
    await expect(accept).not.toBeChecked();
    await expect(review.getByRole("checkbox", { name: /Изрично искам услугата да започне/ })).toHaveCount(0);

    // Cannot proceed without a customer type and acceptance: errors, and no request leaves the browser.
    await review.getByRole("button", { name: "Поръчвам с оторизиране на плащането" }).click();
    await expect(review.getByText("Изберете как купувате.")).toBeVisible();
    await expect(review.getByText(/За да поръчате, потвърдете/)).toBeVisible();
    expect(posts).toEqual([]);

    // Consumer: the early-start request appears, separate and unticked. Business: it disappears.
    await review.getByRole("radio", { name: /Потребител/ }).check();
    const early = review.getByRole("checkbox", { name: /Изрично искам услугата да започне/ });
    await expect(early).toBeVisible();
    await expect(early).not.toBeChecked();
    await review.getByRole("radio", { name: /Бизнес клиент/ }).check();
    await expect(early).toHaveCount(0);
    await page.context().close();
  });

  test("the server refuses a missing acceptance and a stale version; the browser shows it and starts no payment", async ({ browser }) => {
    const page = await signIn(browser, "shopper");
    const token = await csrf(page);
    const headers = { "X-CSRF-Token": token };
    expect((await page.request.post("/api/billing/checkout", { data: { offer: "pro_monthly" }, headers })).status()).toBe(422);
    const stale = await page.request.post("/api/billing/checkout", {
      data: {
        offer: "pro_monthly",
        acceptance: { terms: "2020-01-01", subscription_terms: "2020-01-01", order_acceptance: "2020-01-01", privacy: "2020-01-01", customer_kind: "consumer" },
      },
      headers,
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).code).toBe("terms_version_changed");

    // The same through the page: a stale version in the request is turned into an explanation, not into a payment.
    await page.route("**/api/billing/checkout", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      body.acceptance.terms = "2020-01-01";
      await route.continue({ postData: JSON.stringify(body) });
    });
    let redirected = false;
    page.on("framenavigated", (frame) => frame === page.mainFrame() && frame.url().includes("/payment") && (redirected = true));
    await page.getByRole("button", { name: "Преглед на поръчката" }).click();
    const review = page.getByTestId("order-review");
    await review.getByRole("radio", { name: /Потребител/ }).check();
    await review.getByRole("checkbox", { name: /Прочетох и приемам/ }).check();
    await review.getByRole("button", { name: "Поръчвам с оторизиране на плащането" }).click();
    await expect(review.getByText(/Условията са променени/)).toBeVisible();
    expect(redirected).toBe(false);
    await page.context().close();
  });

  test("a valid order sends the accepted versions, goes to the payment page once, and a double click cannot start two", async ({ browser }) => {
    const page = await signIn(browser, "shopper");
    const bodies: Record<string, unknown>[] = [];
    await page.route("**/api/billing/checkout", async (route) => {
      bodies.push(JSON.parse(route.request().postData() ?? "{}"));
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "/bg/konto/advisor/payment?intercepted=1", reused: false }) });
    });
    await page.getByRole("button", { name: "Преглед на поръчката" }).click();
    const review = page.getByTestId("order-review");
    await review.getByRole("radio", { name: /Потребител/ }).check();
    await review.getByRole("checkbox", { name: /Прочетох и приемам/ }).check();
    await review.getByRole("button", { name: "Поръчвам с оторизиране на плащането" }).dblclick();
    await page.waitForURL(/payment\?intercepted=1/);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({
      offer: "pro_monthly",
      locale: "bg",
      acceptance: { customer_kind: "consumer", early_start: false, early_start_version: null },
    });
    for (const key of ["terms", "subscription_terms", "order_acceptance", "privacy"]) {
      expect((bodies[0].acceptance as Record<string, string>)[key]).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
    await page.context().close();
  });
});

test("order review (EN): seller, currency, renewal and the English button", async ({ browser }) => {
  const page = await signIn(browser, "shopper", "/en/account/subscriptions");
  await page.getByRole("button", { name: "Review order" }).click();
  const review = page.getByTestId("order-review");
  await expect(review.getByTestId("order-seller")).toContainText("ISKREV CONSULTING");
  await expect(review.getByTestId("order-seller")).toContainText("207509557");
  await expect(review).toContainText("The price is in euro (EUR).");
  await expect(review).toContainText("renews automatically every month");
  await expect(review.getByRole("button", { name: "Order with payment obligation" })).toBeVisible();
  await expect(review.getByRole("checkbox", { name: /I have read and accept the Terms of Use and the Subscription and Payment Terms/ })).not.toBeChecked();
  await expect(review.getByRole("link", { name: "Terms of Use" })).toHaveAttribute("href", "/en/terms");
  await page.context().close();
});

// ------------------------------------------------------------------------------------------------ withdrawal

const SCENARIOS = [
  { account: "consumer", expected: "Първа оценка: покупката е в срока за отказ." },
  { account: "business", expected: "бизнес клиент" },
  { account: "expired", expected: "срокът за отказ е изтекъл" },
  { account: "unknown", expected: "Датата на сключване не е ясна" },
] as const;

test.describe("withdrawal from the contract (BG)", () => {
  const references: Record<string, string> = {};

  for (const scenario of SCENARIOS) {
    test(`${scenario.account}: two steps, a unique reference, a queued confirmation, no refund`, async ({ browser }) => {
      const page = await signIn(browser, scenario.account);
      await expect(page.getByRole("button", { name: "Управление на абонамента" })).toBeVisible(); // cancelling is separate
      const section = page.getByTestId("withdrawal");
      await section.getByRole("button", { name: "Откажете се от договора тук" }).click();
      await expect(section.getByText(new RegExp(scenario.expected))).toBeVisible();
      await expect(section.getByText(/Оценката е предварителна/)).toBeVisible();
      await section.getByLabel("Вашето изявление").fill("Недвусмислено заявявам, че се отказвам от договора.");
      await section.getByRole("button", { name: "Продължете към потвърждение" }).click();
      await expect(section.getByText("Недвусмислено заявявам, че се отказвам от договора.")).toBeVisible();
      await expect(section.getByTestId("withdrawal-recipient")).toContainText(email(scenario.account));
      await section.getByRole("button", { name: "Потвърждавам отказа" }).click();
      const reference = await section.getByTestId("withdrawal-reference").innerText();
      expect(reference).toMatch(/^W-\d{8}-[A-Z0-9]{6}$/);
      references[scenario.account] = reference;
      await expect(section).toContainText("Получихме изявлението ви за отказ.");
      expect(await section.innerText()).not.toMatch(/върнат|възстановен/i); // nothing is refunded by this step

      const list = await (await page.request.get("/api/billing/withdrawals")).json();
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ reference, status: "received", refund_reference: null, refund_amount_minor: null });
      expect(list[0].confirmation_queued_at).not.toBeNull(); // the confirmation message was created (durable medium)
      await page.context().close();
    });
  }

  test("a repeat shows the open request instead of a second button, and the API returns the same reference", async ({ browser }) => {
    const page = await signIn(browser, "consumer");
    const section = page.getByTestId("withdrawal");
    await expect(section).toContainText(references.consumer);
    await expect(section.getByRole("button", { name: "Откажете се от договора тук" })).toHaveCount(0);
    const again = await page.request.post("/api/billing/withdrawals", {
      data: { ref: "sub_e2e_consumer", statement: "Повторно изявление за същия договор.", locale: "bg", confirmed: true },
      headers: { "X-CSRF-Token": await csrf(page) },
    });
    expect(again.status()).toBe(200);
    expect(await again.json()).toMatchObject({ reference: references.consumer, created: false });
    await page.context().close();
  });

  test("another account cannot name this contract", async ({ browser }) => {
    const page = await signIn(browser, "rights2");
    const named = await page.request.post("/api/billing/withdrawals/preview", {
      data: { ref: "sub_e2e_consumer" },
      headers: { "X-CSRF-Token": await csrf(page) },
    });
    expect(named.status()).toBe(404);
    await page.context().close();
  });

  test("staff see the request, decide it by hand and record the refund reference themselves", async ({ browser }) => {
    const page = await staff(browser);
    await page.goto("/admin/compliance");
    const table = page.getByTestId("withdrawal-list");
    await expect(table).toContainText(references.consumer);
    expect(await table.innerText()).not.toContain("Недвусмислено"); // the list holds no statement
    await table.getByRole("button", { name: new RegExp(`Отвори ${references.consumer}`) }).click();
    const detail = page.getByTestId("withdrawal-detail");
    await expect(detail).toContainText("Недвусмислено заявявам");
    await expect(detail).toContainText("consumer.legal-e2e@example.com");
    await expect(detail).toContainText("Поискано започване в срока");
    await expect(page.getByTestId("audit-trail")).toContainText("billing.withdrawal_received");
    await expect(page.getByText(/Връщането на суми се прави ръчно в Stripe/)).toBeVisible();
    await page.locator("select#decision").selectOption("refund_review");
    await page.getByRole("button", { name: "Запиши решение" }).click();
    await expect(page.getByText("Записано.")).toBeVisible();
    await expect(page.getByTestId("audit-trail")).toContainText("billing.withdrawal_decided");
    await page.locator("select#decision").selectOption("refunded");
    await page.getByRole("button", { name: "Запиши решение" }).click(); // without a reference: refused
    await expect(page.getByTestId("withdrawal-detail").getByRole("alert")).toBeVisible();
    await page.context().close();
  });
});

// --------------------------------------------------------------------------------------------------- data rights

test.describe("data rights (BG)", () => {
  const references: Record<string, string> = {};

  test("each kind of request gets a reference, a repeat returns it, and nothing is deleted by asking", async ({ browser }) => {
    const page = await signIn(browser, "rights", "/bg/konto/sigurnost");
    const section = page.getByTestId("account-data");
    for (const [value, label] of [
      ["correction", "Корекция на данни"],
      ["restriction", "Ограничаване на обработването"],
      ["objection", "Възражение срещу обработването"],
      ["deletion", "Изтриване на акаунта и данните"],
    ] as const) {
      await section.getByLabel("Вид искане").selectOption(value);
      await section.getByRole("button", { name: "Изпратете искането" }).click();
      const message = section.getByText(/Искането е получено\. Референтен номер: D-/);
      await expect(message).toBeVisible();
      references[value] = ((await message.innerText()).match(/D-\d{8}-[A-Z0-9]{6}/) ?? [""])[0];
      await expect(section.getByText(label).last()).toBeVisible();
    }
    expect(new Set(Object.values(references)).size).toBe(4);
    await section.getByLabel("Вид искане").selectOption("correction");
    await section.getByRole("button", { name: "Изпратете искането" }).click();
    await expect(section.getByText(new RegExp(`Вече има отворено искане от този вид\\. Референтен номер: ${references.correction}`))).toBeVisible();
    await section.getByLabel("Вид искане").selectOption("deletion"); // the note about staff-executed deletion shows for this kind
    await expect(section).toContainText("Изтриването се извършва от служител, не веднага");
    expect(await section.innerText()).not.toMatch(/акаунтът е изтрит/i);
    await page.context().close();
  });

  test("the export downloads the person's own data and no secrets", async ({ browser }) => {
    const page = await signIn(browser, "rights", "/bg/konto/sigurnost");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("account-data").getByRole("button", { name: "Изтеглете данните си (JSON)" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("account-data.json");
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString("utf-8");
    const data = JSON.parse(text);
    expect(data.account.email).toBe(email("rights"));
    expect(data.consent_history.length).toBeGreaterThan(0);
    for (const secret of ["password_hash", "token_hash", "csrf_hash", "$argon", "$2b$"]) expect(text.toLowerCase()).not.toContain(secret);
    await page.context().close();
  });

  test("another account sees none of these requests, and anonymous callers are refused", async ({ browser, request }) => {
    const page = await signIn(browser, "rights2", "/bg/konto/sigurnost");
    expect(await (await page.request.get("/api/accounts/data/requests")).json()).toEqual([]);
    await expect(page.getByTestId("account-data")).not.toContainText(references.correction);
    await page.context().close();
    expect((await request.get("/api/accounts/data/export")).status()).toBe(401);
    expect((await request.post("/api/accounts/data/requests", { data: { kind: "deletion" } })).status()).toBe(401);
  });

  test("an account holder withdraws marketing consent in the profile and the history shows it", async ({ browser }) => {
    const page = await signIn(browser, "rights", "/bg/konto/sigurnost");
    const consent = page.getByRole("checkbox", { name: /Желая да получавам новини/ });
    await expect(consent).not.toBeChecked();
    await consent.check();
    await page.getByRole("button", { name: "Запази" }).click();
    await expect(page.getByText("Промените са запазени.")).toBeVisible();
    await consent.uncheck();
    await page.getByRole("button", { name: "Запази" }).click();
    await expect(page.getByText("Промените са запазени.")).toBeVisible();
    const data = await (await page.request.get("/api/accounts/data/export")).json();
    const actions = data.consent_history.map((e: { action: string }) => e.action);
    expect(actions[0]).toBe("acknowledged");
    expect(actions.slice(-2)).toEqual(["consented", "withdrawn"]); // earlier runs on the same synthetic account add pairs before these
    await page.context().close();
  });
});

// ------------------------------------------------------------------------------------------------ deletion safety

test.describe("deletion safety (staff)", () => {
  async function requestDeletion(browser: Browser, name: string) {
    const page = await signIn(browser, name, "/bg/konto");
    const response = await page.request.post("/api/accounts/data/requests", { data: { kind: "deletion" }, headers: { "X-CSRF-Token": await csrf(page) } });
    expect(response.status()).toBe(202);
    const { reference } = await response.json();
    await page.context().close();
    return reference as string;
  }

  async function openRequest(staffPage: Page, reference: string) {
    await staffPage.goto("/admin/compliance");
    await staffPage.getByRole("tab", { name: "Искания за данни" }).click();
    await staffPage.getByTestId("data-request-list").getByRole("button", { name: new RegExp(`Отвори ${reference}`) }).click();
    return staffPage.getByTestId("data-request-detail");
  }

  for (const [name, blocker] of [
    ["pastdue", "неуспешно плащане по абонамент"],
    ["ending", "абонаментът свършва в края на периода"],
    ["opencheckout", "има отворена поръчка за плащане"],
  ] as const) {
    test(`${name}: deletion and anonymisation stay blocked and nothing changes`, async ({ browser }) => {
      const reference = await requestDeletion(browser, name);
      const page = await staff(browser);
      const detail = await openRequest(page, reference);
      await expect(page.getByTestId("deletion-blockers")).toContainText(blocker);
      await page.getByLabel("Потвърждавам изпълнението на изтриването").check();
      await expect(page.getByRole("button", { name: "Изпълни изтриване" })).toBeDisabled();
      // The server refuses as well, whatever the page does.
      const forced = await page.request.post(`/api/admin/compliance/data-requests/${await requestId(page, reference)}/handle`, {
        data: { action: "execute_deletion", stripe_checked: true },
        headers: { "X-CSRF-Token": await staffCsrf(page) },
      });
      expect(forced.status()).toBe(409);
      await expect(detail).toContainText("отворена");
      await page.context().close();
      // The account still signs in.
      const again = await signIn(browser, name, "/bg/konto/sigurnost");
      await expect(again.getByTestId("account-data")).toBeVisible();
      await again.context().close();
    });
  }

  test("plain: an account with no financial records is deleted after staff confirm", async ({ browser }) => {
    const reference = await requestDeletion(browser, "plain");
    const page = await staff(browser);
    const detail = await openRequest(page, reference);
    await expect(page.getByText("Локалното състояние на плащанията позволява изпълнение.")).toBeVisible();
    await expect(page.getByLabel(/Проверих клиента в Stripe/)).toHaveCount(0); // no Stripe customer exists
    await page.getByLabel("Потвърждавам изпълнението на изтриването").check();
    await page.getByRole("button", { name: "Изпълни изтриване" }).click();
    await expect(page.getByText("Записано.")).toBeVisible();
    await expect(detail).toContainText("deleted");
    await page.context().close();
    const gone = await (await browser.newContext()).newPage();
    await gone.goto("/bg/konto/vhod");
    await gone.getByLabel("Имейл", { exact: true }).fill(email("plain"));
    await gone.getByLabel("Парола").fill(PASSWORD);
    await gone.getByRole("button", { name: "Вход" }).click();
    await expect(gone.getByRole("alert")).toBeVisible();
    await gone.context().close();
  });

  test("canceled: needs the Stripe attestation, then the account is anonymised and its records stay", async ({ browser }) => {
    const reference = await requestDeletion(browser, "canceled");
    const page = await staff(browser);
    const detail = await openRequest(page, reference);
    await expect(page.getByText(/Има клиент в Stripe: потвърдете, че сте го проверили\./)).toBeVisible();
    await page.getByLabel("Потвърждавам изпълнението на изтриването").check();
    await page.getByRole("button", { name: "Изпълни изтриване" }).click(); // without the attestation: refused by the server
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel(/Проверих клиента в Stripe/).check();
    await page.getByRole("button", { name: "Изпълни изтриване" }).click();
    await expect(page.getByText("Записано.")).toBeVisible();
    await expect(detail).toContainText("anonymized");
    await page.context().close();
  });
});

async function requestId(page: Page, reference: string): Promise<string> {
  const rows = await (await page.request.get("/api/admin/compliance/data-requests")).json();
  return rows.find((row: { reference: string }) => row.reference === reference).id;
}

// ----------------------------------------------------------------------------------------------- marketing consent

async function submitContact(page: Page, address: string, marketing: boolean, lang: "bg" | "en") {
  const text =
    lang === "bg"
      ? { path: "/bg/kontakti?usluga=automation", name: /Име и фамилия/, company: /^Фирма/, email: /^Имейл/, message: /Описание на проекта/, privacy: /Запознах се с Политиката за поверителност/, marketing: /Желая да получавам новини/, submit: "Изпратете запитването" }
      : { path: "/en/contact?service=automation", name: /Full name/, company: /^Company/, email: /^Email/, message: /Project description/, privacy: /I have read the Privacy Policy/, marketing: /I would like to receive news/, submit: "Send inquiry" };
  await page.goto(text.path);
  await page.getByLabel(text.name).fill("E2E Съгласие");
  await page.getByLabel(text.company).fill(`E2E Съгласие ${Date.now()}`);
  await page.locator("#contact-email").fill(address); // the footer has a mailto link whose label also starts with the word e-mail
  await page.getByLabel(text.message).fill("Автоматизиран E2E тест на съгласието за маркетинг и неговото оттегляне.");
  const consent = page.getByRole("checkbox", { name: text.marketing });
  await expect(consent).not.toBeChecked(); // optional and never preselected
  if (marketing) await consent.check();
  await page.getByRole("checkbox", { name: text.privacy }).check();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: text.submit }).click();
  await expect(page.getByTestId("contact-success")).toBeVisible();
}

async function leadIdOf(page: Page, address: string): Promise<string> {
  const list = await (await page.request.get(`/api/admin/leads?q=${encodeURIComponent(address)}`)).json();
  const items = Array.isArray(list) ? list : list.items;
  return items[0].id;
}

test.describe("marketing consent of an inquiry", () => {
  const stamp = Date.now();
  const withConsent = `consent.${stamp}@example.com`;
  const withoutConsent = `noconsent.${stamp}@example.com`;
  const english = `consent.en.${stamp}@example.com`;

  test("an inquiry works without marketing consent and records only the privacy acknowledgement", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await submitContact(page, withoutConsent, false, "bg");
    const admin = await staff(browser);
    const history = await (await admin.request.get(`/api/admin/compliance/leads/${await leadIdOf(admin, withoutConsent)}/consent-history`)).json();
    expect(history.map((e: { document: string; action: string }) => `${e.document}:${e.action}`)).toEqual(["privacy:acknowledged"]);
    await admin.context().close();
    await page.context().close();
  });

  test("with marketing consent the history holds the versioned consent; staff mint a link and the person withdraws it (BG)", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await submitContact(page, withConsent, true, "bg");
    const admin = await staff(browser);
    const id = await leadIdOf(admin, withConsent);
    const headers = { "X-CSRF-Token": await staffCsrf(admin) };
    let history = await (await admin.request.get(`/api/admin/compliance/leads/${id}/consent-history`)).json();
    expect(history.map((e: { document: string; action: string }) => `${e.document}:${e.action}`)).toEqual(["privacy:acknowledged", "marketing_consent:consented"]);
    expect(history[1].version).toMatch(/^\d{4}-\d{2}-\d{2}/);

    const link = (await (await admin.request.post(`/api/admin/compliance/leads/${id}/marketing-withdrawal-link?locale=bg`, { headers })).json()).url as string;
    expect(link).toContain("/bg/otkaz-ot-marketing#token=");
    expect(link).not.toContain(id);
    expect(link).not.toContain("@");
    const path = link.slice(link.indexOf("/bg/"));

    const opened = await (await browser.newContext()).newPage();
    const posts: string[] = [];
    opened.on("request", (request) => request.method() === "POST" && posts.push(request.url()));
    await opened.goto(path);
    await expect(opened.getByRole("heading", { level: 1 })).toContainText("Оттегляне на съгласието");
    expect(posts).toEqual([]); // opening the link changes nothing
    await expect(opened.getByRole("button", { name: "Оттеглям съгласието си" })).toBeVisible();
    await expect.poll(() => opened.url()).not.toContain("token"); // the token left the address bar
    await opened.getByRole("button", { name: "Оттеглям съгласието си" }).click();
    await expect(opened.getByText("Съгласието е оттеглено")).toBeVisible();

    history = await (await admin.request.get(`/api/admin/compliance/leads/${id}/consent-history`)).json();
    expect(history.map((e: { action: string }) => e.action)).toEqual(["acknowledged", "consented", "withdrawn"]);
    expect(history[2]).toMatchObject({ document: "marketing_consent", source: "self_service" });

    // Already withdrawn, an invalid link and a tampered one.
    const again = await (await browser.newContext()).newPage();
    await again.goto(path);
    await again.getByRole("button", { name: "Оттеглям съгласието си" }).click();
    await expect(again.getByText("Съгласието вече е оттеглено")).toBeVisible();
    const tampered = await (await browser.newContext()).newPage();
    await tampered.goto("/bg/otkaz-ot-marketing#token=" + "0".repeat(64));
    await tampered.getByRole("button", { name: "Оттеглям съгласието си" }).click();
    await expect(tampered.getByText("Невалиден или изтекъл линк")).toBeVisible();
    const missing = await (await browser.newContext()).newPage();
    await missing.goto("/bg/otkaz-ot-marketing");
    await expect(missing.getByText("Невалиден или изтекъл линк")).toBeVisible();
    for (const extra of [again, tampered, missing, opened, admin, page]) await extra.context().close();
  });

  test("the English page and form work the same way", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await submitContact(page, english, true, "en");
    const admin = await staff(browser);
    const id = await leadIdOf(admin, english);
    const link = (await (await admin.request.post(`/api/admin/compliance/leads/${id}/marketing-withdrawal-link?locale=en`, { headers: { "X-CSRF-Token": await staffCsrf(admin) } })).json()).url as string;
    expect(link).toContain("/en/marketing-opt-out#token=");
    const opened = await (await browser.newContext()).newPage();
    await opened.goto(link.slice(link.indexOf("/en/")));
    await expect(opened.getByRole("heading", { level: 1 })).toContainText("Withdraw your consent");
    await opened.getByRole("button", { name: "Withdraw my consent" }).click();
    await expect(opened.getByText("Consent withdrawn")).toBeVisible();
    const robots = await opened.locator("meta[name='robots']").evaluateAll((els) => els.map((el) => el.getAttribute("content") ?? ""));
    expect(robots.join(" ")).toContain("noindex");
    for (const extra of [opened, admin, page]) await extra.context().close();
  });
});

test.describe("withdrawal stays reachable when the shared workspace limit is used up", () => {
  test("the plan list is throttled, the withdrawal function is not", async ({ browser }) => {
    const page = await signIn(browser, "layout");
    // The shared per-workspace limit answers 429 for the ordinary billing routes (simulated here; the API test proves
    // the real limit no longer applies to the withdrawal routes).
    await page.route("**/api/billing/offers", (route) => route.fulfill({ status: 429, headers: { "Retry-After": "40" }, body: JSON.stringify({ code: "rate_limited" }) }));
    await page.route("**/api/billing/status", (route) => route.fulfill({ status: 429, headers: { "Retry-After": "40" }, body: JSON.stringify({ code: "rate_limited" }) }));
    await page.reload();
    await expect(page.getByRole("button", { name: "Откажете се от договора тук" })).toBeVisible();
    await page.context().close();
  });

  test("if the withdrawal data itself is throttled, the section stays with the retry time and an e-mail alternative", async ({ browser }) => {
    const page = await signIn(browser, "layout");
    await page.route("**/api/billing/contracts", (route) => route.fulfill({ status: 429, headers: { "Retry-After": "25" }, body: JSON.stringify({ code: "rate_limited", detail: "Too many." }) }));
    await page.reload();
    const notice = page.getByTestId("withdrawal-unavailable");
    await expect(notice).toContainText("след 25 с");
    await expect(notice).toContainText("@");
    await page.unroute("**/api/billing/contracts");
    await page.getByTestId("withdrawal").getByRole("button", { name: "Опитайте отново" }).click();
    await expect(page.getByRole("button", { name: "Откажете се от договора тук" })).toBeVisible();
    await page.context().close();
  });
});

export type { APIRequestContext };
