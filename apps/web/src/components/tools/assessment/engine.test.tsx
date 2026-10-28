import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EngineAssessment } from "@/components/tools/assessment/EngineAssessment";
import { engineeringTool } from "@/content/bg/tool-engineering";
import { engineeringTool as enEngineeringTool } from "@/content/en/tool-engineering";
import {
  type AssessmentDefinitionView,
  type AssessmentResultView,
  invalidNumbers,
  missingRequired,
  type ReportDocument,
  toPayload,
} from "@/lib/assessment-api";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const definition: AssessmentDefinitionView = {
  key: "devops_delivery",
  version: "1.1.0",
  locale: "en",
  title: "DevOps Delivery Maturity Assessment",
  intro: "Intro.",
  disclaimer: "A self-assessment.",
  dimensions: [
    { key: "version_control", title: "Version control", description: "Everything in version control." },
    { key: "feedback", title: "Incident learning and delivery feedback", description: "Reviews and data." },
  ],
  questions: [
    {
      key: "vc_review",
      type: "single_choice",
      dimension: "version_control",
      required: true,
      text: "Are changes reviewed before merging?",
      help: null,
      unit: null,
      evidence: "practice",
      options: [
        { key: "never", label: "No" },
        { key: "always", label: "Always, by convention" },
      ],
    },
    {
      key: "fb_postmortems",
      type: "single_choice",
      dimension: "feedback",
      required: true,
      text: "What happens after an incident?",
      help: null,
      unit: null,
      evidence: "practice",
      options: [
        { key: "nothing", label: "Nothing in particular" },
        { key: "reviews", label: "A blameless review" },
      ],
    },
    {
      key: "dora_deploy_frequency",
      type: "number",
      dimension: "feedback",
      required: false,
      text: "Production deployments in the last 30 days",
      help: "Only if you have an actual number. It is not scored.",
      unit: "deployments",
      evidence: "metric",
      min: 0,
      max: 10000,
      integer: true,
    },
  ],
};

const result: AssessmentResultView = {
  assessment: "devops_delivery",
  definition_version: "1.1.0",
  algorithm: "weighted-mean/1",
  title: "DevOps Delivery Maturity Assessment",
  overall: 33,
  band: { key: "developing", title: "Developing", description: "Basic practices exist." },
  dimensions: [
    { key: "version_control", title: "Version control", description: "", score: 0, level: { key: "initial", title: "Initial" } },
    { key: "feedback", title: "Incident learning and delivery feedback", description: "", score: 67, level: { key: "defined", title: "Defined" } },
  ],
  recommendations: [
    {
      key: "risk_no_review",
      title: "Changes without review",
      description: "Mistakes reach main.",
      kind: "risk",
      horizon: 30,
      domains: ["devops_sre"],
      because: ["“Are changes reviewed before merging?”: No"],
    },
    {
      key: "pattern_trunk_ci",
      title: "Pattern: trunk-based development with fast CI",
      description: "Short branches → review → CI.",
      kind: "pattern",
      horizon: 90,
      domains: ["devops_sre"],
      because: ["Trunk-based development and branching: 33/100, below the 75 threshold"],
    },
  ],
  roadmap: [
    { horizon: 30, items: ["risk_no_review"] },
    { horizon: 90, items: ["pattern_trunk_ci"] },
  ],
  domains: ["devops_sre"],
  inputs: [
    { question: "vc_review", dimension: "version_control", evidence: "practice", text: "Are changes reviewed before merging?", answer: "No" },
    { question: "dora_deploy_frequency", dimension: "feedback", evidence: "metric", text: "Production deployments in the last 30 days", answer: "12 deployments" },
  ],
  extras: { metrics_provided: 1, metrics_evidence: "unspecified" },
  disclaimer: "A self-assessment based on your answers.",
  saved: null,
};

