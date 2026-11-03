import { describe, expect, it } from "vitest";

import {
  SOLUTION_MODEL_VERSION,
  assessComplexity,
  compositionIssues,
  decodeSolution,
  encodeSolution,
  humanApprovalPoints,
  minimumApproval,
  parseSolutionCode,
  proposedAgents,
} from "@/lib/solution";

import vectors from "./solution.vectors.json";

/**
 * Golden vectors generated from the API's port of the composition rules (apps/api/app/solution/model.py).
 * The API tests check the same file and scripts/test.ps1 verifies both copies are identical, so a design
 * the builder accepts is exactly a design the enquiry endpoint accepts — and the same ones are rejected.
 */
describe("AI solution builder parity with the API", () => {
  it("targets the same model version and covers valid and rejected designs", () => {
    expect(vectors.model_version).toBe(SOLUTION_MODEL_VERSION);
    expect(vectors.vectors.filter((v) => v.expected.valid).length).toBeGreaterThanOrEqual(30);
    expect(vectors.vectors.filter((v) => v.expected.parsed && !v.expected.valid).length).toBeGreaterThanOrEqual(30);
  });

  it.each(vectors.vectors.map((vector, index) => [index, vector] as const))("vector %i", (_, { code, expected }) => {
    const raw = parseSolutionCode(code);
    expect(raw !== null).toBe(expected.parsed);
    if (raw) {
      expect(compositionIssues(raw)).toEqual(expected.issues);
      expect(minimumApproval(raw).checkpoint).toBe(expected.minimum_approval);
    }
    const config = decodeSolution(code);
    expect(config !== null).toBe(expected.valid);
    if (!config || !expected.summary) return;
    const s = expected.summary;
    expect(encodeSolution(config)).toBe(expected.code);
    expect({
      objective: config.objective,
      workflow: config.workflow,
      capabilities: config.capabilities,
      integrations: config.integrations,
      sensitivity: config.sensitivity,
      approval: config.approval,
      minimum_approval: minimumApproval(config).checkpoint,
      deployment: config.deployment,
      residency: config.residency,
      redaction: config.redaction,
      agents: proposedAgents(config).map((a) => a.agent),
      complexity: { band: assessComplexity(config).band, points: assessComplexity(config).points },
      approval_points: humanApprovalPoints(config).map((c) => c.key),
    }).toEqual(s);
  });
});
