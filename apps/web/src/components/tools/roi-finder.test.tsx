import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OpportunityFinder, finderSummaryText } from "@/components/tools/finder/OpportunityFinder";
import { ROI_PROCESS_KEY, RoiCalculator, roiSummaryText } from "@/components/tools/roi/RoiCalculator";
import { getContent } from "@/content";
import { registerAnalyticsSink, type ToolEvent } from "@/lib/analytics";
import { rankOpportunities } from "@/lib/finder";
import { calculateRoi } from "@/lib/roi";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const en = getContent("en");
const roi = en.roiTool;
const finder = en.finderTool;
type User = ReturnType<typeof userEvent.setup>;

afterEach(() => {
  window.history.replaceState(null, "", "/");
  window.sessionStorage.clear();
  push.mockReset();
});

function renderRoi(locale: "en" | "bg" = "en") {
  const content = getContent(locale);
  render(<RoiCalculator content={content.roiTool} ui={content.tools.ui} locale={locale} contactHref="/en/contact" finderHref="/en/tools/automation-finder" teamHref="/en/tools/ai-team" />);
}

async function fillRoi(user: User, values: Partial<Record<string, string>>) {
  for (const [field, value] of Object.entries(values)) {
    const input = screen.getByLabelText(roi.fields[field as keyof typeof roi.fields].label);
    await user.clear(input);
    await user.type(input, value!);
  }
}

describe("ROI calculator", () => {
  it("starts empty — no preset values and no result", () => {
    renderRoi();
    for (const field of ["volume", "minutes", "hourlyCost", "coverage", "timeReduction", "implementationCost"] as const) {
      expect(screen.getByLabelText(roi.fields[field].label)).toHaveValue("");
    }
    for (const option of screen.getAllByRole("radio")) expect(option).not.toBeChecked();
    expect(screen.getByTestId("roi-result")).toHaveTextContent(roi.result.empty);
    expect(screen.queryByTestId("roi-net-monthly")).not.toBeInTheDocument();
  });

  it("calculates live once every field, including the realisation share, is chosen", async () => {
    const user = userEvent.setup();
    const events: ToolEvent[] = [];
    const unregister = registerAnalyticsSink((e) => events.push(e));
    renderRoi();
    await fillRoi(user, {
      volume: "2000", minutes: "12", hourlyCost: "25", coverage: "60", timeReduction: "70", reviewMinutes: "2", exceptionRate: "0",
      implementationCost: "15000", runCost: "300", maintenanceCost: "200",
    });
    await user.click(screen.getByRole("radio", { name: "12 months" }));
    expect(screen.queryByTestId("roi-net-monthly")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: roi.realizationOptions[75] }));

    expect(screen.getByTestId("roi-current-cost")).toHaveTextContent("€10,000");
    expect(screen.getByTestId("roi-future-cost")).toHaveTextContent("€8,100");
    expect(screen.getByTestId("roi-net-monthly")).toHaveTextContent("€1,900");
    expect(screen.getByTestId("roi-payback")).toHaveTextContent("7.9 months");
    expect(screen.getByTestId("roi-net12")).toHaveTextContent("€7,800");
    expect(screen.getByTestId("roi-percent")).toHaveTextContent("37%");
    const capacity = screen.getByTestId("roi-capacity");
    expect(capacity).toHaveTextContent("128 h/month");
    expect(capacity).toHaveTextContent("€3,200");
    expect(capacity).toHaveTextContent("Only the chosen share (75%) counts as real savings.");
    expect(within(screen.getByTestId("roi-scenarios")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([roi.scenarioColumns.metric, "Conservative", "Base", "Optimistic"]);
    // The worked explanation substitutes the visitor's own numbers into each formula.
    const worked = screen.getByTestId("roi-worked");
    expect(within(worked).getByText(/^Current time = 2,000 × 12/)).toHaveTextContent("= 400 h/month");
    expect(worked).toHaveTextContent("Net monthly benefit = €2,400 − €500 = €1,900");
    expect(screen.getByText("Formula version: 2026-11.1")).toBeInTheDocument();
    expect(screen.getByTestId("roi-disclaimer")).toHaveTextContent(/^An illustrative estimate, not a verified financial outcome.*Formula version: 2026-11.1$/);

    // Changing the realisation share changes savings, not the released capacity.
    await user.click(screen.getByRole("radio", { name: roi.realizationOptions[0] }));
    expect(capacity).toHaveTextContent("€3,200");
    expect(screen.getByTestId("roi-payback")).toHaveTextContent(roi.result.paybackNever);
    unregister();
    expect(events.map((e) => e.name)).toEqual(["tool_opened", "tool_started", "tool_completed"]);
    expect(events.at(-1)).toMatchObject({ tool: "roi", result: "payback_reached" });
  });

  it("explains invalid values after leaving a field and on request", async () => {
    const user = userEvent.setup();
    renderRoi();
    await fillRoi(user, { coverage: "150" });
    await user.tab();
    expect(screen.getByText("Enter a value between 0 and 100.")).toBeInTheDocument();
    expect(screen.getByLabelText(roi.fields.coverage.label)).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryAllByText(roi.errors.required)).toHaveLength(0);
    await user.click(screen.getByRole("button", { name: roi.errors.summary }));
    expect(screen.getAllByText(roi.errors.required).length).toBeGreaterThan(5);
  });

  it("restores a shared calculation and prefills costs from the AI team configurator", () => {
    window.history.replaceState(null, "", "/en/tools/roi-calculator?r=2000~12~25~60~70~2~0~15000~300~200~12~75");
    renderRoi();
    expect(screen.getByText(en.tools.ui.linkRestored)).toBeInTheDocument();
    expect(screen.getByTestId("roi-net-monthly")).toHaveTextContent("€1,900");
  });

  it("takes only costs from the team link, never savings", () => {
    window.history.replaceState(null, "", "/en/tools/roi-calculator?impl=39120&run=840&maint=920&coverage=90");
    renderRoi();
    expect(screen.getByText(roi.prefilled)).toBeInTheDocument();
    expect(screen.getByLabelText(roi.fields.implementationCost.label)).toHaveValue("39120");
    expect(screen.getByLabelText(roi.fields.runCost.label)).toHaveValue("840");
    expect(screen.getByLabelText(roi.fields.maintenanceCost.label)).toHaveValue("920");
    expect(screen.getByLabelText(roi.fields.coverage.label)).toHaveValue("");
  });

  it("picks up the process name handed over by the finder", () => {
    window.sessionStorage.setItem(ROI_PROCESS_KEY, "Invoice processing");
    renderRoi();
    expect(screen.getByLabelText(roi.description.label)).toHaveValue("Invoice processing");
  });

  it("exports a text summary with the capacity/savings distinction and the disclaimer", () => {
    const inputs = { volume: 2000, minutes: 12, hourlyCost: 25, coverage: 60, timeReduction: 70, reviewMinutes: 2, exceptionRate: 0, implementationCost: 15000, runCost: 300, maintenanceCost: 200, horizon: 12, realization: 75 };
    const text = roiSummaryText(roi, inputs, calculateRoi(inputs), "en", "Invoices");
    expect(text).toContain("Value of released time (capacity, not cash): €3,200");
    expect(text).toContain("Realised monthly savings: €2,400");
    expect(text).toContain("Conservative");
    expect(text).toContain(roi.disclaimer);
    expect(text).toContain("Formula version: 2026-11.1");
    expect(text).toContain("Exception and rework rate: 0 %");
  });

  it("is localized in Bulgarian", () => {
    renderRoi("bg");
    const bg = getContent("bg").roiTool;
    expect(screen.getByLabelText(bg.fields.volume.label)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: bg.fields.realization.label })).toBeInTheDocument();
    expect(screen.getByTestId("roi-result")).toHaveTextContent(bg.result.empty);
  });
});

