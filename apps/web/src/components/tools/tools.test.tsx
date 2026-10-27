import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReadinessAssessment } from "@/components/tools/ReadinessAssessment";
import { ReadinessReport } from "@/components/tools/ReadinessReport";
import { ToolCard } from "@/components/tools/ToolCard";
import { ChoiceQuestion, StepProgress, ToolState } from "@/components/tools/ToolUi";
import { getContent } from "@/content";
import { registerAnalyticsSink, type ToolEvent } from "@/lib/analytics";
import { READINESS_MODEL_VERSION, READINESS_QUESTION_ORDER, type ReadinessAnswers } from "@/lib/readiness";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { tools, readinessTool } = getContent("en");
const labels = { liveBadge: tools.liveBadge, upcomingBadge: tools.upcomingBadge, ...tools.labels };

describe("shared tool UI", () => {
  it("marks the current step and announces the position", () => {
    render(<StepProgress steps={["Data", "Processes", "Systems"]} current={1} label="Progress" stepOf={tools.ui.stepOf} />);
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    const items = within(screen.getByRole("navigation", { name: "Progress" })).getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
  });

  it("wires a question's error to its fieldset", () => {
    const onChange = vi.fn();
    render(<ChoiceQuestion id="q1" label="Question?" options={["A", "B"]} value={undefined} error="Choose an answer." onChange={onChange} />);
    const group = screen.getByRole("group", { name: "Question?" });
    expect(group).toHaveAttribute("aria-invalid", "true");
    expect(group).toHaveAccessibleDescription("Choose an answer.");
  });

  it("links an available tool and never links a tool in preparation", () => {
    const [advisor, , , roi] = tools.items;
    render(
      <>
        <ToolCard tool={advisor} href="/en/ai-automation-advisor" minutes={3} labels={labels} />
        <ToolCard tool={roi} labels={labels} />
      </>,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: advisor.title })).toHaveAttribute("href", "/en/ai-automation-advisor");
    expect(screen.getByText("about 3 min")).toBeInTheDocument();
    const planned = screen.getByRole("heading", { name: roi.title }).closest("article")!;
    expect(planned).toHaveAttribute("data-status", "planned");
    expect(within(planned).getByText(tools.upcomingBadge)).toBeInTheDocument();
  });

  it("renders consistent states", () => {
    render(
      <>
        <ToolState kind="loading" title="Loading" />
        <ToolState kind="error" title="Failed" text="Try again later" />
        <ToolState kind="empty" title="Nothing yet" />
      </>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.getByRole("alert")).toHaveTextContent("Failed");
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });
});

describe("AI readiness assessment", () => {
  const services = {
    integrations: { href: "/en/services/integrations", label: "Integrations" },
    audit: { href: "/en/services/technical-audit", label: "AI strategy" },
    ai_managed: { href: "/en/services/ai-managed-services", label: "Managed" },
    ai_agents: { href: "/en/services/ai-agent-development", label: "Agents" },
  };

  it("validates each step, completes the flow and reports only non-personal events", async () => {
    const user = userEvent.setup();
    const events: ToolEvent[] = [];
    const unregister = registerAnalyticsSink((event) => events.push(event));
    render(<ReadinessAssessment content={readinessTool} ui={tools.ui} services={services} contactHref="/en/contact?service=audit" privacyHref="/en/privacy" locale="en" />);

    await user.click(screen.getByRole("button", { name: tools.ui.next }));
    expect(screen.getByRole("alert")).toHaveTextContent(tools.ui.errorSummary);
    expect(screen.getAllByText(tools.ui.required)).toHaveLength(2);

    for (let step = 0; step < 6; step++) {
      for (const group of screen.getAllByRole("group")) await user.click(within(group).getAllByRole("radio")[step % 2 === 0 ? 3 : 2]);
      await user.click(screen.getByRole("button", { name: step === 5 ? tools.ui.finish : tools.ui.next }));
    }

    const result = await screen.findByTestId("readiness-result");
    expect(within(result).getByTestId("tool-score")).toHaveTextContent(/^\d+$/);
    expect(within(result).getByRole("link", { name: readinessTool.leadCapture.cta })).toHaveAttribute("href", "/en/contact?service=audit");
    unregister();

    expect(events.map((e) => e.name)).toEqual([
      "tool_opened",
      "tool_started",
      "step_completed",
      "step_completed",
      "step_completed",
      "step_completed",
      "step_completed",
      "step_completed",
      "tool_completed",
    ]);
    for (const event of events) expect(Object.keys(event).every((k) => ["name", "tool", "locale", "step", "totalSteps", "result", "format"].includes(k))).toBe(true);
  });

  it("restores a complete shared result from the link", async () => {
    window.history.replaceState(null, "", "/en/tools/ai-readiness?r=444444444444");
    render(<ReadinessAssessment content={readinessTool} ui={tools.ui} services={services} contactHref="/en/contact" privacyHref="/en/privacy" locale="en" />);
    expect(await screen.findByTestId("tool-score")).toHaveTextContent("100");
    expect(screen.getByText(tools.ui.linkRestored)).toBeInTheDocument();
    window.history.replaceState(null, "", "/");
  });
});

