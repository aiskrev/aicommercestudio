import { expect, test } from "@playwright/test";

test.describe("contact form", () => {
  test("invalid submission shows errors and sends nothing", async ({ page }) => {
    let leadRequests = 0;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/public/leads") && req.method() === "POST") leadRequests += 1;
    });
    await page.goto("/bg/kontakti");
    await page.getByRole("button", { name: "Изпрати запитването" }).click();
    await expect(page.getByText("Моля, коригирайте маркираните полета.")).toBeVisible();
    await expect(page.getByLabel(/^Имейл/)).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel(/^Имейл/).fill("not-an-email");
    await page.getByRole("button", { name: "Изпрати запитването" }).click();
    await expect(page.getByText("Въведете валиден имейл адрес.")).toBeVisible();
    expect(leadRequests).toBe(0);
  });

  test("server rejects invalid payloads even without the browser checks", async ({ request }) => {
    const response = await request.post("/api/public/leads", {
      data: { service: "seo", name: "X", email: "bad", message: "short", privacy_acknowledged: false },
    });
    expect(response.status()).toBe(422);
    const body = await response.json();
    const fields = body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "email", "message", "privacy_acknowledged", "company"]));
  });

  test("quote request form collects structured project data", async ({ page }) => {
    await page.goto("/bg/kontakti?usluga=ai_tools&tip=oferta");
    await expect(page.getByRole("radio", { name: /Заявка за оферта/ })).toBeChecked();
    await expect(page.getByTestId("quote-fields")).toBeVisible();

    await page.getByLabel(/Име и фамилия/).fill("E2E Оферта");
    await page.getByLabel(/^Фирма/).fill(`E2E Оферта ${Date.now()}`);
    await page.getByLabel(/^Имейл/).fill("e2e.quote@example.com");
    await page.getByLabel(/Платформа/).selectOption("woocommerce");
    await page.getByLabel(/Ориентировъчен бюджет/).selectOption("undisclosed");
    await page.getByLabel(/Желан срок/).selectOption("within_3_months");
    await page.getByLabel(/Адрес на сайта/).fill("example-shop.bg");
    await page.getByLabel(/Описание на проекта/).fill("Автоматизиран E2E тест: искаме оферта за AI асистент.");
    await page.getByRole("checkbox", { name: /информацията за поверителност/ }).check();
    await page.waitForTimeout(3500);

    const response = page.waitForResponse((r) => r.url().endsWith("/api/public/quote-requests"));
    await page.getByRole("button", { name: "Изпрати запитването" }).click();
    expect((await response).status()).toBe(201);
    await expect(page.getByTestId("contact-success")).toContainText(/Референтен номер: [0-9A-F]{8}/);
  });

  test("valid submission is stored and confirmed with a reference", async ({ page }) => {
    await page.goto("/bg/kontakti?usluga=automation");
    await expect(page.getByLabel(/Услуга/)).toHaveValue("automation");

    await page.getByLabel(/Име и фамилия/).fill("E2E Тестов Потребител");
    await page.getByLabel(/^Фирма/).fill(`E2E Тест ${Date.now()}`);
    await page.getByLabel(/^Имейл/).fill("e2e.test@example.com");
    await page.getByLabel(/Описание на проекта/).fill("Автоматизиран E2E тест: искаме автоматизация на обработката на поръчки.");
    await page.getByRole("checkbox", { name: /информацията за поверителност/ }).check();
    // The API rejects forms submitted faster than FORM_TOKEN_MIN_SECONDS (anti-bot timing check).
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: "Изпрати запитването" }).click();

    const success = page.getByTestId("contact-success");
    await expect(success).toBeVisible();
    await expect(success).toContainText(/Референтен номер: [0-9A-F]{8}/);
  });
});
