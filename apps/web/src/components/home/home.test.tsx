import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CredibilityStrip } from "@/components/home/CredibilityStrip";
import { OfferGroups } from "@/components/home/OfferGroups";
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

  it("the four capability groups cover every domain exactly once and link the hubs", () => {
    expect(home.offer.groups.map((g) => g.key)).toEqual(["ai", "cloud", "platform", "commerce"]);
    const covered = home.offer.groups.flatMap((g) => g.domains);
    expect([...covered].sort()).toEqual(DOMAINS.map((d) => d.key).sort());
    render(
      <OfferGroups
        groups={home.offer.groups.map((group) => ({
          ...group,
          domains: group.domains.map((key) => ({ key, name: `Domain ${key}`, href: `/bg/uslugi/${key}` })),
        }))}
      />,
    );
    for (const group of home.offer.groups) {
      const card = screen.getByRole("heading", { level: 3, name: group.title }).closest("article")!;
      expect(card).toHaveTextContent(group.problem);
      expect(within(card).getAllByRole("link")).toHaveLength(group.domains.length);
    }
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
    expect(en.offer.groups.map((g) => [g.key, g.icon, g.domains])).toEqual(home.offer.groups.map((g) => [g.key, g.icon, g.domains]));
    expect(en.process.steps).toHaveLength(home.process.steps.length);
    expect(en.hero.highlights).toHaveLength(home.hero.highlights.length);
    expect(getContent("en").tools.items.map((t) => t.key)).toEqual(tools.items.map((t) => t.key));
    expect(JSON.stringify([en.hero, en.offer, en.managed, en.tools])).not.toMatch(CYRILLIC);
  });

  it("makes no unverifiable claims in the hero, the offer or the managed section", () => {
    for (const locale of ["bg", "en"] as const) {
      const { hero, offer, managed } = getContent(locale).home;
      const text = JSON.stringify({ hero, offer, managed }).toLowerCase();
      for (const phrase of ["guarantee", "гарантира", "100%", "№1", "#1", "leading", "водещ", "award", "certified", "sla 99"]) {
        expect(text, `${locale}: ${phrase}`).not.toContain(phrase);
      }
    }
  });
});
