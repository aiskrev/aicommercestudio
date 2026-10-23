import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdvisorTool } from "@/components/advisor/AdvisorTool";
import { advisor } from "@/content/bg/advisor";
import { bg } from "@/i18n/dictionaries/bg";
import {
  type AdvisorResponse,
  emptyAdvisorValues,
  toAdvisorPayload,
  toggleTool,
  validateAdvisor,
} from "@/lib/advisor";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const DEMO_DISCLAIMER = "Демонстрационен режим: това не е анализ, генериран от изкуствен интелект.";

const assessmentResponse: AdvisorResponse = {
  assessment_id: "8f1c2a8e-4b8e-4f0e-9a51-0d2d3c4b5a69",
  reference: "8F1C2A8E",
  mode: "demo",
  provider: "mock",
  model: "rule-based-v1",
  disclaimer: DEMO_DISCLAIMER,
  notices: ["Имейл адреси и телефонни номера бяха премахнати от описанието."],
  stored: true,
  expires_at: "2026-11-22T10:00:00Z",
  created_at: "2026-10-23T10:00:00Z",
  assessment: {
    problem_summary: "Ръчно преписване на поръчки и създаване на товарителници.",
    opportunities: [
      { title: "Автоматично създаване на товарителници", description: "Описание.", approach: "integration", priority: "high" },
    ],
    proposed_workflow: [
      { title: "Нова поръчка", description: "Webhook от магазина.", actor: "system", requires_human_approval: false },
      { title: "Уведомяване на клиента", description: "По одобрен шаблон.", actor: "system", requires_human_approval: true },
    ],
    integrations: [{ system: "WooCommerce", purpose: "Поръчки.", access: "read_write" }],
    human_approvals: [{ decision: "Отказ или промяна на поръчка", reason: "Засяга клиента." }],
    data_protection: ["Минимизиране на данните."],
    risks: [{ risk: "Грешни адреси.", mitigation: "Валидиране." }],
    complexity: { level: "medium", rationale: "Средна сложност." },
    phases: [{ name: "Анализ", description: "Карта на процеса.", deliverables: ["Карта"], indicative_duration: "около 1 седмица" }],
    clarification_questions: ["С кои куриери работите?", "Къде се води наличността?"],
    next_steps: ["Съберете реални примери."],
  },
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === "/api/public/form-token") return jsonResponse(200, { token: "tok-1" });
    if (url === "/api/public/advisor/status") return jsonResponse(200, { mode: "demo", disclaimer: DEMO_DISCLAIMER, retention_days: 30 });
    if (url === "/api/public/advisor/assessments" && init?.method === "POST") return jsonResponse(201, assessmentResponse);
    return jsonResponse(201, { status: "received", reference: "LEAD1234", message: "ok" });
  });
  vi.stubGlobal("fetch", fetchMock);
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderTool() {
  return render(
    <AdvisorTool
      content={advisor}
      retentionDays={30}
      locale="bg"
      contact={{
        labels: bg.form,
        messages: bg.validation,
        inquiry: bg.inquiry,
        services: [
          { value: "automation", label: "Автоматизация" },
          { value: "other", label: "Друго" },
        ],
        privacyHref: "/poveritelnost",
        nextSteps: [],
        aiLabels: bg.aiManagedForm,
        locale: "bg",
      }}
    />,
  );
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/Вид бизнес/), "online_store");
  await user.click(screen.getByRole("button", { name: advisor.form.descriptionExample }));
  await user.selectOptions(screen.getByLabelText(/Приблизителен обем/), "500_2000");
  await user.selectOptions(screen.getByLabelText(/Размер на екипа/), "2_5");
  await user.click(screen.getByRole("checkbox", { name: "WooCommerce" }));
}

function postedAssessment() {
  const call = fetchMock.mock.calls.find(([url, init]) => url === "/api/public/advisor/assessments" && init?.method === "POST");
  return call ? JSON.parse(call[1].body as string) : null;
}

