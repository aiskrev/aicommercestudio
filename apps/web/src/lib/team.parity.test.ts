import { describe, expect, it } from "vitest";

import { TEAM_MODEL_VERSION, fromApiConfig, toApiConfig, toApiTeamSummary } from "@/lib/ai-team";

import vectors from "./team.vectors.json";

/**
 * Golden vectors generated from the API's port of the team model (apps/api/app/team/model.py). The API
 * tests check the same file and scripts/test.ps1 verifies both copies are identical, so the team, plan
 * and architecture the visitor sees equal what the API prices, stores and prints.
 */
describe("AI team model parity with the API", () => {
  it("targets the same model version", () => {
    expect(vectors.model_version).toBe(TEAM_MODEL_VERSION);
    expect(vectors.vectors.length).toBeGreaterThanOrEqual(60);
  });

  it.each(vectors.vectors.map((vector, index) => [index, vector] as const))("vector %i", (_, vector) => {
    const config = fromApiConfig(vector.config);
    expect(config).not.toBeNull();
    expect(toApiTeamSummary(config!)).toEqual(vector.expected);
    // Round trip through the API shape keeps the derived team identical.
    expect(toApiTeamSummary(fromApiConfig(toApiConfig(config!))!)).toEqual(vector.expected);
  });
});
