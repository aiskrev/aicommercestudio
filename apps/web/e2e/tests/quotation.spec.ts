import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

// Customer-facing quotation (/bg/oferta ↔ /en/quotation) and the staff panel that publishes it. Off by default: the
// first block runs on the default stack; the rest needs the commercial test stack (scripts/test-commercial-e2e.ps1).
const commercial = process.env.E2E_COMMERCIAL_STACK === "1";
const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const VERSION = "2026-11.1";

const COMPLETE = {
  scope: "Нов бизнес сайт с форма за запитване, изграден по писмен обхват.",
  deliverables: ["Работещ сайт в реалната среда", "Документация и инструкции за редакция"],
  assumptions: ["Съдържанието идва от клиента."],
  exclusions: ["Онлайн магазин и плащания."],
  dependencies: ["Достъп до домейна."],
  responsibilities: [{ party: "client", item: "Определя отговорник за проекта." }],
  acceptance_criteria: ["Приемателен списък, минат заедно."],
  milestones: [{ title: "Структура и прототип", description: "Показваме ключовите екрани.", indicative_timing: "уточнява се" }],
  risks: [{ risk: "Закъснение на съдържанието", mitigation: "Съгласуваме датите предварително." }],
  commercial: { pricing_basis: "Фиксирана цена за описания обхват, записана от човек.", payment_terms: "По договор.", validity: "", notes: "" },
};

const ANSWERS = {
  project_type: "business_website",
  pages: "up_to_5",
  products: "none",
  languages: "one",
  build: "new",
  content_migration: false,
  store_migration: false,
  features: ["seo"],
  branding: "existing",
  design_level: "standard",
  accessibility: false,
  interactive_elements: false,
  operations: [],
  timeline: "flexible",
  budget_range: "undisclosed",
};

/** Signs in as staff through the API (the session and CSRF cookies live in the request context). */
async function staffLogin(request: APIRequestContext): Promise<Record<string, string>> {
  const login = await request.post("/api/admin/auth/login", { data: { email, password } });
  expect(login.status(), "staff sign-in").toBe(200);
  const cookies = (await request.storageState()).cookies;
  const csrf = cookies.find((cookie) => cookie.name === "acs_csrf")?.value ?? "";
  expect(csrf).not.toBe("");
  return { "X-CSRF-Token": csrf };
}

/** A configured enquiry and an approved, human-completed proposal for it. Returns what the specs need. */
async function approvedProposal(request: APIRequestContext, company: string) {
  const token = (await (await request.get("/api/public/form-token")).json()).token as string;
  const submitted = await request.post("/api/public/configurator/submissions", {
    data: {
      model_version: VERSION,
      answers: ANSWERS,
      submission_id: crypto.randomUUID(),
      locale: "bg",
      name: "E2E Оферта",
      email: `quotation.e2e.${Date.now()}@example.com`,
      company,
      privacy_acknowledged: true,
      form_token: token,
    },
  });
  expect(submitted.status()).toBe(201);
  const headers = await staffLogin(request);
  const list = (await (await request.get("/api/admin/leads")).json()) as { items: { id: string; company: string }[] };
  const lead = list.items.find((item) => item.company === company)!.id;
  const created = await request.post(`/api/admin/leads/${lead}/proposals`, { headers, data: { kind: "proposal", title: "Оферта за нов сайт", content: COMPLETE } });
  expect(created.status()).toBe(201);
  let proposal = await created.json();
  for (const [action, extra] of [["submit", {}], ["approve", { note: "Прегледана", acknowledge_warnings: true }]] as const) {
    const moved = await request.post(`/api/admin/leads/${lead}/proposals/${proposal.id}/transition`, { headers, data: { action, expected_revision: proposal.revision, ...extra } });
    expect(moved.status(), action).toBe(200);
    proposal = await moved.json();
  }
  return { lead, proposal, headers };
}

