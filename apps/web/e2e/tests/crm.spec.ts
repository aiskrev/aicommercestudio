import AxeBuilder from "@axe-core/playwright";
import { type Browser, type BrowserContext, expect, type Page, test } from "@playwright/test";

// The admin CRM (docs/ADMIN_CRM.md): the owner of an enquiry, follow-up tasks, the overview and the export. It extends
// the existing admin and needs no flag; it runs on the default e2e stack with the bootstrap administrator.
const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Имейл").fill(email);
  await page.getByLabel("Парола").fill(password);
  await page.getByRole("button", { name: "Вход" }).click();
  await page.waitForURL(/\/admin$/);
}

test.describe("admin CRM", () => {
  test.describe.configure({ mode: "serial" });
  const company = `CRM Фирма ${Date.now()}`;
  const taskTitle = `Изпратете оферта на клиента ${Date.now()}`;
  let leadId = "";
  // One sign-in for the whole file: the login is limited per address and the rest of the suite signs in too.
  let state: Awaited<ReturnType<BrowserContext["storageState"]>>;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    await login(await context.newPage());
    state = await context.storageState();
    await context.close();
  });

  async function session(browser: Browser, viewport = { width: 1280, height: 900 }): Promise<Page> {
    return (await browser.newContext({ storageState: state, viewport })).newPage();
  }

  test("an enquiry gets an owner and a follow-up, and the timeline shows both", async ({ browser, request }) => {
    const { token } = await (await request.get("/api/public/form-token")).json();
    await new Promise((resolve) => setTimeout(resolve, 3500));
    const created = await request.post("/api/public/leads", {
      // Its own client address: the contact form is limited per address and other specs send leads too.
      headers: { "X-Forwarded-For": `10.97.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` },
      data: {
        service: "seo",
        name: "E2E CRM Тест",
        company,
        email: "e2e.crm@example.com",
        message: "Автоматизиран E2E тест за администраторския CRM: отговорник и последващи действия.",
        privacy_acknowledged: true,
        marketing_consent: false,
        website: "",
        form_token: token,
      },
    });
    expect(created.status(), await created.text()).toBe(201);

    const page = await session(browser);
    await page.goto(`/admin/leads?q=${encodeURIComponent(company)}`);
    await page.getByRole("link", { name: "E2E CRM Тест" }).first().click();
    await page.waitForURL(/\/admin\/leads\/[0-9a-f-]{36}$/);
    leadId = page.url().split("/").pop()!;

    const crm = page.getByTestId("lead-crm");
    await expect(crm).toBeVisible();
    const ownerForm = page.getByTestId("lead-owner-form");
    await expect(ownerForm.getByRole("option").nth(1)).toBeAttached();
    await ownerForm.getByRole("combobox").selectOption({ index: 1 });
    await ownerForm.getByRole("button", { name: "Запази" }).click();
    await expect(crm.getByText("Записано.")).toBeVisible();

    const form = page.getByTestId("task-form");
    await form.getByLabel("Какво да се направи").fill(taskTitle);
    await form.getByRole("button", { name: "Добави" }).click();
    await expect(page.getByTestId("lead-tasks")).toContainText(taskTitle);
    await expect(page.getByTestId("lead-timeline")).toContainText("Смяна на отговорник");
    await expect(page.getByTestId("lead-timeline")).toContainText("Създадено действие");
    // The timeline holds no personal data of the customer.
    expect(await page.getByTestId("lead-timeline").textContent()).not.toMatch(/e2e\.crm@example\.com/);
  });

  test("the follow-up shows in the CRM list and is finished there", async ({ browser }) => {
    const page = await session(browser);
    await page.goto("/admin/crm");
    const row = page.locator('[data-testid="crm-tasks"] tr', { hasText: taskTitle });
    await expect(row).toBeVisible();
    await expect(row.getByRole("link")).toHaveAttribute("href", `/admin/leads/${leadId}`);
    await row.getByRole("button", { name: "Готово" }).click();
    await expect(page.locator('[data-testid="crm-tasks"] tr', { hasText: taskTitle })).toHaveCount(0);
    // It is not lost: it shows under "done".
    await page.getByRole("combobox", { name: "Състояние" }).selectOption("done");
    await expect(page.locator('[data-testid="crm-tasks"] tr', { hasText: taskTitle })).toBeVisible();
  });

  test("the overview counts real records and the export holds no personal data", async ({ browser }) => {
    const page = await session(browser);
    await page.goto("/admin/crm");
    const overview = page.getByTestId("crm-overview");
    await expect(overview).toBeVisible();
    await expect(overview.locator('[data-card="enquiries_total"] dd')).not.toHaveText("0");
    expect(await overview.textContent()).not.toMatch(/€|EUR|лв|%|конверси|прогноз/i);

    const csv = await page.request.get("/api/admin/crm/leads.csv");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    expect(csv.headers()["content-disposition"]).toContain("attachment");
    const text = await csv.text();
    expect(text.split("\n")[0]).toBe("reference,created,service,inquiry_type,source,locale,status,owner,qualification,proposal,quotation,project,open_followups");
    for (const personal of ["e2e.crm@example.com", "E2E CRM Тест", company, "Автоматизиран E2E тест"]) expect(text).not.toContain(personal);
  });

  test("the lead list filters by owner and offers the export", async ({ browser }) => {
    const page = await session(browser);
    await page.goto("/admin/leads");
    await page.getByTestId("owner-filter").selectOption("me");
    await expect(page).toHaveURL(/owner=me/);
    await expect(page.getByTestId("leads-export")).toHaveAttribute("href", /\/api\/admin\/crm\/leads\.csv\?.*owner=/);
    await page.getByTestId("owner-filter").selectOption("none");
    await expect(page).toHaveURL(/owner=none/);
  });

  test("axe and no horizontal scroll on the CRM page at 360 px", async ({ browser }, testInfo) => {
    const page = await session(browser, { width: 360, height: 800 });
    await page.goto("/admin/crm");
    await expect(page.getByTestId("crm-overview")).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    await testInfo.attach("axe-crm.json", { body: JSON.stringify(results.violations.map((v) => ({ id: v.id, nodes: v.nodes.length }))), contentType: "application/json" });
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    const sizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);
  });
});
