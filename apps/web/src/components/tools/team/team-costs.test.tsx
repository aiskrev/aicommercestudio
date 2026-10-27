import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiTeamTool } from "@/components/tools/team/AiTeamTool";
import { TeamCosts } from "@/components/tools/team/TeamCosts";
import { getContent } from "@/content";
import { TEAM_MODEL_VERSION, type TeamConfig, encodeTeam, toApiConfig } from "@/lib/ai-team";
import type { TeamEstimate, TeamMeta, TeamPlan } from "@/lib/team-api";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const en = getContent("en");
const t = en.teamTool;
const services = { ai_agents: { href: "/en/services/ai-agent-development", label: "AI agents" } };

const config: TeamConfig = {
  context: { industry: "ecommerce", size: "s11_50", leadDepartment: "support", challenge: "slow_response", volume: "v100_1k" },
  departments: ["support"],
  chosen: ["customer_support"],
  agents: {},
  deployment: "managed_cloud",
  operations: "shared",
};

function scenario(factor: number) {
  return {
    one_time: { discovery: 3000 * factor, agents: 12000 * factor, integrations: 4800 * factor, approvals: 600, deployment: 1200, testing: 3000, total: 24600 * factor },
    one_time_days: { discovery: 5, agents: 20, integrations: 8, approvals: 1, deployment: 2, testing: 5.6, total: 41.5 },
    integrations: [{ integration: "helpdesk", complexity: "medium" as const, days: 4 }],
    monthly: { infrastructure: 270, model_usage: 40 * factor, monitoring: 900, oversight: 1500 * factor, total: 2710 * factor },
    usage: { tasks_per_month: 1000, input_tokens: 11_000_000, output_tokens: 1_400_000 },
    oversight: { reviews_per_month: 300, hours_per_month: 10 },
    monitoring_hours: { studio: 8, internal: 4 },
  };
}

const estimate: TeamEstimate = {
  assumptions_version: "2026-10.1",
  currency: "EUR",
  rates: { day_rate: 600, internal_hourly_rate: 30, price_per_million_input: 3, price_per_million_output: 15 },
  overrides: {},
  scenarios: { conservative: scenario(1), expected: scenario(2), higher: scenario(3) },
  ranges: { one_time: [24600, 73800], monthly: [2710, 8130] },
};
const plan: TeamPlan = {
  model_version: TEAM_MODEL_VERSION,
  security: ["least_privilege", "untrusted_input"],
  data_flows: [{ kind: "read", agent: "customer_support", via: null, integration: "knowledge_base", approval: null }],
  estimate,
};
const meta: TeamMeta = {
  model_version: TEAM_MODEL_VERSION,
  retention_days: 90,
  submission_retention_days: 365,
  email_delivery: false,
  assumptions: {
    version: "2026-10.1",
    currency: "EUR",
    editable: {
      day_rate: { min: 200, max: 2500, default: 600 },
      internal_hourly_rate: { min: 5, max: 250, default: 30 },
      price_per_million_input: { min: 0, max: 100, default: 3 },
      price_per_million_output: { min: 0, max: 300, default: 15 },
    },
  },
};

type Call = { url: string; body: Record<string, unknown> };