async function publish(request: APIRequestContext, lead: string, proposal: { id: string; revision: number }, headers: Record<string, string>, data: object = {}) {
  const response = await request.post(`/api/admin/leads/${lead}/proposals/${proposal.id}/quotation`, { headers, data: { expected_revision: proposal.revision, ...data } });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { token: string; quotation: { revision: number; status: string } };
}

const open = async (page: Page, token: string, path = "/bg/oferta") => {
  await page.goto(`${path}#t=${token}`);
  await expect(page.getByTestId("quotation")).toBeVisible();
};

test.describe("switched off (the default)", () => {
  test.skip(commercial, "the default stack only");

  test("the page and every route do not exist", async ({ page, request }) => {
    for (const path of ["/bg/oferta", "/en/quotation"]) expect((await page.goto(path))?.status(), path).toBe(404);
    const token = "a".repeat(43);
    expect((await request.post("/api/public/quotations/view", { data: { token } })).status()).toBe(404);
    expect((await request.post("/api/public/quotations/decision", { data: { token, decision: "accept", name: "Test Test", confirmed: true } })).status()).toBe(404);
    expect((await request.get("/api/admin/leads/00000000-0000-0000-0000-000000000000/proposals/00000000-0000-0000-0000-000000000000/quotation")).status()).toBe(404); // staff routes too: no link can lead nowhere
  });
});

