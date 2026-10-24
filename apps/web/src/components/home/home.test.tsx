import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BuildBento } from "@/components/home/BuildBento";
import { SystemMap } from "@/components/home/SystemMap";
import { ToolsPreview } from "@/components/home/ToolsPreview";
import { UseCaseLedger } from "@/components/home/UseCaseLedger";
import { getContent } from "@/content";

const { home, advisor, tools } = getContent("bg");

describe("homepage sections", () => {
  it("system map lists every layer, the approval gate and the actions in order", () => {
    render(<SystemMap content={home.hero.systemMap} />);
    const map = screen.getByRole("figure", { name: home.hero.systemMap.label });
    const layers = within(map).getAllByRole("listitem").filter((li) => li.parentElement?.tagName === "OL");
    expect(layers).toHaveLength(home.hero.systemMap.layers.length + 2);
    expect(layers.at(-2)).toHaveTextContent(home.hero.systemMap.gate.title);
    expect(map).toHaveTextContent(home.hero.systemMap.caption);
  });

  it("each offering is a single link named by its title", () => {
    render(<BuildBento items={home.build.items.map((item) => ({ ...item, href: `/bg/${item.key}` }))} />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(home.build.items.map((item) => item.title));
  });

  it("tools preview links only the live tool and labels the others as upcoming", () => {
    render(<ToolsPreview catalog={tools} hrefs={{ advisor: "/bg/ai-automation-advisor" }} showcase={advisor.showcase} />);
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/bg/ai-automation-advisor"]);
    expect(screen.getAllByText(tools.upcomingBadge, { exact: true })).toHaveLength(tools.items.length - 1);
  });

  it("use cases expose what AI does and where a person decides as labelled terms", () => {
    render(<UseCaseLedger items={home.useCases.items} labels={home.useCases.labels} />);
    expect(screen.getAllByRole("term").filter((dt) => dt.textContent === home.useCases.labels.human)).toHaveLength(
      home.useCases.items.length,
    );
  });

  it("keeps BG and EN homepage content structurally identical", () => {
    const en = getContent("en").home;
    expect(en.build.items.map((i) => i.key)).toEqual(home.build.items.map((i) => i.key));
    expect(en.build.items.map((i) => i.link)).toEqual(home.build.items.map((i) => i.link));
    expect(en.process.steps).toHaveLength(home.process.steps.length);
    expect(getContent("en").tools.items.map((t) => t.key)).toEqual(tools.items.map((t) => t.key));
    expect(en.useCases.items).toHaveLength(home.useCases.items.length);
  });
});
