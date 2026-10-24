import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import {
  READINESS_DIMENSIONS,
  READINESS_QUESTION_ORDER,
  type ReadinessAnswers,
  decodeAnswers,
  encodeAnswers,
  levelFor,
  missingAnswers,
  scoreReadiness,
} from "@/lib/readiness";

const all = (score: 0 | 1 | 2 | 3): ReadinessAnswers => Object.fromEntries(READINESS_QUESTION_ORDER.map((id) => [id, score]));

describe("readiness scoring", () => {
  it("scores each dimension 0–100 and averages them", () => {
    expect(scoreReadiness(all(0)).overall).toBe(0);
    expect(scoreReadiness(all(3)).overall).toBe(100);
    const result = scoreReadiness({ ...all(3), data_location: 0, data_quality: 0 });
    expect(result.dimensions.find((d) => d.dimension === "data")?.score).toBe(0);
    expect(result.overall).toBe(80);
  });

  it("maps the overall score to a level at fixed thresholds", () => {
    expect([levelFor(39), levelFor(40), levelFor(69), levelFor(70)]).toEqual(["early", "developing", "developing", "ready"]);
  });

  it("recommends the weakest dimensions first (max three) and a pilot when nothing is weak", () => {
    const result = scoreReadiness({ ...all(3), governance_privacy: 0, governance_approval: 0, data_location: 1, data_quality: 1 });
    expect(result.recommendations.map((r) => r.dimension)).toEqual(["governance", "data"]);
    expect(scoreReadiness(all(0)).recommendations).toHaveLength(3);
    expect(scoreReadiness(all(3)).recommendations).toEqual([{ dimension: "pilot", service: "ai_agents" }]);
  });

  it("refuses incomplete answers and reports missing questions per step", () => {
    expect(() => scoreReadiness({ data_location: 1 })).toThrow();
    expect(missingAnswers("data", { data_location: 1 })).toEqual(["data_quality"]);
  });

  it("round-trips the share code and rejects anything else", () => {
    const answers = { ...all(2), people_owner: 0 as const, systems_access: 3 as const };
    expect(decodeAnswers(encodeAnswers(answers))).toEqual(answers);
    for (const bad of [null, "", "123", "0123012301x", "01230123014", "<script>"]) expect(decodeAnswers(bad)).toBeNull();
  });
});

describe("readiness content", () => {
  it.each(["bg", "en"] as const)("has a question with four options for every scored id (%s)", (locale) => {
    const { readinessTool } = getContent(locale);
    expect(Object.keys(readinessTool.questions).sort()).toEqual([...READINESS_QUESTION_ORDER].sort());
    for (const question of Object.values(readinessTool.questions)) expect(question.options).toHaveLength(4);
    expect(Object.keys(readinessTool.steps)).toEqual([...READINESS_DIMENSIONS]);
  });
});