test.describe("switched on (commercial test stack)", () => {
  test.skip(!commercial || !email || !password, "needs the commercial test stack and the bootstrap administrator");

  test("a client opens the link, reads the approved version and accepts once", async ({ page, request, browser }) => {
    const { lead, proposal, headers } = await approvedProposal(request, `E2E Оферта ${Date.now()}`);
    const { token } = await publish(request, lead, proposal, headers);

    await open(page, token);
    await expect(page.getByRole("heading", { level: 2, name: "Оферта за нов сайт" })).toBeVisible();
    await expect(page.getByTestId("quotation-status")).toHaveText("Очаква отговор");
    await expect(page.getByTestId("quotation-content")).toContainText(COMPLETE.scope);
    await expect(page.getByTestId("quotation-content")).toContainText("Фиксирана цена за описания обхват");
    await expect(page.getByTestId("quotation-valid-until")).toHaveCount(0); // no validity unless staff set one
    // The secret never leaves the browser in a URL or a header the server logs: the request goes in the body.
    const requests: string[] = [];
    page.on("request", (item) => requests.push(item.url()));
    await page.reload();
    await expect(page.getByTestId("quotation")).toBeVisible();
    expect(requests.some((url) => url.includes(token))).toBe(false);
    expect(await page.evaluate(() => window.localStorage.length + window.sessionStorage.length)).toBe(0);

    const answer = page.getByTestId("quotation-answer");
    await answer.getByRole("button", { name: "Искаме да продължим" }).click();
    await expect(answer.getByText("Въведете име.")).toBeVisible();
    await answer.getByLabel(/Вашето име/).fill("Мария Иванова");
    await answer.getByRole("button", { name: "Искаме да продължим" }).click();
    await expect(answer.getByText("Потвърдете изявлението, за да изпратите отговор.")).toBeVisible();
    await answer.getByLabel(/Бележка/).fill("Моля, обадете ни се в понеделник.");
    await answer.getByRole("checkbox", { name: /Потвърждавам/ }).check();
    await answer.getByRole("button", { name: "Искаме да продължим" }).click();
    await expect(page.getByTestId("quotation-decided")).toContainText("Мария Иванова");
    await expect(page.getByTestId("quotation-status")).toHaveText("Приета");
    await expect(page.getByTestId("quotation-answer")).toHaveCount(0);

    // A reload shows the same answer; there is no second one to give.
    await page.reload();
    await expect(page.getByTestId("quotation-decided")).toContainText("Мария Иванова");
    // A second visitor with the same link cannot change it.
    const other = await (await browser.newContext()).newPage();
    await open(other, token);
    await expect(other.getByTestId("quotation-status")).toHaveText("Приета");
    await expect(other.getByTestId("quotation-answer")).toHaveCount(0);
    const changed = await request.post("/api/public/quotations/decision", { data: { token, decision: "decline", name: "Друг Човек", confirmed: true } });
    expect(changed.status()).toBe(409);
    // Staff see the answer; the lead was not moved and nothing was sent.
    const state = await (await request.get(`/api/admin/leads/${lead}/proposals/${proposal.id}/quotation`)).json();
    expect(state).toMatchObject({ status: "accepted", decision_name: "Мария Иванова", decision_note: "Моля, обадете ни се в понеделник.", view_count: 4 });
    expect((await (await request.get(`/api/admin/leads/${lead}`)).json()).status).toBe("NEW");
  });

  test("staff publish from the admin panel, the link is shown once, and withdrawing kills it", async ({ page, browser, request }) => {
    const { lead, proposal, headers } = await approvedProposal(request, `E2E Панел ${Date.now()}`);
    await page.goto("/admin/login");
    await page.getByLabel("Имейл").fill(email);
    await page.getByLabel("Парола").fill(password);
    await page.getByRole("button", { name: "Вход" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto(`/admin/leads/${lead}`);
    await page.getByRole("button", { name: /Оферта за нов сайт/ }).click();
    const panel = page.getByTestId("quotation-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Това е единственият път")).toHaveCount(0);
    const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await panel.getByLabel(/Валидна до/).fill(nextMonth);
    await panel.getByRole("button", { name: "Публикувайте за клиента" }).click();
    const link = panel.getByTestId("quotation-link");
    await expect(link).toContainText("Това е единственият път");
    const url = await link.getByRole("textbox").inputValue();
    expect(url).toMatch(/\/bg\/oferta#t=[A-Za-z0-9_-]{40,}$/);
    await expect(panel.getByTestId("quotation-state")).toContainText(`Валидна до ${nextMonth}`);
    await expect(panel.getByTestId("quotation-state")).toContainText("Още не е отваряна");

    // The client opens it from that link; the validity staff chose is shown.
    const client = await (await browser.newContext()).newPage();
    await client.goto(url);
    await expect(client.getByTestId("quotation-valid-until")).toHaveText(nextMonth);
    await expect(client.getByTestId("quotation-status")).toHaveText("Очаква отговор");

    // After a reload the link is gone from the panel (it is not stored anywhere readable).
    await page.reload();
    await page.getByRole("button", { name: /Оферта за нов сайт/ }).click();
    await expect(page.getByTestId("quotation-link")).toHaveCount(0);
    await expect(page.getByTestId("quotation-state")).toContainText("Отворена 1 пъти");

    await page.getByTestId("quotation-panel").getByLabel("Причина за оттегляне").fill("Условията се променят");
    await page.getByTestId("quotation-panel").getByRole("button", { name: "Оттеглете офертата" }).click();
    await expect(page.getByTestId("quotation-panel")).toHaveAttribute("data-status", "withdrawn");
    await client.reload();
    await expect(client.getByTestId("quotation-status")).toHaveText("Оттеглена");
    await expect(client.getByTestId("quotation-content")).toHaveCount(0);
    await expect(client.getByTestId("quotation-answer")).toHaveCount(0);
    expect(proposal.status).toBe("approved");
    expect(headers["X-CSRF-Token"]).toBeTruthy();
  });

  test("a client can decline, and a wrong or missing link shows a plain 'not found'", async ({ page, request }) => {
    const { lead, proposal, headers } = await approvedProposal(request, `E2E Отказ ${Date.now()}`);
    const { token } = await publish(request, lead, proposal, headers);
    await open(page, token, "/en/quotation");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quotation");
    const answer = page.getByTestId("quotation-answer");
    await answer.getByLabel(/Your name/).fill("Peter Petrov");
    await answer.getByRole("checkbox", { name: /I confirm/ }).check();
    await answer.getByRole("button", { name: "We decline" }).click();
    await expect(page.getByTestId("quotation-status")).toHaveText("Declined");
    await expect(page.getByTestId("quotation-decided")).toContainText("Peter Petrov");

    for (const hash of ["", "#t=short", `#t=${"z".repeat(43)}`]) {
      await page.goto(`/bg/oferta${hash}`);
      await expect(page.getByTestId("quotation-not-found")).toBeVisible();
    }
  });

  test("axe and keyboard on a quotation waiting for an answer", async ({ page, request }, testInfo) => {
    const { lead, proposal, headers } = await approvedProposal(request, `E2E Достъпност ${Date.now()}`);
    const { token } = await publish(request, lead, proposal, headers);
    await open(page, token);
    for (const [label, hash] of [["open", token], ["not-found", "z".repeat(43)]] as const) {
      await page.goto(`/bg/oferta#t=${hash}`);
      await expect(page.getByTestId(hash === token ? "quotation" : "quotation-not-found")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
      await testInfo.attach(`axe-quotation-${label}.json`, { body: JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))), contentType: "application/json" });
      expect(results.violations.map((v) => v.id), label).toEqual([]);
    }
    await open(page, token);
    const name = page.getByLabel(/Вашето име/);
    await name.focus();
    await page.keyboard.type("Мария Иванова");
    await page.keyboard.press("Tab"); // note
    await page.keyboard.press("Tab"); // confirmation
    await page.keyboard.press("Space");
    await expect(page.getByRole("checkbox", { name: /Потвърждавам/ })).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Искаме да продължим" })).toBeFocused();
  });

  for (const width of [360, 390, 768, 1024, 1440]) {
    test(`fits at ${width}px`, async ({ browser, request }) => {
      const { lead, proposal, headers } = await approvedProposal(request, `E2E Ширина ${width} ${Date.now()}`);
      const { token } = await publish(request, lead, proposal, headers);
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      await open(page, token);
      const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
      expect(sizes.scroll, `quotation @${width}`).toBeLessThanOrEqual(sizes.client);
      const box = await page.getByTestId("quotation-answer").boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
      await context.close();
    });
  }

  test("the API: only an approved proposal can be published, the link is the only credential, nothing is sent", async ({ request }) => {
    const { lead, proposal, headers } = await approvedProposal(request, `E2E API ${Date.now()}`);
    const draft = await request.post(`/api/admin/leads/${lead}/proposals`, { headers, data: { kind: "proposal", title: "Чернова", generate: true } });
    const unapproved = (await draft.json()) as { id: string; revision: number };
    const refused = await request.post(`/api/admin/leads/${lead}/proposals/${unapproved.id}/quotation`, { headers, data: { expected_revision: unapproved.revision } });
    expect(refused.status()).toBe(409);
    expect((await refused.json()).code).toBe("proposal_not_approved");

    const { token } = await publish(request, lead, proposal, headers);
    expect((await request.post("/api/public/quotations/view", { data: { token: "z".repeat(43) } })).status()).toBe(404);
    expect((await request.post("/api/public/quotations/view", { data: { token: "short" } })).status()).toBe(422);
    expect((await request.post("/api/public/quotations/decision", { data: { token, decision: "accept", name: "Ok Name", confirmed: false } })).status()).toBe(422);
    expect((await request.post("/api/public/quotations/decision", { data: { token, decision: "accept", name: "Ok Name", confirmed: true, price: 1 } })).status()).toBe(422);
    const view = await (await request.post("/api/public/quotations/view", { data: { token } })).json();
    expect(JSON.stringify(view)).not.toContain(lead);
    expect(JSON.stringify(view)).not.toContain(proposal.id);
    expect(view.content.scope).toBe(COMPLETE.scope);
  });
});
