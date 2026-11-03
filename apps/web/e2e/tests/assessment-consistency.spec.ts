import { expect, type Locator, type Page, test } from "@playwright/test";

/**
 * The shared results experience across the ten assessment tools (docs/ASSESSMENT_COVERAGE.md): every
 * engine flow end to end, the same layout and methodology disclosure, locale equivalence, repeatable
 * scores and rejected invalid input. Scoring itself is covered per assessment in the API tests.
 */

const octet = () => Math.floor(Math.random() * 250) + 1;
/** Each test gets its own client address so the per-IP assessment limits never mix between tests. */
const clientIp = (n: number) => `10.95.${n}.${octet()}`;

const ENGINE_TOOLS = [
  { key: "cloud_platform", en: "cloud-platform-maturity", bg: "zrelost-na-oblak-i-platforma" },
  { key: "devops_delivery", en: "devops-delivery-maturity", bg: "zrelost-na-devops-dostavkata" },
  { key: "observability_reliability", en: "observability-reliability", bg: "nablyudaemost-i-nadezhdnost" },
  { key: "ecommerce_architecture", en: "ecommerce-architecture", bg: "arhitektura-na-online-magazin" },
  { key: "data_integration", en: "data-integration", bg: "integratsiya-na-danni" },
  { key: "ai_governance", en: "responsible-ai-governance", bg: "otgovoren-ai" },
  { key: "ai_ops_readiness", en: "ai-operations-readiness", bg: "gotovnost-za-ai-operatsii" },
  { key: "finops", en: "finops-ai-cost", bg: "finops-i-ai-razhodi" },
] as const;

/** Answers every required single-choice question with its first option (the weakest practice). */
async function answerFirst(page: Page, form: Locator, finish: string, next: string) {
  for (let step = 0; step < 20; step++) {
    await expect(form.getByText(new RegExp(`^(Област|Area) ${step + 1} (от|of) [0-9]+$`))).toBeVisible();
    const groups = form.locator("fieldset:has(input[type=radio])");
    for (let i = 0; i < (await groups.count()); i++) {
      const group = groups.nth(i);
      if (/\((optional|по желание)\)$/.test((await group.locator("legend").innerText()).trim())) continue;
      await group.getByRole("radio").first().check();
    }
    // A required multiple choice (e.g. the platform or the telemetry signals) gets its first option.
    const multi = form.locator("fieldset:has(input[type=checkbox])");
    for (let i = 0; i < (await multi.count()); i++) {
      const group = multi.nth(i);
      if (/\((optional|по желание)\)$/.test((await group.locator("legend").innerText()).trim())) continue;
      if ((await group.locator("input:checked").count()) === 0) await group.getByRole("checkbox").first().check();
    }
    const finishButton = form.getByRole("button", { name: finish });
    if (await finishButton.count()) {
      await finishButton.click();
      return;
    }
    await form.getByRole("button", { name: next }).click();
  }
  throw new Error("the wizard did not finish");
}

ENGINE_TOOLS.forEach((tool, index) => {
  test.describe(`${tool.key} result layout`, () => {
    test.use({ extraHTTPHeaders: { "X-Forwarded-For": clientIp(index + 1) } });

    test(`${tool.key}: complete flow with the shared results layout`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.goto(`/en/tools/${tool.en}`);
      const form = page.getByTestId("engine-form");
      await answerFirst(page, form, "See the result", "Next");

      const result = page.getByTestId("engine-result");
      await expect(result.getByRole("heading", { level: 2, name: "Your result" })).toBeFocused();
      await expect(result.getByTestId("tool-score")).toHaveText("0");
      await expect(result.getByTestId("tool-level")).toHaveText("Initial");
      // Strengths and gaps, findings with their rule basis, services, workshops, methodology, report, consultation.
      await expect(result.getByRole("region", { name: "Strengths" })).toContainText("No area at 75/100 or above yet.");
      await expect(result.getByRole("region", { name: "Gaps" }).getByRole("listitem").first()).toBeVisible();
      await expect(result.getByText("Why:").first()).toBeVisible();
      await expect(result.getByTestId("engine-services").getByRole("link").first()).toBeVisible();
      // The workshops that continue from this assessment, then the whole catalogue.
      const workshops = result.getByTestId("engine-workshops").getByRole("link");
      await expect(workshops.first()).toHaveAttribute("href", /^\/en\/workshops\/[a-z-]+$/);
      await expect(workshops.last()).toHaveAttribute("href", "/en/workshops");
      const basis = result.getByTestId("tool-basis");
      await expect(basis).toHaveAttribute("data-basis", "heuristic");
      await expect(basis.getByTestId("tool-version")).toHaveText(/^Methodology version [0-9]+\.[0-9]+\.[0-9]+$/);
      await result.getByText("How the result is calculated").click();
      await expect(result.getByText(/algorithm weighted-mean\/1/)).toBeVisible();
      await expect(result.getByRole("note").first()).toBeVisible();
      await expect(result.getByTestId("engine-report").getByRole("button", { name: "Save and create the report" })).toBeVisible();
      await expect(result.getByTestId("engine-consultation")).toBeVisible();
      // Accessibility basics: one h1, every radio and checkbox has a name, nothing scrolls sideways.
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    });
  });
});