const report: ReportDocument = {
  schema_version: "1",
  locale: "en",
  brand: "A.I. Commerce Studio",
  title: "DevOps Delivery Maturity Assessment",
  subtitle: "Self-assessment report",
  meta: [
    { label: "Methodology version", value: "1.1.0 (weighted-mean/1)" },
    { label: "Reference", value: "ABCD1234" },
  ],
  sections: [
    { heading: "Results", blocks: [{ type: "scores", rows: [{ label: "Version control", score: 0, level: "Initial" }] }] },
    { heading: "Risks", blocks: [{ type: "findings", because_label: "Why", items: [{ title: "<script>x</script>", description: "Text", label: "30 days", because: ["No review"] }] }] },
    { heading: "Limitations", blocks: [{ type: "paragraph", tone: "notice", text: "Not independently verified." }] },
  ],
  footer: "A.I. Commerce Studio",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fetchMock = vi.fn();
const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => String(url).startsWith(path)).map(([, init]) => (init?.body ? JSON.parse(init.body as string) : null));

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    if (url.startsWith("/api/public/assessments/devops_delivery/score")) {
      return json(200, body.save ? { ...result, saved: { reference: "ABCD1234", token: "secret-token-value-0123456789abcdef0123", expires_at: "2027-01-27T00:00:00Z" } } : result);
    }
    if (url.startsWith("/api/public/assessments/devops_delivery")) return json(200, definition);
    if (url.startsWith("/api/public/assessments/results/report")) {
      return body.format === "json" ? json(200, report) : new Response(new Blob(["%PDF-1.4"]), { status: 200, headers: { "Content-Type": "application/pdf" } });
    }
    if (url.startsWith("/api/public/assessments/results/consultation")) return json(201, { reference: "LEAD0001", message: "ok" });
    if (url.startsWith("/api/public/assessments/results/delete")) return new Response(null, { status: 204 });
    if (url === "/api/public/form-token") return json(200, { token: "form-1" });
    return json(404, {});
  });
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:report");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

function renderTool(content = enEngineeringTool) {
  return render(
    <EngineAssessment
      assessment="devops_delivery"
      tool="devops_maturity"
      content={content}
      locale="en"
      domainLinks={{ devops_sre: { href: "/en/services/devops-sre", label: "DevOps, SRE & Observability" } }}
      contactHref="/en/contact?service=audit"
      privacyHref="/en/privacy"
      retentionDays={90}
    />,
  );
}

