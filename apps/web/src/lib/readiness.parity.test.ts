import { describe, expect, it } from "vitest";

import { READINESS_MODEL_VERSION, type ReadinessAnswers, scoreReadiness, toApiSummary } from "@/lib/readiness";

import vectors from "./readiness.vectors.json";

/**
 * Golden vectors generated from the API's scoring (apps/api/app/readiness/scoring.py). The API tests
 * check the same file, and scripts/test.ps1 verifies both copies are identical, so the score a visitor
 * sees always equals the score in their PDF report and in a submission.
 */
describe("readiness scoring parity with the API", () => {
  it("targets the same model version", () => {
    expect(vectors.model_version).toBe(READINESS_MODEL_VERSION);
    expect(vectors.vectors.length).toBeGreaterThanOrEqual(50);
  });

  it.each(vectors.vectors.map((vector, index) => [index, vector] as const))("vector %i", (_, vector) => {
    const result = scoreReadiness(vector.answers as ReadinessAnswers);
    expect(result.complete).toBe(true);
    if (result.complete) expect(toApiSummary(result)).toEqual(vector.expected);
  });
});
