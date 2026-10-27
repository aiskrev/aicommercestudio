import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AgentLibraryBrowser, type LibraryCard } from "@/components/agents/AgentLibraryBrowser";
import { SolutionBuilder } from "@/components/tools/solution/SolutionBuilder";
import { getContent } from "@/content";
import { LIBRARY } from "@/lib/agent-library";
import { registerAnalyticsSink, type ToolEvent } from "@/lib/analytics";
import { EMPTY_SOLUTION, WORKFLOW_DEFAULTS, encodeSolution } from "@/lib/solution";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const en = getContent("en");
const t = en.solutionTool;
const team = en.teamTool;
const ui = en.tools.ui;
const services = {
  ai_agents: { href: "/en/services/ai-agent-development", label: "AI agents" },
  integrations: { href: "/en/services/integrations", label: "Integrations" },
};
type User = ReturnType<typeof userEvent.setup>;

function renderBuilder(locale: "en" | "bg" = "en") {
  const content = getContent(locale);
  return render(
    <SolutionBuilder
      content={content.solutionTool}
      team={content.teamTool}
      library={content.agentLibrary}
      ui={content.tools.ui}
      services={services}
      contactHref={`/${locale}/contact`}
      libraryHref={`/${locale}/ai-agents`}
      agentHrefs={{ customer_support: `/${locale}/ai-agents/customer-support-agent` }}
      locale={locale}
    />,
  );
}

const card = (title: string) => new RegExp(`^${title.replace(/[()]/g, "\\$&")}`);
const next = (user: User, label = ui.next) => user.click(screen.getByRole("button", { name: label }));

async function reachSecurity(user: User) {
  await user.click(screen.getByRole("radio", { name: card(t.objectives.faster_response.title) }));
  await next(user);
  await user.click(screen.getByRole("radio", { name: card(team.result.workflows.support_resolution.title) }));
  await next(user);
  await next(user); // capabilities: suggested for the workflow
  await next(user); // integrations: suggested for the workflow
}

afterEach(() => window.history.replaceState(null, "", "/"));

describe("AI solution builder", () => {
  it("validates each step and says it is a design tool", async () => {
    const user = userEvent.setup();
    renderBuilder();
    expect(screen.getAllByText(t.designNotice).length).toBeGreaterThan(0);
    await next(user);
    expect(screen.getByRole("alert")).toHaveTextContent(t.errors.summary);
    expect(screen.getByText(t.errors.objective)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: card(t.objectives.grow_revenue.title) }));
    expect(screen.queryByText(t.errors.objective)).not.toBeInTheDocument();
  });

  it("prefills suggestions for the workflow and never asks for keys or free text", async () => {
    const user = userEvent.setup();
    const { container } = renderBuilder();
    await user.click(screen.getByRole("radio", { name: card(t.objectives.faster_response.title) }));
    await next(user);
    await user.click(screen.getByRole("radio", { name: card(team.result.workflows.support_resolution.title) }));
    await next(user);
    for (const capability of WORKFLOW_DEFAULTS.support_resolution.capabilities) {
      expect(screen.getByRole("checkbox", { name: card(t.capabilities[capability].title) })).toBeChecked();
    }
    expect(screen.getByRole("checkbox", { name: card(t.capabilities.tool_execution.title) })).not.toBeChecked();
    await next(user);
    expect(screen.getByText(t.integrationsNote)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: card(en.agentLibrary.categories.helpdesk.title) })).toBeChecked();
    await next(user);
    // Across all steps there is no field to type into: no password, key, token or free-text input.
    expect(container.querySelectorAll("input:not([type=radio]):not([type=checkbox]), textarea")).toHaveLength(0);
  });

  it("keeps approval at or above the rule minimum and forces redaction for personal data", async () => {
    const user = userEvent.setup();
    renderBuilder();
    await reachSecurity(user);
    await user.click(screen.getByRole("radio", { name: card(t.security.sensitivity.options.personal.title) }));
    expect(screen.getByRole("radio", { name: card(team.checkpoints.none.title) })).toBeDisabled();
    expect(screen.getByRole("radio", { name: card(team.checkpoints.sample_review.title) })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: card(team.checkpoints.before_external.title) }));
    expect(screen.getByRole("radio", { name: card(team.checkpoints.before_external.title) })).toBeChecked();
    expect(screen.getByText(t.security.approvalReasons.external_output)).toBeInTheDocument();
    const redaction = screen.getByRole("checkbox", { name: card(t.security.redaction.label) });
    expect(redaction).toBeChecked();
    expect(redaction).toBeDisabled();
    await next(user);
    expect(screen.getByText(t.errors.deployment)).toBeInTheDocument();
  });

  it("reviews the architecture with selectable components and a table alternative, then completes", async () => {
    const user = userEvent.setup();
    const events: ToolEvent[] = [];
    const off = registerAnalyticsSink((event) => events.push(event));
    renderBuilder();
    await reachSecurity(user);
    await user.click(screen.getByRole("radio", { name: card(t.security.sensitivity.options.internal.title) }));
    await user.click(screen.getByRole("radio", { name: card(team.checkpoints.every_action.title) }));
    await user.click(screen.getByRole("radio", { name: team.teamStep.deployment.options.managed_cloud.title }));
    await next(user);

    const diagram = screen.getByTestId("solution-diagram");
    expect(within(diagram).getAllByRole("listitem").filter((li) => li.hasAttribute("data-layer"))).toHaveLength(7);
    const vector = within(diagram).getByRole("button", { name: t.components["retrieval:vector_index"].title });
    await user.click(vector);
    expect(vector).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("region", { name: t.result.detailsLabel })).toHaveTextContent(t.components["retrieval:vector_index"].text);
    expect(within(screen.getByTestId("solution-diagram-table")).getByText(team.agents.customer_support.name, { selector: "th" })).toBeInTheDocument();

    await next(user, t.generate);
    await waitFor(() => expect(screen.getByRole("heading", { name: t.result.title })).toHaveFocus());
    expect(screen.getByTestId("solution-summary")).toHaveTextContent(team.result.workflows.support_resolution.title);
    expect(screen.getByTestId("solution-complexity")).toHaveTextContent(team.complexity.low);
    expect(within(screen.getByTestId("solution-roadmap")).getAllByRole("listitem").filter((li) => li.dataset.phase)).toHaveLength(4);
    expect(screen.getByRole("link", { name: t.result.openAgent })).toHaveAttribute("href", "/en/ai-agents/customer-support-agent");
    expect(screen.getByRole("link", { name: t.leadCapture.cta })).toHaveAttribute("href", "/en/contact");
    expect(screen.getByText(t.result.disclaimer)).toBeInTheDocument();

    off();
    expect(events.map((e) => e.name)).toContain("tool_completed");
    for (const event of events) {
      expect(Object.keys(event).every((k) => ["name", "tool", "locale", "step", "totalSteps", "result", "format"].includes(k))).toBe(true);
      expect(event.tool).toBe("solution");
    }
  });

  it("opens with a workflow chosen from the agent library", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/?w=document_intake");
    renderBuilder();
    await user.click(screen.getByRole("radio", { name: card(t.objectives.fewer_errors.title) }));
    await next(user);
    expect(screen.getByRole("radio", { name: card(team.result.workflows.document_intake.title) })).toBeChecked();
    await next(user);
    expect(screen.getByRole("checkbox", { name: card(t.capabilities.extraction.title) })).toBeChecked();
  });

  it("restores a shared design straight to the plan, in Bulgarian too", () => {
    const code = encodeSolution({
      ...EMPTY_SOLUTION,
      objective: "fewer_errors",
      workflow: "document_intake",
      ...WORKFLOW_DEFAULTS.document_intake,
      sensitivity: "regulated",
      approval: "every_action",
      deployment: "on_premise",
    });
    window.history.replaceState(null, "", `/?s=${code}`);
    renderBuilder("bg");
    const bg = getContent("bg");
    expect(screen.getByText(bg.tools.ui.linkRestored)).toBeInTheDocument();
    expect(screen.getByTestId("solution-complexity")).toHaveTextContent(bg.teamTool.complexity.high);
    expect(within(screen.getByTestId("solution-integrations")).getAllByText(bg.solutionTool.result.gated)).toHaveLength(2);
  });

  it("ignores an invalid share code", () => {
    window.history.replaceState(null, "", "/?s=1.bogus");
    renderBuilder();
    expect(screen.getByTestId("solution-form")).toBeInTheDocument();
    expect(screen.queryByText(ui.linkRestored)).not.toBeInTheDocument();
  });
});

