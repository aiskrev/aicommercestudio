import { expect, test } from "@playwright/test";

test.describe("contact form", () => {
  test("invalid submission shows errors and sends nothing", async ({ page }) => {
    let leadRequests = 0;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/public/leads") && req.method() === "POST") leadRequests += 1;
    });
    await page.goto("/kontakti");
    await page.getByRole("button", { name: "Изпрати запитването" }).click();
    await expect(page.getByText("Моля, коригирайте маркираните полета.")).toBeVisible();
    await expect(page.getByLabel(/Служебен имейл/)).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel(/Служебен имейл/).fill("not-an-email");
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

  test("valid submission is stored and confirmed with a reference", async ({ page }) => {
    await page.goto("/kontakti?usluga=automation");
    await expect(page.getByLabel(/Услуга/)).toHaveValue("automation");

    await page.getByLabel(/Име и фамилия/).fill("E2E Тестов Потребител");
    await page.getByLabel(/^Фирма/).fill(`E2E Тест ${Date.now()}`);
    await page.getByLabel(/Служебен имейл/).fill("e2e.test@example.com");
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
