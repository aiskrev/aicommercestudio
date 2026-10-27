import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiTeamBuilder } from "@/components/tools/team/AiTeamBuilder";
import { getContent } from "@/content";
import { registerAnalyticsSink, type ToolEvent } from "@/lib/analytics";
import { type TeamConfig, encodeTeam } from "@/lib/ai-team";

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
const ui = en.tools.ui;
const services = {
  ai_agents: { href: "/en/services/ai-agent-development", label: "AI agents" },
  integrations: { href: "/en/services/integrations", label: "Integrations" },
  ai_managed: { href: "/en/services/ai-managed-services", label: "Managed" },
};
type User = ReturnType<typeof userEvent.setup>;

function renderBuilder(locale: "en" | "bg" = "en") {
  const content = getContent(locale);
  render(
    <AiTeamBuilder content={content.teamTool} ui={content.tools.ui} services={services} contactHref={`/${locale}/contact`} locale={locale} />,
  );
}

const next = (user: User, label = ui.next) => user.click(screen.getByRole("button", { name: label }));

async function completeContext(user: User) {
  await user.click(screen.getByRole("radio", { name: t.context.industry.options.ecommerce }));
  await user.click(screen.getByRole("radio", { name: t.context.size.options.s11_50 }));
  await user.click(screen.getByRole("radio", { name: t.departments.options.support.title }));
  await user.click(screen.getByRole("radio", { name: t.context.challenge.options.slow_response }));
  await user.click(screen.getByRole("radio", { name: t.context.volume.options.v100_1k }));
  await next(user);
}

async function reachTeamStep(user: User) {
  await completeContext(user);
  await next(user); // departments: the lead department is preselected
  await user.click(screen.getByRole("checkbox", { name: t.agents.customer_support.name }));
  await next(user);
}

async function reachArchitecture(user: User) {
  await reachTeamStep(user);
  await user.click(screen.getByRole("radio", { name: new RegExp(`^${t.teamStep.deployment.options.managed_cloud.title}`) }));
  await user.click(screen.getByRole("radio", { name: new RegExp(`^${t.teamStep.operations.options.shared.title}`) }));
  await next(user);
}

afterEach(() => window.history.replaceState(null, "", "/"));

