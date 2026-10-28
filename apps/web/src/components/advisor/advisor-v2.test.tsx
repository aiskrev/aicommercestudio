import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdvisorTool } from "@/components/advisor/AdvisorTool";
import { advisor } from "@/content/bg/advisor";
import { advisor as enAdvisor } from "@/content/en/advisor";
import { bg } from "@/i18n/dictionaries/bg";
import { type AdvisorInsights, type AdvisorResponse, CONTEXT_OPTIONS, emptyAdvisorValues, toAdvisorPayload, validateAdvisor } from "@/lib/advisor";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const insights: AdvisorInsights = {
  contract_version: "2",
  engine: "advisor-insights/1",
  opportunities: [
    {
      title: "Автоматично създаване на товарителници",
      category: "integration",
      fit: "high",
      explanation: "Свързване на системите.",
      basis: [{ source: "assessment", key: "assessment.opportunity.priority", label: "Приоритет в оценката: висока" }],
    },
  ],
  feasibility: {
    level: "medium",
    explanation: "Изпълнимо след изясняване.",
    factors: [{ effect: "limits", text: "Не е ясно как може да се достъпят системите.", basis: [{ source: "input", key: "context.system_access", label: "Достъп до системите: не знаем" }] }],
  },
  risk: { level: "high", items: [{ title: "Обработка на лични данни", explanation: "Минимизиране.", basis: [{ source: "input", key: "context.data_sensitivity", label: "Чувствителност на данните: лични данни" }] }] },
  domains: [{ domain: "data_integration", reason: "Свързване на системите.", basis: [] }],
  checkpoints: [{ step: "Уведомяване на клиента", reason: "Изисква одобрение.", basis: [{ source: "rule", key: "rule.write_needs_approval", label: "Правило: запис изисква одобрение" }] }],
  prerequisites: [
    { area: "integration", text: "Достъп до WooCommerce.", basis: [] },
    { area: "security", text: "Сервизни акаунти с минимални права.", basis: [] },
  ],
  pilot: { scope: "Пилот в един екип.", duration_weeks: [4, 8], success_criteria: ["Качеството е измерено."], human_in_the_loop: "Човек одобрява.", basis: [] },
  roadmap: [
    { horizon: 30, title: "Първите 30 дни: подготовка", items: ["Достъп"] },
    { horizon: 60, title: "До 60 дни: пилот", items: ["Пилот"] },
    { horizon: 90, title: "До 90 дни: решение", items: ["Решение"] },
  ],
  provenance_note: "Изчислено от фиксирани правила.",
};

const base: AdvisorResponse = {
  assessment_id: null,
  reference: null,
  mode: "demo",
  provider: "mock",
  model: "rule-based-v1",
  disclaimer: "Демонстрационен режим.",
  notices: [],
  stored: false,
  expires_at: null,
  created_at: "2026-10-29T10:00:00Z",
  assessment: {
    problem_summary: "Ръчно преписване.",
    opportunities: [{ title: "Автоматично създаване на товарителници", description: "Описание.", approach: "integration", priority: "high" }],
    proposed_workflow: [
      { title: "Нова поръчка", description: "Webhook.", actor: "system", requires_human_approval: false },
      { title: "Уведомяване на клиента", description: "Шаблон.", actor: "system", requires_human_approval: true },
    ],
    integrations: [{ system: "WooCommerce", purpose: "Поръчки.", access: "read_write" }],
    human_approvals: [{ decision: "Отказ", reason: "Засяга клиента." }],
    data_protection: ["Минимизиране."],
    risks: [{ risk: "Грешни адреси.", mitigation: "Валидиране." }],
    complexity: { level: "medium", rationale: "Средна." },
    phases: [{ name: "Анализ", description: "Карта.", deliverables: ["Карта"], indicative_duration: "1 седмица" }],
    clarification_questions: ["Въпрос 1?", "Въпрос 2?"],
    next_steps: ["Стъпка."],
  },
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/public/form-token") return json(200, { token: "tok-1" });
    if (url === "/api/public/advisor/status") return json(200, { mode: "demo", disclaimer: "Демо.", retention_days: 30 });
    if (url === "/api/public/advisor/assessments" && init?.method === "POST") {
      const body = JSON.parse(init.body as string);
      return json(201, body.contract_version === "2" ? { ...base, contract_version: "2", insights } : base);
    }
    return json(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

function renderTool() {
  return render(
    <AdvisorTool
      content={advisor}
      retentionDays={30}
      locale="bg"
      domainLinks={{ data_integration: { href: "/bg/uslugi/danni-i-integratsii", label: "Инженеринг на данни и интеграции" } }}
      contact={{
        labels: bg.form,
        messages: bg.validation,
        inquiry: bg.inquiry,
        services: [{ value: "automation", label: "Автоматизация" }],
        privacyHref: "/poveritelnost",
        nextSteps: [],
        aiLabels: bg.aiManagedForm,
        locale: "bg",
      }}
    />,
  );
}

async function fillV1(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/Вид бизнес/), "online_store");
  await user.click(screen.getByRole("button", { name: advisor.form.descriptionExample }));
  await user.selectOptions(screen.getByLabelText(/Приблизителен обем/), "500_2000");
  await user.selectOptions(screen.getByLabelText(/Размер на екипа/), "2_5");
  await user.click(screen.getByRole("checkbox", { name: "WooCommerce" }));
}

function posted() {
  const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/public/advisor/assessments" && init?.method === "POST");
  return call ? JSON.parse(call[1].body as string) : null;
}