describe("opportunity finder", () => {
  const areaNames = Object.fromEntries(Object.entries(en.teamTool.departments.options).map(([k, v]) => [k, v.title])) as never;
  const agentNames = Object.fromEntries(Object.entries(en.teamTool.agents).map(([k, v]) => [k, v.name])) as never;

  function renderFinder() {
    render(
      <OpportunityFinder
        content={finder}
        ui={en.tools.ui}
        locale="en"
        areaNames={areaNames}
        agentNames={agentNames}
        contactHref="/en/contact"
        roiHref="/en/tools/roi-calculator"
        teamHref="/en/tools/ai-team"
        advisorHref="/en/ai-automation-advisor"
        services={{ ai_tools: { href: "/en/services/custom-ai-tools", label: "Custom AI engineering" }, automation: { href: "/en/services/business-process-automation", label: "AI workflow automation" } }}
        workshops={[{ href: "/en/services/ai-agents-and-business-automation", label: "AI agents and business automation" }]}
      />,
    );
  }

  async function rateAll(user: User, levels: number[]) {
    const groups = screen.getAllByRole("group");
    for (let i = 0; i < groups.length; i++) await user.click(within(groups[i]).getAllByRole("radio")[levels[i]]);
  }

  it("validates names and ratings, then ranks the processes with explainable output", async () => {
    const user = userEvent.setup();
    renderFinder();
    await user.click(screen.getByRole("button", { name: en.tools.ui.next }));
    expect(screen.getByText(finder.errors.name)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Process 1", { exact: true }), "Quarterly board report");
    await user.click(screen.getByRole("button", { name: finder.processes.add }));
    await user.type(screen.getByLabelText("Process 2", { exact: true }), "Invoice processing");
    await user.selectOptions(screen.getAllByLabelText(finder.processes.areaLabel)[1], "finance");
    await user.click(screen.getByRole("button", { name: en.tools.ui.next }));

    expect(screen.getByRole("heading", { level: 2, name: "Rating: Quarterly board report" })).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: en.tools.ui.next }));
    expect(screen.getAllByText(finder.errors.rating)).toHaveLength(10);
    await rateAll(user, [1, 2, 1, 1, 1, 3, 4, 2, 3, 4]);
    await user.click(screen.getByRole("button", { name: en.tools.ui.next }));
    await rateAll(user, [4, 4, 3, 2, 2, 1, 2, 3, 2, 2]);
    await user.click(screen.getByRole("button", { name: en.tools.ui.finish }));

    const result = await screen.findByTestId("finder-result");
    const cards = within(within(result).getByTestId("finder-opportunities")).getAllByRole("listitem", { name: "" }).filter((li) => li.hasAttribute("data-category"));
    expect(cards.map((c) => c.getAttribute("data-category"))).toEqual(["quick_win", "not_ready"]);
    expect(cards[0]).toHaveTextContent("Invoice processing");
    expect(within(cards[0]).getByTestId("finder-score")).toHaveTextContent("70");
    expect(cards[0]).toHaveTextContent(finder.patterns.ai_extraction.title);
    expect(cards[0]).toHaveTextContent(en.teamTool.agents.document_processing.name);
    expect(cards[0]).toHaveTextContent("Contribution to the score: process 32 + value 26 + ease 13");
    expect(within(cards[0]).getByTestId("finder-risk")).toHaveTextContent("Risk: Medium");
    expect(within(within(cards[0]).getByTestId("finder-services")).getByRole("link", { name: "Custom AI engineering" })).toHaveAttribute("href", "/en/services/custom-ai-tools");
    expect(within(result).getByTestId("finder-pilot")).toHaveTextContent("“Invoice processing” — AI classification and extraction");
    expect(within(result).getByTestId("finder-pilot")).toHaveTextContent("Indicatively 4–8 weeks");
    expect(within(result).getByTestId("finder-suitability-note")).toHaveTextContent("not a financial return");
    expect(within(within(result).getByTestId("finder-workshops")).getByRole("link", { name: "AI agents and business automation" })).toBeInTheDocument();
    expect(cards[1]).toHaveTextContent(finder.blockers.data_not_digital);
    expect(cards[1]).toHaveTextContent(finder.result.agentsLater);
    expect(within(result).getByTestId("finder-ranking")).toHaveTextContent("1. Invoice processing");
  });

  it("hands the process name to the ROI calculator through session storage", async () => {
    const user = userEvent.setup();
    renderFinder();
    await user.type(screen.getByLabelText("Process 1", { exact: true }), "Invoice processing");
    await user.click(screen.getByRole("button", { name: en.tools.ui.next }));
    await rateAll(user, [4, 4, 3, 2, 2, 1, 2, 3, 2, 2]);
    await user.click(screen.getByRole("button", { name: en.tools.ui.finish }));
    await user.click(await screen.findByRole("button", { name: finder.result.roiLink }));
    expect(window.sessionStorage.getItem(ROI_PROCESS_KEY)).toBe("Invoice processing");
    expect(push).toHaveBeenCalledWith("/en/tools/roi-calculator");
    expect(push.mock.calls[0][0]).not.toContain("Invoice");
  });

  it("limits the list to five processes", async () => {
    const user = userEvent.setup();
    renderFinder();
    for (let i = 0; i < 4; i++) await user.click(screen.getByRole("button", { name: finder.processes.add }));
    expect(screen.queryByRole("button", { name: finder.processes.add })).not.toBeInTheDocument();
    expect(screen.getByText("You can assess up to 5 processes at once.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove process 5" }));
    await waitFor(() => expect(screen.getByRole("button", { name: finder.processes.add })).toBeInTheDocument());
  });

  it("exports a text summary of the ranking", () => {
    const ranked = rankOpportunities([
      {
        name: "Invoices",
        area: "finance",
        ratings: { frequency: 4, repetitiveness: 4, rule_clarity: 3, input_structure: 2, data_availability: 2, exception_rate: 1, integration_complexity: 2, business_impact: 3, compliance_risk: 2, oversight_needs: 2 },
      },
    ]);
    const text = finderSummaryText(finder, ranked, (d) => en.teamTool.departments.options[d].title, (a) => en.teamTool.agents[a].name);
    expect(text).toContain("1. Invoices (Finance) — Suitability 70/100 · Quick win");
    expect(text).toContain("Risk: Medium");
    expect(text).toContain(finder.disclaimer);
  });

  it("renders a hostile process name as plain text", async () => {
    const user = userEvent.setup();
    renderFinder();
    await user.type(screen.getByLabelText("Process 1", { exact: true }), "<img src=x onerror=alert(1)>");
    await user.click(screen.getByRole("button", { name: en.tools.ui.next }));
    await rateAll(user, [4, 4, 3, 2, 2, 1, 2, 3, 2, 2]);
    await user.click(screen.getByRole("button", { name: en.tools.ui.finish }));
    const result = await screen.findByTestId("finder-result");
    expect(result.querySelector("img")).toBeNull();
    expect(within(result).getAllByText("<img src=x onerror=alert(1)>").length).toBeGreaterThan(0);
  });
});
