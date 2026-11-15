import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CredibilityStrip } from "@/components/home/CredibilityStrip";
import { ToolsPreview } from "@/components/home/ToolsPreview";
import { getContent } from "@/content";
import { DOMAINS } from "@/lib/domains";

const { home, advisor, tools } = getContent("bg");
const CYRILLIC = /[Ѐ-ӿ]/;

describe("homepage sections", () => {
  // The capability-area content is still part of the BG/EN content contract (the section that drew it was replaced by the
  // Future Commerce homepage; its components were removed, audit FS-10).
  it("the three capability areas cover every domain exactly once", () => {
    expect(home.offer.areas.map((a) => a.key)).toEqual(["automation", "engineering", "managed"]);
    const covered = home.offer.areas.flatMap((a) => a.domains);
    expect([...covered].sort()).toEqual(DOMAINS.map((d) => d.key).sort());
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