describe("AI team configurator", () => {
  it("validates the context step and keeps answers when going back", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await next(user);
    expect(screen.getByRole("alert")).toHaveTextContent(t.errors.summary);
    expect(screen.getAllByText(t.errors.required).length).toBe(4);
    expect(screen.getByRole("group", { name: t.context.industry.label })).toHaveAttribute("aria-invalid", "true");

    await completeContext(user);
    // Focus moves to the new step's heading on the next animation frame.
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: t.steps.departments.title })).toHaveFocus());
    // The lead department is in scope and cannot be removed.
    const lead = screen.getByRole("checkbox", { name: new RegExp(`^${t.departments.options.support.title}`) });
    expect(lead).toBeChecked();
    expect(lead).toBeDisabled();

    await user.click(screen.getByRole("button", { name: ui.back }));
    expect(screen.getByRole("radio", { name: t.context.industry.options.ecommerce })).toBeChecked();
    expect(screen.getByRole("radio", { name: t.context.challenge.options.slow_response })).toBeChecked();
  });

  it("requires a name for a custom department and never needs contact details", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await completeContext(user);
    await user.click(screen.getByRole("checkbox", { name: new RegExp(`^${t.departments.options.custom.title}`) }));
    await next(user);
    expect(screen.getByText(t.errors.customName)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.departments.customLabel), "Logistics desk");
    await next(user);
    expect(screen.getByRole("heading", { level: 2, name: t.steps.agents.title })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /e-?mail/i })).not.toBeInTheDocument();
  });

  it("recommends agents with reasons, adds dependencies and blocks removing them", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await completeContext(user);
    await next(user);

    const recommended = screen.getByTestId("agents-recommended");
    expect(within(recommended).getByRole("heading", { name: t.agents.customer_support.name })).toBeInTheDocument();
    expect(within(recommended).getAllByText(/Matches your challenge/).length).toBeGreaterThan(0);

    await next(user);
    expect(screen.getByRole("alert")).toHaveTextContent(t.errors.agents);

    const support = screen.getByRole("checkbox", { name: t.agents.customer_support.name });
    const knowledge = screen.getByRole("checkbox", { name: t.agents.knowledge_assistant.name });
    await user.click(support);
    expect(support).toBeChecked();
    expect(knowledge).toBeChecked();
    expect(knowledge).toBeDisabled();
    expect(knowledge).toHaveAccessibleDescription(/Needed by: Customer Support Agent/);
    expect(within(screen.getByTestId("team-summary")).getByText(t.agents.knowledge_assistant.name)).toBeInTheDocument();

    await user.click(support);
    expect(knowledge).not.toBeChecked();
    expect(knowledge).toBeEnabled();
  });

  it("explains that a coordinator needs at least two task agents", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await completeContext(user);
    await next(user);
    await user.click(screen.getByRole("checkbox", { name: t.agents.workflow_coordinator.name }));
    await user.click(screen.getByRole("checkbox", { name: t.agents.scheduling.name }));
    expect(screen.getByRole("status")).toHaveTextContent("at least 2 task agents (now: 1)");
    await next(user);
    expect(screen.getByRole("heading", { level: 2, name: t.steps.agents.title })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: t.agents.sales_research.name }));
    await next(user);
    expect(screen.getByRole("heading", { level: 2, name: t.steps.team.title })).toBeInTheDocument();
  });

  it("keeps approvals at or above the rule minimum and requires deployment choices", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await reachTeamStep(user);

    const settings = screen.getByTestId("settings-customer_support");
    expect(within(settings).getByRole("radio", { name: new RegExp(`^${t.checkpoints.none.title}`) })).toBeDisabled();
    expect(within(settings).getByRole("radio", { name: new RegExp(`^${t.checkpoints.sample_review.title}`) })).toBeDisabled();
    expect(within(settings).getByRole("radio", { name: new RegExp(`^${t.checkpoints.before_external.title}`) })).toBeChecked();
    await user.click(within(settings).getByRole("radio", { name: new RegExp(`^${t.checkpoints.every_action.title}`) }));
    expect(within(settings).getByRole("radio", { name: new RegExp(`^${t.checkpoints.every_action.title}`) })).toBeChecked();
    // Required integrations stay selected; optional ones can be added.
    expect(within(settings).getByRole("checkbox", { name: /Helpdesk/ })).toBeDisabled();
    await user.click(within(settings).getByRole("checkbox", { name: /E-mail/ }));
    expect(within(settings).getByRole("checkbox", { name: /E-mail/ })).toBeChecked();

    await next(user);
    expect(screen.getAllByText(t.errors.choose)).toHaveLength(2);
  });

  it("navigates the architecture with the keyboard and shows the connections", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await reachArchitecture(user);

    const diagram = document.querySelector<SVGElement>("svg[data-orientation='horizontal']")!;
    const nodes = [...diagram.querySelectorAll<SVGGElement>("[data-node]")];
    expect(nodes.map((n) => n.dataset.node)).toEqual(
      expect.arrayContaining(["users:team", "users:customers", "orchestration", "agent:customer_support", "approval:customer_support", "data:knowledge_base", "systems:helpdesk"]),
    );
    expect(nodes.filter((n) => n.tabIndex === 0)).toHaveLength(1);

    nodes[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(nodes[1]).toHaveFocus();
    await user.keyboard("{End}");
    expect(nodes.at(-1)).toHaveFocus();
    await user.keyboard("{Home}");
    const support = diagram.querySelector<SVGGElement>("[data-node='agent:customer_support']")!;
    support.focus();
    await user.keyboard("{Enter}");
    expect(support).toHaveAttribute("aria-pressed", "true");
    const details = screen.getByTestId("architecture-details");
    expect(details).toHaveTextContent(t.agents.customer_support.name);
    expect(details).toHaveTextContent(`→ ${t.architecture.edges.review} Approval: ${t.agents.customer_support.name}`);
    expect(details).toHaveTextContent(`→ ${t.architecture.edges.read} ${t.integrations.knowledge_base}`);
    await user.keyboard("{Escape}");
    expect(support).toHaveAttribute("aria-pressed", "false");
    expect(details).toHaveTextContent(t.architecture.selectPrompt);
    expect(within(screen.getByTestId("architecture-list")).getByText(t.integrations.helpdesk)).toBeInTheDocument();
  });

  it("completes with an explainable plan and reports only non-personal events", async () => {
    const user = userEvent.setup();
    const events: ToolEvent[] = [];
    const unregister = registerAnalyticsSink((event) => events.push(event));
    renderBuilder();
    await reachArchitecture(user);
    await next(user, ui.finish);

    const result = await screen.findByTestId("team-result");
    expect(screen.getByRole("heading", { level: 2, name: t.result.title })).toHaveFocus();
    expect(within(result).getByTestId("team-complexity")).toHaveTextContent(t.complexity.medium);
    expect(within(result).getByTestId("team-roles")).toHaveTextContent(t.agents.knowledge_assistant.name);
    expect(within(result).getByTestId("team-workflows")).toHaveTextContent(t.result.workflows.support_resolution.title);
    expect(within(result).getByTestId("team-risks")).toHaveTextContent(t.result.risks.customer_facing_errors.title);
    expect(within(result).getByTestId("team-prerequisites")).toHaveTextContent(t.result.prerequisites.knowledge_curation.title);
    expect(within(result).getByTestId("team-rollout")).toHaveTextContent(t.result.phases.pilot.title);
    expect(within(result).getByTestId("team-effort-note")).toHaveTextContent(/indicative estimate/);
    expect(within(result).getByTestId("team-complexity-factors").querySelectorAll("li")).toHaveLength(5);
    expect(screen.getByRole("link", { name: t.leadCapture.cta })).toHaveAttribute("href", "/en/contact");
    unregister();

    expect(events.map((e) => e.name)).toEqual([
      "tool_opened",
      "tool_started",
      "step_completed",
      "step_completed",
      "step_completed",
      "step_completed",
      "step_completed",
      "tool_completed",
    ]);
    expect(events.at(-1)).toMatchObject({ tool: "team", result: "medium" });
    for (const event of events) expect(Object.keys(event).every((k) => ["name", "tool", "locale", "step", "totalSteps", "result", "format"].includes(k))).toBe(true);
  });

  it("restores a shared configuration straight to the result", async () => {
    const config: TeamConfig = {
      context: { industry: "saas", size: "s51_250", leadDepartment: "sales", challenge: "lead_followup", volume: "v1k_10k" },
      departments: ["sales"],
      chosen: ["lead_qualification", "scheduling"],
      agents: {},
      deployment: "customer_cloud",
      operations: "internal",
    };
    window.history.replaceState(null, "", `/en/tools/ai-team?t=${encodeTeam(config)}`);
    renderBuilder();
    expect(await screen.findByTestId("team-result")).toHaveTextContent(t.result.workflows.lead_to_meeting.title);
    expect(screen.getByText(ui.linkRestored)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: ui.restart }));
    expect(screen.getByTestId("team-form")).toBeInTheDocument();
  });

  it("is fully localized in Bulgarian", async () => {
    const user = userEvent.setup();
    const bg = getContent("bg").teamTool;
    renderBuilder("bg");
    expect(screen.getByRole("heading", { level: 2, name: bg.steps.context.title })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: bg.context.industry.label })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: getContent("bg").tools.ui.next }));
    expect(screen.getByRole("alert")).toHaveTextContent(bg.errors.summary);
    expect(screen.getByTestId("team-summary")).toHaveTextContent(bg.summary.empty);
  });
});