describe("advisor V2 contract (client)", () => {
  it("keeps the V1 payload unless the visitor adds the context", () => {
    const v1 = toAdvisorPayload({ ...emptyAdvisorValues(), process_description: "текст" }, "tok", "bg");
    expect(v1).not.toHaveProperty("contract_version");
    expect(v1).not.toHaveProperty("context");
    const v2 = toAdvisorPayload(
      {
        ...emptyAdvisorValues(),
        deeper: true,
        include_roadmap: true,
        context: { goal: "save_time", data_sensitivity: "personal", customer_facing: "yes", system_access: "api", change_capacity: "no_it" },
      },
      "tok",
      "en",
    );
    expect(v2).toMatchObject({
      contract_version: "2",
      include_roadmap: true,
      context: { goal: "save_time", data_sensitivity: "personal", customer_facing: true, system_access: "api", change_capacity: "no_it" },
    });
  });

  it("requires every context field only when the context is added", () => {
    expect(Object.keys(validateAdvisor(emptyAdvisorValues(), advisor.validation)).some((k) => k.startsWith("context."))).toBe(false);
    const errors = validateAdvisor({ ...emptyAdvisorValues(), deeper: true }, advisor.validation);
    expect(Object.keys(errors).filter((k) => k.startsWith("context.")).sort()).toEqual(
      ["context.change_capacity", "context.customer_facing", "context.data_sensitivity", "context.goal", "context.system_access"],
    );
    const tampered = validateAdvisor(
      { ...emptyAdvisorValues(), deeper: true, context: { goal: "get_rich", data_sensitivity: "none", customer_facing: "no", system_access: "api", change_capacity: "no_it" } },
      advisor.validation,
    );
    expect(tampered["context.goal"]).toBe(advisor.validation.select);
  });

  it("has a label for every context option in both languages", () => {
    for (const content of [advisor, enAdvisor]) {
      for (const [field, options] of Object.entries(CONTEXT_OPTIONS)) {
        for (const option of options) expect((content.v2.options[field as keyof typeof CONTEXT_OPTIONS] as Record<string, string>)[option], `${field}.${option}`).toBeTruthy();
      }
    }
    expect(JSON.stringify(enAdvisor.v2)).not.toMatch(/[Ѐ-ӿ]/);
  });
});

describe("advisor V2 (UI)", () => {
  it("sends V1 by default and shows no insights", async () => {
    const user = userEvent.setup();
    renderTool();
    await fillV1(user);
    await user.click(screen.getByRole("button", { name: advisor.form.submit }));
    await screen.findByTestId("advisor-result");
    expect(posted()).not.toHaveProperty("contract_version");
    expect(screen.queryByTestId("advisor-insights")).toBeNull();
  });

  it("asks for the context, sends V2 and explains every insight", async () => {
    const user = userEvent.setup();
    renderTool();
    await fillV1(user);
    await user.click(screen.getByRole("checkbox", { name: advisor.v2.toggle }));
    await user.click(screen.getByRole("button", { name: advisor.form.submit }));
    // Focus moves in requestAnimationFrame, so wait for it (CI machines are slower).
    await waitFor(() => expect(screen.getByLabelText(/Основна цел/)).toHaveFocus());
    expect(posted()).toBeNull();

    await user.selectOptions(screen.getByLabelText(/Основна цел/), "save_time");
    await user.selectOptions(screen.getByLabelText(/Какви данни се обработват/), "personal");
    await user.selectOptions(screen.getByLabelText(/Как може да се достъпят системите/), "unknown");
    await user.selectOptions(screen.getByLabelText(/Кой ще поддържа решението/), "external_it");
    await user.click(within(screen.getByRole("group", { name: /Засяга ли процесът пряко клиенти/ })).getByRole("radio", { name: advisor.v2.yes }));
    await user.click(screen.getByRole("checkbox", { name: advisor.v2.includeRoadmap }));
    await user.click(screen.getByRole("button", { name: advisor.form.submit }));

    const view = await screen.findByTestId("advisor-insights");
    expect(posted()).toMatchObject({ contract_version: "2", include_roadmap: true, context: { customer_facing: true, system_access: "unknown" } });
    expect(within(view).getByRole("heading", { level: 2, name: advisor.v2.insights.title })).toBeInTheDocument();
    expect(within(screen.getByTestId("v2-feasibility")).getByText(/Основание: Достъп до системите: не знаем/)).toBeInTheDocument();
    expect(screen.getByTestId("v2-risk")).toHaveTextContent("Рисков профил: висока");
    expect(screen.getByTestId("v2-pilot")).toHaveTextContent("Ориентировъчно 4–8 седмици");
    expect(screen.getByTestId("v2-roadmap")).toHaveTextContent("До 90 дни: решение");
    expect(within(screen.getByTestId("v2-domains")).getByRole("link", { name: "Инженеринг на данни и интеграции" })).toHaveAttribute(
      "href",
      "/bg/uslugi/danni-i-integratsii",
    );
    expect(view).toHaveTextContent(insights.provenance_note);
  });
});

describe("advisor V2 texts", () => {
  it("never promise money or results", () => {
    for (const content of [advisor, enAdvisor]) {
      const text = JSON.stringify(content.v2);
      expect(text).not.toMatch(/\d+\s*(%|€|лв)|ROI|гарант|guarantee/i);
    }
  });
});

it("renders V1 responses from older saved data without insights", async () => {
  const user = userEvent.setup();
  renderTool();
  await fillV1(user);
  await user.click(screen.getByRole("button", { name: advisor.form.submit }));
  await waitFor(() => expect(screen.getByTestId("advisor-result")).toBeInTheDocument());
  expect(screen.queryByText(advisor.v2.insights.title)).toBeNull();
});