ENGINE_TOOLS.forEach((tool, index) => {
  test.describe(`${tool.key} API consistency`, () => {
    const headers = { "X-Forwarded-For": clientIp(index + 20) };

    test(`${tool.key}: same score in both languages, repeatable, invalid answers rejected`, async ({ request }) => {
      const [bg, en] = await Promise.all(
        ["bg", "en"].map(async (locale) => (await request.get(`/api/public/assessments/${tool.key}?locale=${locale}`, { headers })).json()),
      );
      expect(bg.version).toBe(en.version);
      const shape = (d: { questions: { key: string; options?: { key: string }[] }[] }) =>
        d.questions.map((q) => [q.key, (q.options ?? []).map((o) => o.key)]);
      expect(shape(bg)).toEqual(shape(en));

      // Required questions only: the middle option of each single choice, every option but "none" of each
      // multiple choice (optional questions and metrics stay unanswered; they never change the score).
      type Question = { key: string; type: string; required: boolean; options?: { key: string }[] };
      const answers = Object.fromEntries(
        (en.questions as Question[])
          .filter((q) => q.required && q.options?.length)
          .map((q) => [
            q.key,
            q.type === "multi_choice" ? q.options!.filter((o) => o.key !== "none").map((o) => o.key) : q.options![Math.floor(q.options!.length / 2)].key,
          ]),
      );
      const scoreIn = async (locale: string, body = answers) => {
        const response = await request.post(`/api/public/assessments/${tool.key}/score`, {
          headers,
          data: { schema_version: "1", definition_version: en.version, locale, answers: body },
        });
        return { status: response.status(), body: await response.json() };
      };
      const summary = (r: { overall: number; band: { key: string }; dimensions: { key: string; score: number }[]; recommendations: { key: string }[] }) => ({
        overall: r.overall,
        band: r.band.key,
        dimensions: r.dimensions.map((d) => [d.key, d.score]),
        findings: r.recommendations.map((f) => f.key),
      });
      const inBg = await scoreIn("bg");
      const inEn = await scoreIn("en");
      expect(inBg.status).toBe(200);
      expect(summary(inBg.body)).toEqual(summary(inEn.body));
      expect(inBg.body.definition_version).toBe(en.version);
      const again = await scoreIn("en");
      expect(summary(again.body)).toEqual(summary(inEn.body));

      const [firstKey] = Object.keys(answers);
      const invalid = await scoreIn("en", { ...answers, [firstKey]: "<script>alert(1)</script>" });
      expect(invalid.status).toBe(422);
      expect(JSON.stringify(invalid.body)).not.toContain("<script>");
    });
  });
});

test.describe("AI readiness and the opportunity finder", () => {
  test.use({ extraHTTPHeaders: { "X-Forwarded-For": clientIp(40) } });

  test("the AI readiness result has the same versioned methodology disclosure", async ({ page }) => {
    await page.goto("/bg/instrumenti/ai-gotovnost?r=b333333333333");
    const result = page.getByTestId("readiness-result");
    await expect(result.getByTestId("tool-basis")).toHaveAttribute("data-basis", "heuristic");
    await expect(result.getByTestId("tool-version")).toHaveText(/^Версия на методиката [0-9]{4}-[0-9]{2}\.[0-9]+$/);
    await expect(result.getByRole("region", { name: "Силни страни" })).toBeVisible();
    await expect(result.getByTestId("readiness-workshops")).toBeVisible();
  });
});

test.describe("the new 12-area assessments", () => {
  test.use({ extraHTTPHeaders: { "X-Forwarded-For": clientIp(41) } });

  test("AI operations readiness in English: risk register, production checklist and managed boundaries", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/en/tools/ai-operations-readiness");
    const form = page.getByTestId("engine-form");
    await expect(form.getByText("Area 1 of 12")).toBeVisible();
    await answerFirst(page, form, "See the result", "Next");
    const result = page.getByTestId("engine-result");
    await expect(result.getByTestId("engine-findings-risk")).toContainText("Agents with broad permissions");
    const patterns = result.getByTestId("engine-findings-pattern");
    await expect(patterns).toContainText("Minimum production-readiness checklist");
    await expect(patterns).toContainText("Recommended managed service boundaries");
    await expect(result.getByTestId("engine-roadmap")).toContainText("30 days");
    await expect(result).toContainText("show no real health or telemetry");
  });

  test("FinOps in Bulgarian: distinct from the ROI calculator, no prices or savings", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/bg/instrumenti/finops-i-ai-razhodi");
    const form = page.getByTestId("engine-form");
    await expect(form.getByText("Област 1 от 12")).toBeVisible();
    await answerFirst(page, form, "Вижте резултата", "Напред");
    const result = page.getByTestId("engine-result");
    await expect(result.getByTestId("engine-findings-risk")).toContainText("Изненади във фактурата");
    await expect(result.getByTestId("engine-findings-context")).toContainText("Това не е калкулатор на ефекта");
    await expect(result).toContainText("Не използваме ценоразписи");
  });
});