function mockApi(overrides: Partial<Record<string, (body: Record<string, unknown>) => Response>> = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      calls.push({ url, body });
      const handler = overrides[url];
      if (handler) return handler(body);
      if (url === "/api/public/form-token") return Response.json({ token: "signed-token" });
      if (url === "/api/public/team/meta") return Response.json(meta);
      if (url === "/api/public/team/estimate") return Response.json(plan);
      return Response.json({}, { status: 500 });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("cost estimate panel", () => {
  it("shows ranges and switches scenarios", async () => {
    const user = userEvent.setup();
    render(
      <TeamCosts
        content={t}
        locale="en"
        estimate={estimate}
        status="ready"
        meta={meta}
        overrides={{}}
        integrationName={(k) => k}
        complexityName={(k) => k}
        onApply={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    const ranges = screen.getByTestId("team-cost-ranges");
    expect(ranges).toHaveTextContent("€24,600");
    expect(ranges).toHaveTextContent("€73,800");
    expect(screen.getByTestId("team-one_time-total")).toHaveTextContent("€49,200");
    await user.click(screen.getByRole("radio", { name: t.costs.scenarios.higher.title }));
    expect(screen.getByTestId("team-one_time-total")).toHaveTextContent("€73,800");
    expect(screen.getByTestId("team-costs-higher")).toHaveTextContent("1000 tasks/month");
    expect(screen.getByTestId("team-cost-disclaimer")).toHaveTextContent("does not create or run working agents");
  });

  it("validates editable assumptions against the published bounds and applies only changes", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <TeamCosts content={t} locale="en" estimate={estimate} status="ready" meta={meta} overrides={{}} integrationName={(k) => k} complexityName={(k) => k} onApply={onApply} onRetry={vi.fn()} />,
    );
    const dayRate = screen.getByLabelText(t.costs.editable.day_rate.label);
    await user.clear(dayRate);
    await user.type(dayRate, "99");
    await user.click(screen.getByRole("button", { name: t.costs.apply }));
    expect(screen.getByText("Enter a value between 200 and 2500.")).toBeInTheDocument();
    expect(dayRate).toHaveAttribute("aria-invalid", "true");
    expect(onApply).not.toHaveBeenCalled();

    await user.clear(dayRate);
    await user.type(dayRate, "800");
    await user.click(screen.getByRole("button", { name: t.costs.apply }));
    expect(onApply).toHaveBeenCalledWith({ day_rate: 800 });
    await user.click(screen.getByRole("button", { name: t.costs.reset }));
    expect(onApply).toHaveBeenLastCalledWith({});
  });
});

describe("configurator plan, export and consultation", () => {
  async function renderResult() {
    window.history.replaceState(null, "", `/en/tools/ai-team?t=${encodeTeam(config)}`);
    render(<AiTeamTool content={t} ui={en.tools.ui} services={services} contactHref="/en/contact" privacyHref="/en/privacy" locale="en" />);
    await screen.findByTestId("team-result");
  }

  it("fetches the plan with only enumerated values and recalculates with overrides", async () => {
    const user = userEvent.setup();
    const calls = mockApi();
    await renderResult();
    expect(await screen.findByTestId("team-security")).toHaveTextContent(t.security.items.untrusted_input.title);
    expect(screen.getByTestId("team-data-flows")).toHaveTextContent("Customer Support Agent reads from Knowledge base");
    expect(screen.getByTestId("team-hitl")).toHaveTextContent(t.checkpoints.before_external.title);

    const first = calls.find((c) => c.url === "/api/public/team/estimate")!;
    expect(first.body).toEqual({ schema_version: "1", model_version: TEAM_MODEL_VERSION, locale: "en", config: toApiConfig(config) });

    const dayRate = await screen.findByLabelText(t.costs.editable.day_rate.label);
    await user.clear(dayRate);
    await user.type(dayRate, "750");
    await user.click(screen.getByRole("button", { name: t.costs.apply }));
    await waitFor(() => expect(calls.filter((c) => c.url === "/api/public/team/estimate")).toHaveLength(2));
    expect(calls.filter((c) => c.url === "/api/public/team/estimate")[1].body.overrides).toEqual({ day_rate: 750 });
  });

  it("shows a retryable error when the estimate fails", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockApi({ "/api/public/team/estimate": () => (fail ? Response.json({ detail: "x" }, { status: 503 }) : Response.json(plan)) });
    await renderResult();
    const costs = screen.getByTestId("team-costs");
    expect(await within(costs).findByRole("alert")).toHaveTextContent(t.costs.error);
    fail = false;
    await user.click(within(costs).getByRole("button", { name: t.costs.apply }));
    expect(await screen.findByTestId("team-cost-ranges")).toBeInTheDocument();
  });

  it("saves a configuration and shows a private link", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "/api/public/team/configurations": () => Response.json({ reference: "AB12CD34", token: "secret-token-value-0123456789abcdef", expires_at: "2027-01-25T10:00:00Z" }, { status: 201 }),
    });
    await renderResult();
    await user.click(within(screen.getByTestId("team-save")).getByRole("button", { name: t.save.button }));
    expect(await screen.findByTestId("team-saved-link")).toHaveValue("http://localhost:3000/en/tools/ai-team?c=secret-token-value-0123456789abcdef");
    const save = calls.find((c) => c.url === "/api/public/team/configurations")!;
    expect(Object.keys(save.body).sort()).toEqual(["config", "form_token", "locale", "model_version", "schema_version"]);
  });

  it("requires explicit privacy consent for a consultation and keeps marketing separate", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "/api/public/team/submissions": () => Response.json({ reference: "EF56AB78", message: "Thank you!" }, { status: 201 }),
    });
    await renderResult();
    const consult = screen.getByTestId("team-consult");
    await user.click(within(consult).getByRole("button", { name: t.consult.open }));
    expect(within(consult).getByRole("checkbox", { name: t.consult.marketing })).not.toBeChecked();
    expect(await within(consult).findByTestId("team-consult-storage")).toHaveTextContent("365 days");

    await user.click(within(consult).getByRole("button", { name: t.consult.submit }));
    expect(within(consult).getByText(t.consult.errors.privacy)).toBeInTheDocument();
    expect(calls.some((c) => c.url.endsWith("/submissions"))).toBe(false);

    await user.type(within(consult).getByLabelText(new RegExp(`^${t.consult.name}`)), "Maria Test");
    await user.type(within(consult).getByLabelText(new RegExp(`^${t.consult.email}`)), "maria@example.com");
    await user.type(within(consult).getByLabelText(new RegExp(`^${t.consult.company} \\*`)), "Example Ltd");
    await user.type(within(consult).getByLabelText(new RegExp(`^${t.consult.role}`)), "Owner");
    await user.click(within(consult).getByRole("checkbox", { name: new RegExp(t.consult.privacyLink) }));
    await user.click(within(consult).getByRole("button", { name: t.consult.submit }));

    const success = await screen.findByTestId("team-consult-success");
    expect(success).toHaveTextContent("EF56AB78");
    expect(success).toHaveTextContent(t.consult.noEmail);
    const body = calls.find((c) => c.url === "/api/public/team/submissions")!.body;
    expect(body).toMatchObject({ privacy_acknowledged: true, marketing_consent: false, website: "", config: toApiConfig(config) });
  });

  it("downloads the PDF plan", async () => {
    const user = userEvent.setup();
    mockApi({
      "/api/public/team/report": () =>
        new Response(new Blob(["%PDF-1.4"]), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="ai-team-plan.pdf"' } }),
    });
    const createObjectURL = vi.fn(() => "blob:plan");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }); // jsdom has no object URLs
    await renderResult();
    await user.click(within(screen.getByTestId("team-report")).getByRole("button", { name: t.report.download }));
    expect(await screen.findByText(t.report.done)).toBeInTheDocument();
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it("loads a saved configuration from a private link", async () => {
    const calls = mockApi({
      "/api/public/team/configurations/lookup": () =>
        Response.json({ reference: "AB12CD34", expires_at: "2027-01-25T10:00:00Z", model_version: TEAM_MODEL_VERSION, config: toApiConfig(config), overrides: { day_rate: 700 } }),
    });
    window.history.replaceState(null, "", "/en/tools/ai-team?c=secret-token-value-0123456789abcdef");
    render(<AiTeamTool content={t} ui={en.tools.ui} services={services} contactHref="/en/contact" privacyHref="/en/privacy" locale="en" />);
    expect(await screen.findByText(t.save.loaded)).toBeInTheDocument();
    expect(screen.getByTestId("team-result")).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith("/lookup"))!.body).toEqual({ token: "secret-token-value-0123456789abcdef" });
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/estimate"))?.body.overrides).toEqual({ day_rate: 700 }));
  });

  it("falls back to an empty configurator when a saved link is unknown", async () => {
    mockApi({ "/api/public/team/configurations/lookup": () => Response.json({ detail: "not found" }, { status: 404 }) });
    window.history.replaceState(null, "", "/en/tools/ai-team?c=unknown-token-value-0123456789abcdef");
    render(<AiTeamTool content={t} ui={en.tools.ui} services={services} contactHref="/en/contact" privacyHref="/en/privacy" locale="en" />);
    expect(await screen.findByText(t.save.loadError)).toBeInTheDocument();
    expect(screen.getByTestId("team-form")).toBeInTheDocument();
  });
});