describe("agent library browser", () => {
  const lib = en.agentLibrary;
  const cards: LibraryCard[] = LIBRARY.map((entry) => ({
    key: entry.key,
    href: `/en/ai-agents/${entry.key}`,
    name: team.agents[entry.key].name,
    short: team.agents[entry.key].short,
    purpose: team.agents[entry.key].purpose,
    departments: entry.departments.map((d) => team.departments.options[d].title),
    approval: team.checkpoints[entry.approval].title,
    complexityLabel: team.complexity[entry.complexity],
  }));
  const renderLibrary = () =>
    render(
      <AgentLibraryBrowser
        content={lib}
        cards={cards}
        departmentNames={Object.fromEntries(Object.entries(team.departments.options).map(([k, v]) => [k, v.title])) as never}
        complexityNames={team.complexity}
        complexityLabel={lib.filters.complexity}
      />,
    );
  const visible = () => within(screen.getByTestId("library-cards")).getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

  it("lists every agent with a link to its page", () => {
    renderLibrary();
    expect(visible()).toHaveLength(LIBRARY.length);
    expect(screen.getByRole("link", { name: team.agents.scheduling.name })).toHaveAttribute("href", "/en/ai-agents/scheduling");
    expect(screen.getByTestId("library-count")).toHaveTextContent(`${LIBRARY.length} of ${LIBRARY.length}`);
  });

  it("filters by risk, integration and text, and resets", async () => {
    const user = userEvent.setup();
    renderLibrary();
    await user.selectOptions(screen.getByLabelText(lib.filters.risk), "high");
    expect(visible()).toEqual([team.agents.customer_support.name, team.agents.document_processing.name]);
    await user.selectOptions(screen.getByLabelText(lib.filters.category), "erp");
    await user.type(screen.getByLabelText(lib.filters.search), "invoices");
    expect(visible()).toEqual([team.agents.document_processing.name]);
    await user.type(screen.getByLabelText(lib.filters.search), " zzz");
    expect(screen.getByText(lib.filters.empty)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: lib.filters.reset }));
    expect(visible()).toHaveLength(LIBRARY.length);
  });
});
