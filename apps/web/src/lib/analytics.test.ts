import { describe, expect, it, vi } from "vitest";

import { registerAnalyticsSink, sanitizeToolEvent, trackToolEvent, type ToolEvent } from "@/lib/analytics";
import { parseFlagOverrides, isFlagEnabled } from "@/lib/feature-flags";
import { isToolAvailable, TOOLS, toolHrefs } from "@/lib/tools";

describe("tool analytics", () => {
  it("keeps only allow-listed, non-personal fields", () => {
    const dirty = {
      name: "step_completed",
      tool: "readiness",
      locale: "bg",
      step: 2,
      totalSteps: 5,
      result: "developing",
      format: "text",
      email: "someone@example.com",
      answer: "Разпръснати в имейли",
    } as unknown as ToolEvent & Record<string, unknown>;
    expect(sanitizeToolEvent(dirty)).toEqual({
      name: "step_completed",
      tool: "readiness",
      locale: "bg",
      step: 2,
      totalSteps: 5,
      result: "developing",
      format: "text",
    });
  });

  it("drops free text disguised as a result or format", () => {
    const event = sanitizeToolEvent({ name: "tool_completed", tool: "readiness", locale: "en", result: "John Smith", format: "csv" } as never);
    expect(event).toEqual({ name: "tool_completed", tool: "readiness", locale: "en" });
  });

  it("delivers events to registered sinks and as a DOM event, without network", () => {
    const sink = vi.fn();
    const dom = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    window.addEventListener("acs:analytics", dom);
    const unregister = registerAnalyticsSink(sink);
    trackToolEvent({ name: "tool_opened", tool: "advisor", locale: "en" });
    unregister();
    window.removeEventListener("acs:analytics", dom);
    expect(sink).toHaveBeenCalledWith({ name: "tool_opened", tool: "advisor", locale: "en" });
    expect(dom).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("feature flags and tool registry", () => {
  it("parses on/off overrides and ignores unknown flags", () => {
    expect(parseFlagOverrides("tool_team=on, tool_readiness=off,unknown=on,tool_roi")).toEqual({ tool_team: true, tool_readiness: false });
    expect(isFlagEnabled("tool_readiness", {})).toBe(true);
    expect(isFlagEnabled("tool_readiness", { tool_readiness: false })).toBe(false);
  });

  it("never makes a planned tool available, and a flag turned off hides a live tool", () => {
    const previous = process.env.TOOL_FLAGS;
    try {
      process.env.TOOL_FLAGS = TOOLS.map((t) => `${t.flag}=on`).join(",");
      expect(TOOLS.filter((t) => t.status === "planned").some(isToolAvailable)).toBe(false);
      process.env.TOOL_FLAGS = "tool_readiness=off,tool_team=off,tool_roi=off,tool_finder=off,tool_solution=off,tool_agents=off";
      expect(Object.keys(toolHrefs("en"))).toEqual(["advisor"]);
    } finally {
      process.env.TOOL_FLAGS = previous;
    }
  });

  it("links available tools with localized URLs", () => {
    expect(toolHrefs("en")).toEqual({
      advisor: "/en/ai-automation-advisor",
      readiness: "/en/tools/ai-readiness",
      team: "/en/tools/ai-team",
      roi: "/en/tools/roi-calculator",
      finder: "/en/tools/automation-finder",
      solution: "/en/tools/solution-builder",
      agents: "/en/ai-agents",
    });
    expect(toolHrefs("bg").roi).toBe("/bg/instrumenti/roi-kalkulator");
    expect(toolHrefs("bg").finder).toBe("/bg/instrumenti/avtomatizatsii");
    expect(toolHrefs("bg").readiness).toBe("/bg/instrumenti/ai-gotovnost");
    expect(toolHrefs("bg").team).toBe("/bg/instrumenti/ai-ekip");
    expect(toolHrefs("bg").solution).toBe("/bg/instrumenti/ai-reshenie");
    expect(toolHrefs("bg").agents).toBe("/bg/ai-agenti");
  });
});