describe("readiness report and submission", () => {
  const answers = Object.fromEntries(READINESS_QUESTION_ORDER.map((id) => [id, 3])) as ReadinessAnswers;
  const send = readinessTool.send;

  /** Records every request; answers the form token, the meta call and the given endpoint response. */
  function mockApi(respond: (url: string, init?: RequestInit) => Response) {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        if (url === "/api/public/form-token") return Response.json({ token: "signed-token" });
        if (url === "/api/public/readiness/meta") {
          return Response.json({ model_version: READINESS_MODEL_VERSION, retention_days: 365, email_delivery: false });
        }
        return respond(url, init);
      }),
    );
    return calls;
  }

  afterEach(() => vi.unstubAllGlobals());

  function renderReport() {
    render(<ReadinessReport content={readinessTool} answers={answers} overall={75} locale="en" privacyHref="/en/privacy" />);
  }

  it("downloads the PDF by sending only answer levels, locale and versions", async () => {
    const user = userEvent.setup();
    const calls = mockApi(
      () => new Response(new Blob(["%PDF-1.4"]), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="ai-readiness-report.pdf"' } }),
    );
    const createObjectURL = vi.fn(() => "blob:report");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }); // jsdom has no object URLs
    renderReport();

    await user.type(screen.getByLabelText(readinessTool.report.companyLabel), "Example Ltd");
    await user.click(screen.getByRole("button", { name: readinessTool.report.download }));

    expect(await screen.findByText(readinessTool.report.done)).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledOnce();
    const request = calls.find((c) => c.url === "/api/public/readiness/report")!;
    const body = JSON.parse(String(request.init?.body));
    expect(Object.keys(body).sort()).toEqual(["answers", "client_overall", "company", "form_token", "locale", "model_version", "schema_version"]);
    expect(body).toMatchObject({ answers, locale: "en", model_version: READINESS_MODEL_VERSION, schema_version: "1", company: "Example Ltd" });
    expect(calls.some((c) => c.url.includes("submissions"))).toBe(false);
  });

  it("explains a stale model version and a rate limit without losing the result", async () => {
    const user = userEvent.setup();
    let status = 422;
    mockApi(() =>
      status === 422
        ? Response.json({ detail: "x", errors: [{ field: "model_version", message: "old", type: "readiness_model" }] }, { status })
        : Response.json({ detail: "slow down" }, { status }),
    );
    renderReport();
    await user.click(screen.getByRole("button", { name: readinessTool.report.download }));
    expect(await screen.findByRole("alert")).toHaveTextContent(readinessTool.report.errors.stale);
    status = 429;
    await user.click(screen.getByRole("button", { name: readinessTool.report.download }));
    expect(await screen.findByText(readinessTool.report.errors.rateLimited)).toBeInTheDocument();
  });

  it("keeps the send form closed until asked, validates it and requires the privacy acknowledgement", async () => {
    const user = userEvent.setup();
    const calls = mockApi(() => Response.json({}, { status: 500 }));
    renderReport();

    expect(screen.queryByLabelText(new RegExp(send.email))).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: send.open });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByRole("checkbox", { name: send.marketing })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: send.consultation })).not.toBeChecked();
    expect(await screen.findByText(new RegExp("365 days"))).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: send.submit }));
    expect(screen.getByRole("alert")).toHaveTextContent(send.errorSummary);
    expect(screen.getByText(send.errors.privacy)).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(`^${send.name}`))).toHaveAttribute("aria-invalid", "true");
    expect(calls.some((c) => c.url.includes("submissions"))).toBe(false);
  });

  it("submits contact details with separate consents and shows the reference without promising an e-mail", async () => {
    const user = userEvent.setup();
    const calls = mockApi(() => Response.json({ reference: "AB12CD34", message: "Thank you!", overall: 75, band: "scaling" }, { status: 201 }));
    renderReport();
    await user.click(screen.getByRole("button", { name: send.open }));

    await user.type(screen.getByLabelText(new RegExp(`^${send.name}`)), "Maria Test");
    await user.type(screen.getByLabelText(new RegExp(`^${send.email}`)), "maria@example.com");
    await user.type(screen.getByLabelText(new RegExp(`^${send.company} \\*`)), "Example Ltd");
    await user.type(screen.getByLabelText(new RegExp(`^${send.role}`)), "Owner");
    await user.click(screen.getByRole("checkbox", { name: send.consultation }));
    await user.click(screen.getByRole("checkbox", { name: new RegExp(send.privacyLink) }));
    await user.click(screen.getByRole("button", { name: send.submit }));

    const success = await screen.findByTestId("readiness-send-success");
    expect(success).toHaveTextContent("AB12CD34");
    expect(success).toHaveTextContent(send.noEmail);
    const body = JSON.parse(String(calls.find((c) => c.url === "/api/public/readiness/submissions")!.init?.body));
    expect(body).toMatchObject({
      name: "Maria Test",
      email: "maria@example.com",
      consultation_requested: true,
      privacy_acknowledged: true,
      marketing_consent: false,
      website: "",
      model_version: READINESS_MODEL_VERSION,
      answers,
    });
  });
});
