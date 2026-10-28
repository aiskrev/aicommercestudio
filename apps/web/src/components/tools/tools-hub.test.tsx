import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ToolIntro } from "@/components/tools/ToolIntro";
import { type DirectoryTool, ToolsDirectory } from "@/components/tools/ToolsDirectory";
import { getContent } from "@/content";
import { alternateLocalePath, localizePath } from "@/i18n/config";
import { routes } from "@/lib/routes";
import { TOOL_PAGE_SLUGS } from "@/lib/tool-slugs";
import {
  isToolAvailable,
  isToolPlanned,
  TOOL_CATEGORIES,
  toolByKey,
  toolHrefs,
  toolIntroHrefs,
  TOOLS,
  type ToolKey,
} from "@/lib/tools";

const CYRILLIC = /[Ѐ-ӿ]/;

/** The fourteen tools the hub must present (the agent library is listed as well). */
const REQUIRED: ToolKey[] = [
  "advisor",
  "readiness",
  "team",
  "roi",
  "finder",
  "solution",
  "cloud_maturity",
  "devops_maturity",
  // Planned from here on (REQUIRED.slice(PLANNED_FROM)).
  "observability",
  "ecommerce_architecture",
  "data_integration",
  "ai_governance",
  "ai_ops_readiness",
  "finops",
];

/** Index in REQUIRED of the first planned tool: the engineering assessments before it are live. */
const PLANNED_FROM = 8;

describe("tool registry", () => {
  it("registers every required tool once, with content in both languages", () => {
    const keys = TOOLS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of REQUIRED) expect(keys, key).toContain(key);
    for (const locale of ["bg", "en"] as const) {
      const items = getContent(locale).tools.items;
      expect(items.map((i) => i.key)).toEqual(keys);
      for (const item of items) {
        expect(item.title && item.description && item.audience && item.output, `${locale} ${item.key}`).toBeTruthy();
      }
    }
  });

  it("uses known categories and features only available tools", () => {
    for (const tool of TOOLS) expect(TOOL_CATEGORIES, tool.key).toContain(tool.category);
    const featured = TOOLS.filter((t) => t.featured);
    expect(featured.length).toBeGreaterThanOrEqual(2);
    expect(featured.every(isToolAvailable)).toBe(true);
  });

  it("keeps planned tools unreachable, without a time estimate or a start CTA", () => {
    const planned = TOOLS.filter((t) => t.status === "planned");
    expect(planned.map((t) => t.key).sort()).toEqual(REQUIRED.slice(PLANNED_FROM).sort());
    for (const tool of planned) {
      expect(isToolAvailable(tool), tool.key).toBe(false);
      expect(tool.path, tool.key).toBeUndefined();
      expect(tool.minutes, tool.key).toBeUndefined();
      expect(isToolPlanned(tool), tool.key).toBe(true);
      for (const locale of ["bg", "en"] as const) {
        const item = getContent(locale).tools.items.find((i) => i.key === tool.key)!;
        expect(item.cta, `${locale} ${tool.key} has no start button text`).toBeUndefined();
        expect(item.covers?.length, `${locale} ${tool.key}`).toBeGreaterThanOrEqual(3);
        expect(item.metaTitle!.length).toBeLessThanOrEqual(70);
        expect(item.metaDescription!.length).toBeGreaterThanOrEqual(70);
        expect(item.metaDescription!.length).toBeLessThanOrEqual(175);
      }
    }
    // Every live tool states its time; nothing else does.
    for (const tool of TOOLS.filter(isToolAvailable).filter((t) => t.key !== "agents")) expect(tool.minutes, tool.key).toBeGreaterThan(0);
  });

  it("has no Cyrillic in the English tool texts", () => {
    const { tools } = getContent("en");
    expect(JSON.stringify({ items: tools.items, hub: tools.hub, intro: tools.intro, labels: tools.labels })).not.toMatch(CYRILLIC);
  });
});

describe("tool routing", () => {
  it("gives every hosted tool a BG and an EN URL and maps them both ways", () => {
    for (const { bg, en } of Object.values(TOOL_PAGE_SLUGS)) {
      expect(localizePath("bg", routes.tool(bg))).toBe(`/bg/instrumenti/${bg}`);
      expect(localizePath("en", routes.tool(bg))).toBe(`/en/tools/${en}`);
      const slugs = { services: {}, articles: {}, topics: {} };
      expect(alternateLocalePath(`/bg/instrumenti/${bg}`, "", "en", slugs)).toBe(`/en/tools/${en}`);
      expect(alternateLocalePath(`/en/tools/${en}`, "", "bg", slugs)).toBe(`/bg/instrumenti/${bg}`);
    }
  });

  it("links live tools to the tool and planned tools only to their intro page", () => {
    const live = toolHrefs("en");
    const intros = toolIntroHrefs("en");
    expect(Object.keys(intros).sort()).toEqual(REQUIRED.slice(PLANNED_FROM).sort());
    expect(live.cloud_maturity).toBe("/en/tools/cloud-platform-maturity");
    expect(live.devops_maturity).toBe("/en/tools/devops-delivery-maturity");
    for (const key of Object.keys(intros)) expect(live[key as ToolKey], key).toBeUndefined();
    expect(intros.finops).toBe("/en/tools/finops-ai-cost");
    expect(live.readiness).toBe("/en/tools/ai-readiness");
    expect(toolByKey("cloud_maturity").domain).toBe("cloud_platform");
  });
});

