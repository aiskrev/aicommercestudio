import { expect, test } from "@playwright/test";

/** AI ROI calculator and Automation Opportunity Finder (client-side tools), and their connections. */

test("the ROI calculator computes from the visitor's own numbers in Bulgarian", async ({ page }) => {
  const response = await page.goto("/bg/instrumenti/roi-kalkulator");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Калкулатор на ефекта (ROI)");
  const result = page.getByTestId("roi-result");
  await expect(result).toContainText("Нищо не е предварително зададено.");

  const values: [string, string][] = [
    ["Задачи на месец", "2000"],
    ["Средно време за задача", "12"],
    ["Пълна цена на час труд", "25"],
    ["Дял на автоматизираните задачи", "60"],
    ["Намаление на времето за автоматизирана задача", "70"],
    ["Време за човешки преглед", "2"],
    ["Еднократни разходи за внедряване", "15000"],
    ["Месечни разходи за AI, API и инфраструктура", "300"],
    ["Месечни разходи за поддръжка", "200"],
  ];
  for (const [label, value] of values) await page.getByLabel(label).fill(value);
  await page.getByRole("radio", { name: "12 месеца" }).check();
  await expect(page.getByTestId("roi-net-monthly")).toHaveCount(0); // realisation share still unchosen
  await page.getByRole("radio", { name: "50%" }).check();

  await expect(page.getByTestId("roi-current-cost")).toHaveText("10 000 €");
  await expect(page.getByTestId("roi-net-monthly")).toHaveText("1100 €"); // 50% of 3 200 − 500
  await expect(page.getByTestId("roi-capacity")).toContainText("капацитет, не пари");
  await expect(page.getByTestId("roi-scenarios")).toContainText("Консервативен");

  // Invalid input is explained and removes the result.
  await page.getByLabel("Дял на автоматизираните задачи").fill("140");
  await page.getByLabel("Дял на автоматизираните задачи").blur();
  await expect(page.getByText("Въведете стойност между 0 и 100.")).toBeVisible();
  await expect(page.getByTestId("roi-net-monthly")).toHaveCount(0);
});

test("the cumulative chart can be read with the keyboard and a shared link restores the result", async ({ page }) => {
  await page.goto("/en/tools/roi-calculator?r=2000~12~25~60~70~2~15000~300~200~12~75");
  await expect(page.getByText("The result was loaded from a shared link.")).toBeVisible();
  await expect(page.getByTestId("roi-payback")).toHaveText("7.9 months");
  const chart = page.getByRole("img", { name: "Cumulative net benefit by month" });
  await chart.focus();
  await expect(page.getByText("Month 12", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("Month 11", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download summary (.txt)" })).toBeVisible();
});

test("the finder ranks processes and hands the best one to the ROI calculator", async ({ page }) => {
  await page.goto("/en/tools/automation-finder");
  const form = page.getByTestId("finder-form");
  await form.getByLabel("Process 1", { exact: true }).fill("Quarterly board report");
  await form.getByRole("button", { name: "Add a process" }).click();
  await form.getByLabel("Process 2", { exact: true }).fill("Invoice processing");
  await form.getByLabel("Department").nth(1).selectOption("finance");
  await form.getByRole("button", { name: "Next" }).click();

  for (const [index, levels] of [
    [0, [1, 2, 1, 1, 3, 4, 2, 3, 4]],
    [1, [4, 4, 3, 2, 1, 2, 3, 2, 2]],
  ] as const) {
    const groups = await form.getByRole("group").all();
    expect(groups).toHaveLength(9);
    for (let c = 0; c < groups.length; c++) await groups[c].getByRole("radio").nth(levels[c]).check();
    await form.getByRole("button", { name: index === 1 ? "See the result" : "Next" }).click();
  }

  const result = page.getByTestId("finder-result");
  await expect(result.getByTestId("finder-ranking")).toContainText("1. Invoice processing");
  const first = result.locator("[data-category]").first();
  await expect(first).toHaveAttribute("data-category", "quick_win");
  await expect(first.getByTestId("finder-score")).toHaveText("73");
  await expect(first).toContainText("AI classification and extraction");
  await expect(result.locator("[data-category]").nth(1)).toHaveAttribute("data-category", "not_ready");
  await expect(result.locator("[data-point]")).toHaveCount(2);

  await first.getByRole("button", { name: "Calculate the effect for this process" }).click();
  await expect(page).toHaveURL(/\/en\/tools\/roi-calculator$/);
  await expect(page.getByLabel("Process description")).toHaveValue("Invoice processing");
});

test("the AI team cost estimate opens the ROI calculator with its costs only", async ({ page }) => {
  const payload = {
    c: ["ecommerce", "s51_250", "support", "slow_response", "v1k_10k"],
    d: ["support"],
    a: ["customer_support"],
    g: {},
    p: ["managed_cloud", "shared"],
  };
  await page.goto(`/en/tools/ai-team?t=${Buffer.from(JSON.stringify(payload)).toString("base64url")}`);
  const link = page.getByTestId("team-roi-link");
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/en\/tools\/roi-calculator\?impl=\d+&run=\d+&maint=\d+$/);
  await expect(page.getByText("Costs were filled in from the AI team configurator")).toBeVisible();
  await expect(page.getByLabel("One-time implementation cost")).not.toHaveValue("");
  await expect(page.getByLabel("Share of tasks automated")).toHaveValue("");
});

test("both tools switch language with their localized slugs", async ({ page }) => {
  await page.goto("/bg/instrumenti/avtomatizatsii");
  await page.locator("header").getByRole("link", { name: "Switch to English" }).first().click();
  await expect(page).toHaveURL(/\/en\/tools\/automation-finder$/);
  await page.goto("/en/tools/roi-calculator");
  await page.locator("header").getByRole("link", { name: "Превключи на български" }).first().click();
  await expect(page).toHaveURL(/\/bg\/instrumenti\/roi-kalkulator$/);
});