async function complete(user: ReturnType<typeof userEvent.setup>, deployments = "12") {
  await screen.findByRole("heading", { level: 2, name: "Version control" });
  await user.click(screen.getByRole("radio", { name: "No" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("radio", { name: "A blameless review" }));
  if (deployments) await user.type(screen.getByLabelText(/Production deployments/), deployments);
  await user.click(screen.getByRole("button", { name: "See the result" }));
  return screen.findByTestId("engine-result");
}

describe("answer helpers", () => {
  it("finds missing required answers and invalid numbers", () => {
    expect(missingRequired(definition.questions, {})).toEqual(["vc_review", "fb_postmortems"]);
    expect(missingRequired(definition.questions, { vc_review: "always", fb_postmortems: "reviews" })).toEqual([]);
    const number = definition.questions[2];
    expect(invalidNumbers([number], { dora_deploy_frequency: "abc" })).toEqual(["dora_deploy_frequency"]);
    expect(invalidNumbers([number], { dora_deploy_frequency: "2.5" })).toEqual(["dora_deploy_frequency"]);
    expect(invalidNumbers([number], { dora_deploy_frequency: "20000" })).toEqual(["dora_deploy_frequency"]);
    expect(invalidNumbers([number], { dora_deploy_frequency: "" })).toEqual([]);
  });

  it("sends only answered values, numbers parsed", () => {
    expect(toPayload(definition.questions, { vc_review: "always", dora_deploy_frequency: "12", fb_postmortems: undefined })).toEqual({
      vc_review: "always",
      dora_deploy_frequency: 12,
    });
  });
});

describe("engine assessment wizard", () => {
  it("validates each step, keeps metrics optional and shows an explainable result", async () => {
    const user = userEvent.setup();
    renderTool();
    await screen.findByRole("heading", { level: 2, name: "Version control" });
    expect(screen.getByText("Area 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent(enEngineeringTool.wizard.errorSummary);
    expect(screen.getByText(enEngineeringTool.wizard.required)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("radio", { name: "No" })).toHaveFocus());

    await user.click(screen.getByRole("radio", { name: "No" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "Incident learning and delivery feedback" })).toHaveFocus());
    expect(screen.getByText(enEngineeringTool.wizard.metricsNote)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "A blameless review" }));
    await user.type(screen.getByLabelText(/Production deployments/), "2.5");
    await user.click(screen.getByRole("button", { name: "See the result" }));
    expect(screen.getByText("A number between 0 and 10000")).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/Production deployments/));
    await user.type(screen.getByLabelText(/Production deployments/), "12");
    await user.click(screen.getByRole("button", { name: "See the result" }));

    const view = await screen.findByTestId("engine-result");
    expect(calls("/api/public/assessments/devops_delivery/score")[0]).toEqual({
      schema_version: "1",
      definition_version: "1.1.0",
      locale: "en",
      answers: { vc_review: "never", fb_postmortems: "reviews", dora_deploy_frequency: 12 },
      save: false,
    });
    expect(screen.getByRole("heading", { level: 2, name: "Your result" })).toHaveFocus();
    const risks = screen.getByTestId("engine-findings-risk");
    expect(within(risks).getByText("Changes without review")).toBeInTheDocument();
    expect(within(risks).getByText("“Are changes reviewed before merging?”: No")).toBeInTheDocument();
    expect(within(risks).getByText("30 days")).toBeInTheDocument();
    expect(screen.getByTestId("engine-findings-pattern")).toHaveTextContent("trunk-based");
    expect(screen.getByTestId("engine-roadmap")).toHaveTextContent(enEngineeringTool.result.backlog);
    const metrics = screen.getByTestId("engine-metrics");
    expect(metrics).toHaveTextContent("Not verified by us and not scored.");
    expect(metrics).toHaveTextContent("No source given");
    expect(metrics).toHaveTextContent("12 deployments");
    expect(within(screen.getByTestId("engine-services")).getByRole("link", { name: "DevOps, SRE & Observability" })).toHaveAttribute(
      "href",
      "/en/services/devops-sre",
    );
    expect(view).toHaveTextContent(enEngineeringTool.result.selfReported);
  });

  it("shows the result without asking for contact details; saving and consultation are optional", async () => {
    const user = userEvent.setup();
    renderTool();
    await complete(user);
    expect(calls("/api/public/assessments/results/consultation")).toHaveLength(0);
    const consultation = screen.getByTestId("engine-consultation");
    expect(within(consultation).getByText(enEngineeringTool.consultation.needsSave)).toBeInTheDocument();
    expect(within(consultation).getByRole("link", { name: enEngineeringTool.consultation.contact })).toHaveAttribute("href", "/en/contact?service=audit");
    expect(screen.queryByTestId("engine-saved")).toBeNull();
  });

  it("saves on request, renders the accessible report and downloads the PDF", async () => {
    const user = userEvent.setup();
    renderTool();
    await complete(user);
    await user.click(screen.getByRole("button", { name: enEngineeringTool.report.create }));
    expect(await screen.findByTestId("engine-saved")).toHaveTextContent("ABCD1234");
    expect(calls("/api/public/assessments/devops_delivery/score")[1].save).toBe(true);

    await user.click(screen.getByRole("button", { name: enEngineeringTool.report.view }));
    const reportView = await screen.findByTestId("engine-report-view");
    expect(reportView).toHaveAttribute("lang", "en");
    expect(within(reportView).getByRole("heading", { level: 3, name: "Results" })).toBeInTheDocument();
    expect(within(reportView).getByText("<script>x</script> · 30 days".split(" · ")[0], { exact: false })).toBeInTheDocument();
    expect(reportView.querySelector("script")).toBeNull();
    expect(within(reportView).getByRole("note")).toHaveTextContent("Not independently verified.");
    const reportCall = calls("/api/public/assessments/results/report")[0];
    expect(reportCall).toEqual({ token: "secret-token-value-0123456789abcdef0123", format: "json" });
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("secret-token"))).toBe(true);

    await user.click(screen.getByRole("button", { name: enEngineeringTool.report.pdf }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    expect(calls("/api/public/assessments/results/report")[1].format).toBe("pdf");

    await user.click(screen.getByRole("button", { name: enEngineeringTool.report.delete }));
    expect(await screen.findByText(enEngineeringTool.report.deleted)).toBeInTheDocument();
    expect(screen.queryByTestId("engine-report-view")).toBeNull();
  });

  it("sends a consultation only with privacy acknowledged; marketing consent stays separate and unticked", async () => {
    const user = userEvent.setup();
    renderTool();
    await complete(user, "");
    await user.click(screen.getByRole("button", { name: enEngineeringTool.report.create }));
    await screen.findByTestId("engine-saved");
    await user.click(screen.getByRole("button", { name: enEngineeringTool.consultation.open }));
    const form = screen.getByTestId("engine-consultation-form");
    expect(within(form).getByTestId("consult-marketing")).not.toBeChecked();
    await user.click(within(form).getByRole("button", { name: enEngineeringTool.consultation.submit }));
    expect(within(form).getByText(enEngineeringTool.consultation.privacyRequired)).toBeInTheDocument();
    expect(calls("/api/public/assessments/results/consultation")).toHaveLength(0);

    await user.type(within(form).getByLabelText(/^Name/), "Ivana Petrova");
    await user.type(within(form).getByLabelText(/Work email/), "ivana@example.com");
    await user.type(within(form).getByLabelText(/^Company/), "Example Ltd");
    await user.click(within(form).getByTestId("consult-privacy"));
    await user.click(within(form).getByRole("button", { name: enEngineeringTool.consultation.submit }));
    expect(await screen.findByText("Thank you! Reference: LEAD0001.")).toBeInTheDocument();
    expect(calls("/api/public/assessments/results/consultation")[0]).toMatchObject({
      token: "secret-token-value-0123456789abcdef0123",
      privacy_acknowledged: true,
      marketing_consent: false,
      website: "",
      form_token: "form-1",
    });
  });

  it("says when consultations are rate limited instead of failing silently", async () => {
    const user = userEvent.setup();
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.startsWith("/api/public/assessments/results/consultation") ? json(429, { code: "rate_limited" }) : original(url, init),
    );
    renderTool();
    await complete(user, "");
    await user.click(screen.getByRole("button", { name: enEngineeringTool.report.create }));
    await screen.findByTestId("engine-saved");
    await user.click(screen.getByRole("button", { name: enEngineeringTool.consultation.open }));
    const form = screen.getByTestId("engine-consultation-form");
    await user.type(within(form).getByLabelText(/^Name/), "Ivana Petrova");
    await user.type(within(form).getByLabelText(/Work email/), "ivana@example.com");
    await user.type(within(form).getByLabelText(/^Company/), "Example Ltd");
    await user.click(within(form).getByTestId("consult-privacy"));
    await user.click(within(form).getByRole("button", { name: enEngineeringTool.consultation.submit }));
    expect(await within(form).findByRole("alert")).toHaveTextContent(enEngineeringTool.consultation.rateLimited);
  });

  it("explains a failed load and an outdated definition", async () => {
    fetchMock.mockImplementationOnce(async () => json(500, {}));
    renderTool();
    expect(await screen.findByText(enEngineeringTool.wizard.loadError)).toBeInTheDocument();
  });
});

describe("engineering texts", () => {
  it("are complete in both languages and the English has no Cyrillic", () => {
    const keys = (value: unknown): string[] =>
      value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v).map((x) => `${k}.${x}`)]) : [];
    expect(keys(enEngineeringTool)).toEqual(keys(engineeringTool));
    expect(JSON.stringify(enEngineeringTool)).not.toMatch(/[Ѐ-ӿ]/);
  });

  it("never claim verification, certification or scanning", () => {
    for (const content of [engineeringTool, enEngineeringTool]) {
      const text = JSON.stringify(content).toLowerCase();
      expect(text).not.toMatch(/certified|сертифицира|we scanned|сканирахме|guarantee|гарант/);
    }
  });
});