function directory(locale: "bg" | "en"): DirectoryTool[] {
  const { tools } = getContent(locale);
  const hrefs = toolHrefs(locale);
  const intros = toolIntroHrefs(locale);
  return TOOLS.map((definition) => {
    const live = isToolAvailable(definition);
    return {
      content: tools.items.find((i) => i.key === definition.key)!,
      category: definition.category,
      status: live ? "live" : "planned",
      href: live ? hrefs[definition.key] : undefined,
      introHref: live ? undefined : intros[definition.key],
      minutes: live ? definition.minutes : undefined,
    };
  });
}

describe("tools directory", () => {
  const { tools } = getContent("en");
  const cardLabels = { liveBadge: tools.liveBadge, upcomingBadge: tools.upcomingBadge, ...tools.labels };

  it("shows every tool with name, purpose, audience, output, availability and an honest CTA", () => {
    render(<ToolsDirectory tools={directory("en")} categories={TOOL_CATEGORIES} labels={tools.hub} cardLabels={cardLabels} />);
    expect(screen.getByTestId("tools-count")).toHaveTextContent(`Tools shown: ${TOOLS.length}`);
    for (const card of document.querySelectorAll("article[data-tool]")) {
      const item = tools.items.find((i) => i.key === card.getAttribute("data-tool"))!;
      expect(card).toHaveTextContent(item.description);
      expect(card).toHaveTextContent(item.audience);
      expect(card).toHaveTextContent(item.output);
      // No buttons inside a card: a planned tool cannot be "started".
      expect(within(card as HTMLElement).queryAllByRole("button")).toHaveLength(0);
      if (card.getAttribute("data-status") === "planned") {
        expect(card).toHaveTextContent("Coming soon");
        expect(card).toHaveTextContent("Learn more");
        expect(card).not.toHaveTextContent(/about \d+ min/);
        expect(within(card as HTMLElement).getByRole("link").getAttribute("href")).toMatch(/^\/en\/tools\//);
      }
    }
  });

  it("filters by category and availability with pressed-state buttons and a live count", () => {
    render(<ToolsDirectory tools={directory("en")} categories={TOOL_CATEGORIES} labels={tools.hub} cardLabels={cardLabels} />);
    const count = screen.getByTestId("tools-count");
    expect(count).toHaveAttribute("aria-live", "polite");
    const categories = screen.getByRole("group", { name: "Category" });
    const engineering = within(categories).getByRole("button", { name: "Engineering assessments" });
    fireEvent.click(engineering);
    expect(engineering).toHaveAttribute("aria-pressed", "true");
    expect(count).toHaveTextContent("Tools shown: 5");
    const statuses = Array.from(document.querySelectorAll("article[data-tool]")).map((a) => a.getAttribute("data-status"));
    expect(statuses.filter((s) => s === "live")).toHaveLength(2); // cloud & platform, DevOps delivery

    const availability = screen.getByRole("group", { name: "Availability" });
    fireEvent.click(within(availability).getByRole("button", { name: "Available now" }));
    expect(count).toHaveTextContent("Tools shown: 2");
    fireEvent.click(within(availability).getByRole("button", { name: "Coming soon" }));
    expect(count).toHaveTextContent("Tools shown: 3");
    // Every AI-planning tool is live, so this combination has nothing left.
    fireEvent.click(within(categories).getByRole("button", { name: "AI planning" }));
    expect(screen.getByText("No tools match this selection.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    expect(count).toHaveTextContent(`Tools shown: ${TOOLS.length}`);

    fireEvent.click(within(availability).getByRole("button", { name: "Coming soon" }));
    expect(count).toHaveTextContent("Tools shown: 6");
  });
});

describe("planned tool intro", () => {
  it("states the purpose and status without any form, question or start button", () => {
    const { tools } = getContent("bg");
    const tool = tools.items.find((i) => i.key === "observability")!;
    render(
      <ToolIntro
        tool={tool}
        breadcrumbs={[
          { name: "Начало", path: "/bg" },
          { name: "Инструменти", path: "/bg/instrumenti" },
          { name: tool.title, path: "/bg/instrumenti/nablyudaemost-i-nadezhdnost" },
        ]}
        badge={tools.upcomingBadge}
        labels={tools.intro}
        audienceLabel={tools.labels.audience}
        contactHref="/bg/kontakti?usluga=integrations"
        domain={{ name: "DevOps, SRE и наблюдаемост", href: "/bg/uslugi/devops-sre-i-nablyudaemost" }}
        alternatives={[{ tool: tools.items[1], href: "/bg/instrumenti/ai-gotovnost", minutes: 5 }]}
        cardLabels={{ liveBadge: tools.liveBadge, upcomingBadge: tools.upcomingBadge, ...tools.labels }}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: tool.title })).toBeInTheDocument();
    expect(screen.getByTestId("tool-coming-soon")).toHaveTextContent("Очаквайте скоро");
    expect(document.querySelector("form, input, select, textarea")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    for (const cover of tool.covers!) expect(screen.getByText(cover)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Заявете оценка с консултант" })).toHaveAttribute("href", "/bg/kontakti?usluga=integrations");
    expect(screen.getByRole("link", { name: /Към направлението/ })).toHaveAttribute("href", "/bg/uslugi/devops-sre-i-nablyudaemost");
    expect(screen.getByRole("link", { name: tools.items[1].title })).toHaveAttribute("href", "/bg/instrumenti/ai-gotovnost");
  });
});
