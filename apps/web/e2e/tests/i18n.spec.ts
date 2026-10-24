import { expect, test } from "@playwright/test";

const email = process.env.ADMIN_BOOTSTRAP_EMAIL ?? "";
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
const CYRILLIC = /[А-Яа-яЁё]/;
const octet = () => Math.floor(Math.random() * 250) + 1;

// This file submits forms too; its own client address keeps it out of the per-IP rate-limit bucket
// that the other specs of the same run use (local stacks have no reverse proxy).
test.use({ extraHTTPHeaders: { "X-Forwarded-For": `10.97.${octet()}.${octet()}` } });

/** The anti-bot form token is only accepted a few seconds after it was issued. */
const humanPause = () => new Promise((resolve) => setTimeout(resolve, 3500));

test.describe("language routing", () => {
  test("the root goes to Bulgarian by default and to an explicitly chosen language", async ({ page, context, baseURL }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/bg$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");

    await context.addCookies([{ name: "acs_locale", value: "en", url: baseURL! }]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("legacy unprefixed URLs and Bulgarian segments under /en redirect permanently", async ({ request }) => {
    const legacy = await request.get("/uslugi/seo-optimizatsiya", { maxRedirects: 0 });
    expect(legacy.status()).toBe(308);
    expect(legacy.headers()["location"]).toMatch(/\/bg\/uslugi\/seo-optimizatsiya$/);

    const mixed = await request.get("/en/kontakti?usluga=seo&tip=oferta", { maxRedirects: 0 });
    expect(mixed.status()).toBe(308);
    expect(mixed.headers()["location"]).toMatch(/\/en\/contact\?service=seo&type=quote$/);
  });

  test("English pages are fully English with localized metadata and reciprocal hreflang", async ({ page }) => {
    for (const path of ["/en", "/en/services", "/en/services/ai-managed-services", "/en/contact", "/en/ai-automation-advisor"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator("html"), path).toHaveAttribute("lang", "en");
      // "Български" (the name of the other language, e.g. in the communication-language choice) is intended.
      const visible = (await page.locator("main").innerText()).replaceAll("Български", "");
      expect(CYRILLIC.test(visible), `${path} shows Cyrillic text`).toBe(false);
      expect(visible, path).not.toMatch(/\b[a-z]+\.[a-z]+\.[a-zA-Z]+\b/); // no raw dictionary keys
      // Header and footer are localized too (the switcher's "Превключи на български" label is not visible text).
      for (const part of ["header", "footer"]) {
        const text = await page.locator(part).first().innerText();
        expect(CYRILLIC.test(text), `${path} ${part} shows Cyrillic text`).toBe(false);
      }

      const canonical = await page.locator("link[rel='canonical']").getAttribute("href");
      expect(new URL(canonical!).pathname, path).toBe(path);
      const hreflang = await page.locator("link[rel='alternate'][hreflang]").evaluateAll((links) =>
        Object.fromEntries(links.map((l) => [l.getAttribute("hreflang"), new URL(l.getAttribute("href")!).pathname])),
      );
      expect(hreflang.en, path).toBe(path);
      expect(hreflang.bg, path).toMatch(/^\/bg/);
      expect(hreflang["x-default"], path).toBe(hreflang.bg);
      await expect(page.locator("meta[property='og:locale']"), path).toHaveAttribute("content", "en_US");

      // The Bulgarian alternate links back to this page.
      await page.goto(hreflang.bg);
      const back = await page.locator("link[rel='alternate'][hreflang='en']").getAttribute("href");
      expect(new URL(back!).pathname, `${hreflang.bg} → en`).toBe(path);
    }
  });
});

test("navigation labels are localized", async ({ page }) => {
  const nav = (path: string) =>
    page.goto(path).then(() => page.locator("header nav").first().innerText());
  const bg = await nav("/bg");
  for (const label of ["Услуги", "AI решения", "Инструменти", "За кого", "За нас"]) expect(bg).toContain(label);
  const en = await nav("/en");
  for (const label of ["Services", "AI solutions", "Tools", "Industries", "Insights", "About"]) expect(en).toContain(label);
});

test.describe("language switcher", () => {
  test("desktop switcher opens the equivalent page and remembers the choice", async ({ page, context }) => {
    await page.goto("/bg/uslugi/ai-managed-services");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI агентите ви заслужават професионална поддръжка.");
    await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
    await expect(page).toHaveURL(/\/en\/services\/ai-managed-services$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Keep your AI agents running at their best.");
    const cookie = (await context.cookies()).find((c) => c.name === "acs_locale");
    expect(cookie?.value).toBe("en");
    expect(cookie?.httpOnly).toBe(false);

    await page.locator("header").getByRole("link", { name: "Превключи на български" }).first().click();
    await expect(page).toHaveURL(/\/bg\/uslugi\/ai-managed-services$/);
  });

  test("switching keeps the selected service and quote mode but drops other query parameters", async ({ page }) => {
    await page.goto("/bg/kontakti?usluga=seo&tip=oferta&utm_source=test");
    await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
    await expect(page).toHaveURL(/\/en\/contact\?service=seo&type=quote$/);
    await expect(page.getByRole("radio", { name: /Request a quote/ })).toBeChecked();
    await expect(page.getByLabel(/^Service/)).toHaveValue("seo");
  });

  test("mobile menu contains the switcher", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/bg/uslugi");
    await page.getByRole("button", { name: "Отвори менюто" }).click();
    const close = page.getByRole("button", { name: "Затвори менюто" });
    const panel = page.locator(`[id="${await close.getAttribute("aria-controls")}"]`);
    await panel.getByRole("link", { name: "Switch to English" }).click();
    await expect(page).toHaveURL(/\/en\/services$/);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });
});

test.describe("English forms", () => {
  test("validation errors are shown in English", async ({ page }) => {
    await page.goto("/en/contact");
    await page.getByRole("button", { name: "Send inquiry" }).click();
    await expect(page.getByText("Please correct the highlighted fields.").first()).toBeVisible();
    await page.getByLabel(/^Email/).fill("not-an-email");
    await page.getByLabel(/^Email/).blur();
    await expect(page.locator("main")).not.toContainText(CYRILLIC);
  });

  test("the API answers in the page language", async ({ request }) => {
    const bad = { service: "seo", name: "X", email: "bad", message: "short", privacy_acknowledged: false };
    const post = (language: string) =>
      request.post("/api/public/leads", { data: bad, headers: { "Accept-Language": language } });
    const en = await (await post("en")).json();
    expect(en.detail).toBe("Please correct the highlighted fields.");
    for (const error of en.errors) expect(CYRILLIC.test(error.message), error.field).toBe(false);
    const bg = await (await post("bg")).json();
    expect(bg.detail).toBe("Моля, коригирайте маркираните полета.");
  });

  test("English advisor produces an English demo assessment", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/en/ai-automation-advisor");
    await expect(page.getByTestId("advisor-demo-notice")).toContainText("not an analysis generated by artificial intelligence");
    await page.getByLabel(/Type of business/i).selectOption("online_store");
    await page
      .getByLabel(/Which process/i)
      .fill(
        "Every day we copy new WooCommerce orders into a spreadsheet by hand, create shipments with the courier and email customers their tracking numbers.",
      );
    await page.getByLabel(/volume/i).selectOption("500_2000");
    await page.getByLabel(/team size/i).selectOption("2_5");
    await page.getByRole("checkbox", { name: "WooCommerce" }).check();
    await humanPause();
    await page.getByRole("button", { name: "Generate assessment" }).click();
    const result = page.getByTestId("advisor-result");
    await expect(result).toBeVisible();
    await expect(result).toHaveAttribute("data-mode", "demo");
    expect(CYRILLIC.test(await result.innerText())).toBe(false);
    await expect(result).not.toContainText(/ROI|\d\s?%|€\s?\d|\$\s?\d/);
  });
});

test.describe("AI Managed Services", () => {
  test("service page in both languages: packages without prices or SLA, no live telemetry claims", async ({ page }) => {
    for (const [path, priceLabel] of [
      ["/bg/uslugi/ai-managed-services", "По индивидуална оферта"],
      ["/en/services/ai-managed-services", "Custom quote"],
    ] as const) {
      expect((await page.goto(path))?.status(), path).toBe(200);
      for (const key of ["monitor", "care", "optimize"]) {
        const card = page.getByTestId(`package-${key}`);
        await expect(card, `${path} ${key}`).toBeVisible();
        await expect(card).toContainText(priceLabel);
        await expect(card).not.toContainText(/€|лв\.|\$\d|24\/7|unlimited|неограничен/i);
      }
      await expect(page.getByTestId("no-sla-note")).toBeVisible();
      await expect(page.getByTestId("secrets-warning")).toBeVisible();
      const jsonLd = (await page.locator("script[type='application/ld+json']").allTextContents()).join(" ");
      expect(jsonLd, path).toContain('"@type":"Service"');
    }
  });

  test("English AI Managed inquiry is stored with its language and shown to the administrator", async ({ page }) => {
    test.skip(!email || !password, "ADMIN_BOOTSTRAP_EMAIL/PASSWORD not provided");
    test.setTimeout(90_000);
    const company = `E2E AI Ops ${Date.now()}`;

    await page.goto("/en/services/ai-managed-services#ams-inquiry");
    const form = page.locator("#ams-inquiry");
    await expect(form.getByLabel(/^Service/)).toHaveValue("ai_managed");
    await form.getByLabel(/^Full name/).fill("E2E AI Ops Test");
    await form.getByLabel(/^Company/).fill(company);
    await form.getByLabel(/^Email/).fill("e2e.aiops@example.com");
    await form.getByLabel(/^Industry/).selectOption("ecommerce");
    await form.getByLabel(/^Number of agents/).selectOption("2_5");
    await form.getByRole("checkbox", { name: "Customer support AI" }).check();
    await form.getByLabel(/^Current AI model provider/).fill("Anthropic Claude");
    await form.getByRole("checkbox", { name: "Monitoring" }).check();
    await form
      .getByLabel(/^Main operational problems/)
      .fill("Synthetic E2E test: answers degraded after a prompt change and token costs increased.");
    await form.getByRole("checkbox", { name: /privacy information/ }).check();
    await humanPause();
    const response = page.waitForResponse((r) => r.url().endsWith("/api/public/leads") && r.request().method() === "POST");
    await form.getByRole("button", { name: "Request an AI assessment" }).click();
    expect((await response).status()).toBe(201);
    await expect(page.getByTestId("contact-success")).toContainText(/Reference number/);

    await page.goto("/admin/login");
    await page.getByLabel(/^(Имейл|Email)$/).fill(email);
    await page.getByLabel(/^(Парола|Password)$/).fill(password);
    await page.getByRole("button", { name: /^(Вход|Log in)$/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    // The admin language follows the explicit BG | EN choice (shared cookie), not the lead's language.
    if ((await page.locator("html").getAttribute("lang")) !== "en") {
      await page.locator("[data-testid=admin-language-switch]:visible").first().click();
    }
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    await page.goto(`/admin/leads?locale=en&q=${encodeURIComponent(company)}`);
    await expect(page.getByTestId("leads-table")).toContainText(company);
    await page.getByRole("link", { name: "E2E AI Ops Test" }).first().click();
    await expect(page.getByTestId("lead-locale")).toHaveText("English");
    const details = page.getByTestId("ai-managed-details");
    await expect(details).toContainText("Customer support AI");
    await expect(details).toContainText("Anthropic Claude");

    // Switching the admin to Bulgarian keeps the page and translates it.
    await page.locator("[data-testid=admin-language-switch]:visible").first().click();
    await expect(page.locator("html")).toHaveAttribute("lang", "bg");
    await expect(page.getByTestId("lead-locale")).toHaveText("Английски");
    await expect(page.getByTestId("ai-managed-details")).toContainText("AI за обслужване на клиенти");
  });

  test("the inquiry rejects credentials before anything is sent", async ({ page }) => {
    let posts = 0;
    page.on("request", (req) => {
      if (req.url().endsWith("/api/public/leads") && req.method() === "POST") posts += 1;
    });
    await page.goto("/en/services/ai-managed-services#ams-inquiry");
    const form = page.locator("#ams-inquiry");
    await form.getByLabel(/^Current AI model provider/).fill("sk-ant-api03-abcdefghijklmnopqrstuvwxyz");
    await form.getByLabel(/^Current AI model provider/).blur();
    await expect(form.getByText(/password, API key or token/i).first()).toBeVisible();
    expect(posts).toBe(0);
  });
});