describe("advisor validation helpers", () => {
  it("requires every field and a meaningful description", () => {
    const errors = validateAdvisor(emptyAdvisorValues(), advisor.validation);
    expect(Object.keys(errors).sort()).toEqual(["business_type", "monthly_volume", "process_description", "team_size", "tools"]);
    const short = validateAdvisor({ ...emptyAdvisorValues(), process_description: "кратко" }, advisor.validation);
    expect(short.process_description).toContain("40");
  });

  it("rejects links in other tools and too many links in the description", () => {
    const base = { ...emptyAdvisorValues(), other_tools: "https://spam.example" };
    expect(validateAdvisor(base, advisor.validation).other_tools).toBe(advisor.validation.noLinks);
    const links = "Описание на процеса с много връзки http://a.x http://b.x http://c.x http://d.x";
    expect(validateAdvisor({ ...emptyAdvisorValues(), process_description: links }, advisor.validation).process_description).toBe(
      advisor.validation.noLinks,
    );
  });

  it('treats "none" as exclusive', () => {
    expect(toggleTool(["shopify", "crm"], "none")).toEqual(["none"]);
    expect(toggleTool(["none"], "crm")).toEqual(["crm"]);
    expect(toggleTool(["crm"], "crm")).toEqual([]);
  });

  it("sends no personal-data fields, only the output language", () => {
    const payload = toAdvisorPayload({ ...emptyAdvisorValues(), process_description: "  текст  " }, "tok", "en");
    expect(Object.keys(payload).sort()).toEqual(
      [
        "business_type",
        "form_token",
        "locale",
        "monthly_volume",
        "other_tools",
        "process_description",
        "save_assessment",
        "team_size",
        "tools",
      ].sort(),
    );
    expect(payload.process_description).toBe("текст");
    expect(payload.locale).toBe("en");
  });
});

describe("AdvisorTool", () => {
  it("shows the demo notice before the visitor submits", async () => {
    renderTool();
    expect(await screen.findByTestId("advisor-demo-notice")).toHaveTextContent(DEMO_DISCLAIMER);
  });

  it("shows errors and sends nothing when the form is incomplete", async () => {
    const user = userEvent.setup();
    renderTool();
    await user.click(screen.getByRole("button", { name: advisor.form.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(advisor.form.errorSummary);
    expect(screen.getByLabelText(/Вид бизнес/)).toHaveAttribute("aria-invalid", "true");
    expect(postedAssessment()).toBeNull();
  });

  it("renders the structured assessment with the demo disclaimer", async () => {
    const user = userEvent.setup();
    renderTool();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: advisor.form.submit }));

    const result = await screen.findByTestId("advisor-result");
    expect(result).toHaveAttribute("data-mode", "demo");
    expect(screen.getByTestId("advisor-disclaimer")).toHaveTextContent(DEMO_DISCLAIMER);
    for (const heading of [
      advisor.result.summary,
      advisor.result.opportunities,
      advisor.result.workflow,
      advisor.result.integrations,
      advisor.result.approvals,
      advisor.result.dataProtection,
      advisor.result.risks,
      advisor.result.complexity,
      advisor.result.phases,
      advisor.result.questions,
      advisor.result.nextSteps,
    ]) {
      expect(within(result).getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(within(result).getByText(advisor.result.approvalRequired)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: advisor.result.demoTitle })).toHaveFocus();

    const sent = postedAssessment();
    expect(sent).toMatchObject({ business_type: "online_store", tools: ["woocommerce"], form_token: "tok-1", save_assessment: true });
  });

  it("opens a consultation form that attaches the stored assessment", async () => {
    const user = userEvent.setup();
    renderTool();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: advisor.form.submit }));
    await user.click(await screen.findByRole("button", { name: advisor.result.consultButton }));

    const consultation = screen.getByTestId("advisor-consultation");
    expect(within(consultation).getByText(/8F1C2A8E/, { selector: "div" })).toBeInTheDocument();
    expect(within(consultation).getByLabelText(/Описание на проекта/)).toHaveValue(
      advisor.result.consultMessage.replace("{ref}", "8F1C2A8E"),
    );
    expect(within(consultation).getByLabelText(/Услуга/)).toHaveValue("automation");

    await user.type(within(consultation).getByLabelText(/Име и фамилия/), "Иван Петров");
    await user.type(within(consultation).getByLabelText(/^Фирма/), "Примерна Фирма ЕООД");
    await user.type(within(consultation).getByLabelText(/^Имейл/), "ivan@example.com");
    await user.type(within(consultation).getByLabelText(/Описание на проекта/), "поръчки и товарителници.");
    await user.click(within(consultation).getByRole("checkbox", { name: /информацията за поверителност/ }));
    await user.click(within(consultation).getByRole("button", { name: bg.form.submit }));

    await waitFor(() => expect(screen.getByTestId("contact-success")).toBeInTheDocument());
    const leadCall = fetchMock.mock.calls.find(([url]) => url === "/api/public/leads");
    expect(JSON.parse(leadCall![1].body as string).advisor_assessment_id).toBe(assessmentResponse.assessment_id);
  });

  it("shows the server's message when the AI provider times out", async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/public/form-token") return jsonResponse(200, { token: "tok-1" });
      if (url === "/api/public/advisor/status") return jsonResponse(200, { mode: "ai", disclaimer: "AI", retention_days: 30 });
      if (init?.method === "POST") return jsonResponse(504, { detail: "Анализът отне твърде дълго.", code: "advisor_timeout" });
      return jsonResponse(404, {});
    });
    const user = userEvent.setup();
    renderTool();
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: advisor.form.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Анализът отне твърде дълго.");
    expect(screen.queryByTestId("advisor-demo-notice")).toBeNull();
  });
});
