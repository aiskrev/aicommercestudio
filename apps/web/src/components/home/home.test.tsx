import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CredibilityStrip } from "@/components/home/CredibilityStrip";
import { CapabilityAreas } from "@/components/home/CapabilityAreas";
import { ManagedLifecycle } from "@/components/home/ManagedLifecycle";
import { SystemMap } from "@/components/home/SystemMap";
import { ToolsPreview } from "@/components/home/ToolsPreview";
import { getContent } from "@/content";
import { DOMAINS } from "@/lib/domains";

const { home, advisor, tools } = getContent("bg");
const CYRILLIC = /[Ѐ-ӿ]/;

describe("homepage sections", () => {
  it("system map lists every layer, the approval gate and the actions in order", () => {
    render(<SystemMap content={home.hero.systemMap} />);
    const map = screen.getByRole("figure", { name: home.hero.systemMap.label });
    const layers = within(map).getAllByRole("listitem").filter((li) => li.parentElement?.tagName === "OL");
    expect(layers).toHaveLength(home.hero.systemMap.layers.length + 2);
    expect(layers.at(-2)).toHaveTextContent(home.hero.systemMap.gate.title);
    expect(map).toHaveTextContent(home.hero.systemMap.caption);
  });

  it("the three capability areas cover every domain exactly once, state problem, capabilities and outcome, and link the hubs", () => {
    expect(home.offer.areas.map((a) => a.key)).toEqual(["automation", "engineering", "managed"]);
    const covered = home.offer.areas.flatMap((a) => a.domains);
    expect([...covered].sort()).toEqual(DOMAINS.map((d) => d.key).sort());
    render(
      <CapabilityAreas
        labels={home.offer.labels}
        areas={home.offer.areas.map((area) => ({
          ...area,
          domains: area.domains.map((key) => ({ key, name: `Domain ${key}`, href: `/bg/uslugi/${key}` })),
        }))}
      />,
    );
    for (const area of home.offer.areas) {
      const card = screen.getByRole("heading", { level: 3, name: area.title }).closest("article")!;
      expect(card).toHaveTextContent(area.problem);
      expect(card).toHaveTextContent(area.outcome);
      for (const capability of area.capabilities) expect(card).toHaveTextContent(capability);
      expect(within(card).getAllByRole("link")).toHaveLength(area.domains.length);
    }
    // Unequal weight: the first area is the feature panel.
    expect(screen.getByRole("heading", { level: 3, name: home.offer.areas[0].title }).closest("article")).toHaveClass("feature-panel");
  });

  it("the AI Managed Services lifecycle links every stage to the service page and is captioned as an illustration", () => {
    render(<ManagedLifecycle content={home.managed.lifecycle} serviceHref="/bg/uslugi/ai-managed-services" />);
    const stages = within(screen.getByTestId("managed-lifecycle")).getAllByRole("link");
    expect(stages.map((link) => link.getAttribute("href"))).toEqual(home.managed.lifecycle.stages.map((stage) => `/bg/uslugi/ai-managed-services#${stage.anchor}`));
    expect(screen.getByRole("figure")).toHaveTextContent(home.managed.lifecycle.caption);
  });

  it("tools preview marks the Advisor as the first tool, links only live tools and labels the others", () => {
    render(
      <ToolsPreview
        catalog={tools}
        hrefs={{ advisor: "/bg/ai-automation-advisor" }}
        minutes={{}}
        showcase={advisor.showcase}
        startBadge={home.tools.startBadge}
      />,
    );
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/bg/ai-automation-advisor"]);
    expect(screen.getByTestId("tool-start-here")).toHaveTextContent(home.tools.startBadge);
    expect(screen.getAllByText(tools.upcomingBadge, { exact: true })).toHaveLength(3);
  });

  it("credibility strip is a titled section without numbers, logos or ratings", () => {
    render(<CredibilityStrip label={home.capabilities.title} lead={home.capabilities.lead} groups={home.capabilities.groups} />);
    expect(screen.getByRole("region", { name: home.capabilities.title })).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+\s?%|\d+\+ (клиент|проект)|★/);
  });

  it("keeps BG and EN homepage content structurally identical and free of cross-language leakage", () => {
    const en = getContent("en").home;
    expect(en.offer.areas.map((a) => [a.key, a.icon, a.domains, a.capabilities.length])).toEqual(home.offer.areas.map((a) => [a.key, a.icon, a.domains, a.capabilities.length]));
    expect(en.managed.lifecycle.stages.map((s) => [s.key, s.anchor])).toEqual(home.managed.lifecycle.stages.map((s) => [s.key, s.anchor]));
    expect(en.proof.scenarios).toEqual(home.proof.scenarios);
    expect(en.tools.facts).toHaveLength(home.tools.facts.length);
    expect(en.process.steps).toHaveLength(home.process.steps.length);
    expect(en.hero.highlights).toHaveLength(home.hero.highlights.length);
    expect(getContent("en").tools.items.map((t) => t.key)).toEqual(tools.items.map((t) => t.key));
    expect(JSON.stringify([en.hero, en.offer, en.managed, en.tools, en.proof])).not.toMatch(CYRILLIC);
  });

  it("makes no unverifiable claims in the hero, the offer or the managed section", () => {
    for (const locale of ["bg", "en"] as const) {
      const { hero, offer, managed, tools, proof } = getContent(locale).home;
      const text = JSON.stringify({ hero, offer, managed, tools, proof }).toLowerCase();
      for (const phrase of ["guarantee", "гарантира", "100%", "№1", "#1", "leading", "водещ", "award", "certified", "sla 99"]) {
        expect(text, `${locale}: ${phrase}`).not.toContain(phrase);
      }
      expect(text, `${locale}: no figures that look like outcomes`).not.toMatch(/\d+\s?%|\d+\s?(клиент|client|project|проект)/);
    }
  });
});
