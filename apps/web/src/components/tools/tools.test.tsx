import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ReadinessAssessment } from "@/components/tools/ReadinessAssessment";
import { ToolCard } from "@/components/tools/ToolCard";
import { ChoiceQuestion, StepProgress, ToolState } from "@/components/tools/ToolUi";
import { getContent } from "@/content";
import { registerAnalyticsSink, type ToolEvent } from "@/lib/analytics";

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
    const [advisor, , team] = tools.items;
    render(
      <>
        <ToolCard tool={advisor} href="/en/ai-automation-advisor" minutes={3} labels={labels} />
        <ToolCard tool={team} labels={labels} />
      </>,
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link", { name: advisor.title })).toHaveAttribute("href", "/en/ai-automation-advisor");
    expect(screen.getByText("about 3 min")).toBeInTheDocument();
    const planned = screen.getByRole("heading", { name: team.title }).closest("article")!;
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
    render(<ReadinessAssessment content={readinessTool} ui={tools.ui} services={services} contactHref="/en/contact?service=audit" locale="en" />);

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
    render(<ReadinessAssessment content={readinessTool} ui={tools.ui} services={services} contactHref="/en/contact" locale="en" />);
    expect(await screen.findByTestId("tool-score")).toHaveTextContent("100");
    expect(screen.getByText(tools.ui.linkRestored)).toBeInTheDocument();
    window.history.replaceState(null, "", "/");
  });
});
