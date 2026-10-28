import { describe, expect, it } from "vitest";

import { getContent } from "@/content";
import {
  type AnswerScore,
  BAND_THRESHOLDS,
  DIMENSION_WEIGHTS,
  READINESS_DIMENSIONS,
  READINESS_QUESTION_ORDER,
  READINESS_QUESTIONS,
  type ReadinessAnswers,
  type ReadinessDimension,
  type ReadinessResult,
  bandFor,
  buildRoadmap,
  decodeAnswers,
  encodeAnswers,
  missingAnswers,
  normalisedWeights,
  rankActions,
  scoreReadiness,
  suitableUseCases,
} from "@/lib/readiness";

const all = (score: AnswerScore): Required<ReadinessAnswers> =>
  Object.fromEntries(READINESS_QUESTION_ORDER.map((id) => [id, score])) as Required<ReadinessAnswers>;

/** Every answer in `dimension` set to `score`, the rest to `rest`. */
const only = (dimension: ReadinessDimension, score: AnswerScore, rest: AnswerScore = 0): Required<ReadinessAnswers> => ({
  ...all(rest),
  ...Object.fromEntries(READINESS_QUESTIONS[dimension].map((id) => [id, score])),
});

function complete(answers: ReadinessAnswers): ReadinessResult {
  const result = scoreReadiness(answers);
  if (!result.complete) throw new Error(`incomplete: ${result.missing.join(",")}`);
  return result;
}

describe("scores", () => {
  it("is 0 with every answer at the minimum and 100 at the maximum", () => {
    const min = complete(all(0));
    const max = complete(all(4));
    expect(min.overall).toBe(0);
    expect(min.dimensions.every((d) => d.score === 0)).toBe(true);
    expect(max.overall).toBe(100);
    expect(max.dimensions.every((d) => d.score === 100)).toBe(true);
  });

  it("normalises each dimension to 0–100 from its two 0–4 answers", () => {
    const result = complete({ ...all(0), data_access: 4, data_quality: 2 });
    expect(result.dimensions.find((d) => d.dimension === "data")?.score).toBe(75);
  });

  it("stays within 0–100 for any combination of answers", () => {
    let seed = 7;
    const next = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % 5) as AnswerScore;
    for (let i = 0; i < 500; i++) {
      const answers = Object.fromEntries(READINESS_QUESTION_ORDER.map((id) => [id, next()])) as ReadinessAnswers;
      const { overall } = complete(answers);
      expect(overall).toBeGreaterThanOrEqual(0);
      expect(overall).toBeLessThanOrEqual(100);
      expect(Number.isInteger(overall)).toBe(true);
    }
  });
});

describe("weights", () => {
  it("are 15/15/20/20/15/15 and normalise to a sum of 1", () => {
    expect(DIMENSION_WEIGHTS).toEqual({ strategy: 15, infrastructure: 15, data: 20, governance: 20, talent: 15, organization: 15 });
    const weights = normalisedWeights();
    expect(Object.values(weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(weights.data).toBeCloseTo(0.2, 12);
  });

  it("do not depend on the unit they are written in", () => {
    const doubled = Object.fromEntries(Object.entries(DIMENSION_WEIGHTS).map(([k, v]) => [k, v * 2])) as typeof DIMENSION_WEIGHTS;
    expect(normalisedWeights(doubled)).toEqual(normalisedWeights());
    expect(() => normalisedWeights({ strategy: 0, infrastructure: 0, data: 0, governance: 0, talent: 0, organization: 0 })).toThrow();
  });

  it("give each dimension exactly its weight of the overall score", () => {
    for (const dimension of READINESS_DIMENSIONS) {
      expect(complete(only(dimension, 4)).overall, dimension).toBe(DIMENSION_WEIGHTS[dimension]);
    }
  });
});

describe("missing answers", () => {
  it("returns an explicit incomplete result listing what is missing, in order", () => {
    expect(scoreReadiness({})).toEqual({ complete: false, missing: READINESS_QUESTION_ORDER });
    const almost = { ...all(3) } as ReadinessAnswers;
    delete almost.gov_oversight;
    expect(scoreReadiness(almost)).toEqual({ complete: false, missing: ["gov_oversight"] });
  });

  it("treats out-of-range or non-integer values as missing", () => {
    const bad = { ...all(2), data_quality: 5, strategy_goals: -1, people_change: 2.5 } as unknown as ReadinessAnswers;
    const result = scoreReadiness(bad);
    expect(result.complete).toBe(false);
    expect(!result.complete && result.missing).toEqual(["strategy_goals", "data_quality", "people_change"]);
  });

  it("validates a single step", () => {
    expect(missingAnswers({ strategy_goals: 2 }, "strategy")).toEqual(["strategy_use_cases"]);
    expect(missingAnswers({ strategy_goals: 2, strategy_use_cases: 0 }, "strategy")).toEqual([]);
  });
});

describe("readiness bands", () => {
  it.each([
    [0, "exploration"],
    [24, "exploration"],
    [24.4, "exploration"],
    [24.5, "foundation"],
    [25, "foundation"],
    [49, "foundation"],
    [50, "pilot_ready"],
    [74, "pilot_ready"],
    [75, "scaling"],
    [100, "scaling"],
    [-10, "exploration"],
    [130, "scaling"],
  ] as const)("score %s → %s", (score, band) => {
    expect(bandFor(score)).toBe(band);
  });

  it("declares contiguous thresholds starting at 0", () => {
    expect(BAND_THRESHOLDS.map((t) => t.min)).toEqual([75, 50, 25, 0]);
  });
});

describe("blockers", () => {
  const base = all(3);

  it("flags governance when data protection is unclear, oversight is undecided or governance is very low", () => {
    expect(complete({ ...base, gov_data_protection: 1 }).blockers).toContain("governance");
    expect(complete({ ...base, gov_oversight: 0 }).blockers).toContain("governance");
    expect(complete({ ...base, gov_data_protection: 2, gov_oversight: 1 }).blockers).not.toContain("governance");
  });

  it("flags data quality, integration, expertise and organisation from their key answers", () => {
    expect(complete({ ...base, data_quality: 1 }).blockers).toEqual(["data_quality"]);
    expect(complete({ ...base, tech_integration: 0 }).blockers).toEqual(["integration"]);
    expect(complete({ ...base, talent_support: 0 }).blockers).toEqual(["expertise"]);
    expect(complete({ ...base, talent_support: 1 }).blockers).toEqual([]);
    expect(complete({ ...base, people_ownership: 1 }).blockers).toEqual(["organisation"]);
    expect(complete({ ...base, people_ownership: 2, people_change: 0 }).blockers).toEqual(["organisation"]);
    expect(complete(base).blockers).toEqual([]);
  });

  it("lists blockers in priority order", () => {
    expect(
      complete({ ...base, people_ownership: 0, talent_support: 0, tech_integration: 0, data_quality: 0, gov_oversight: 0 }).blockers,
    ).toEqual(["governance", "data_quality", "integration", "expertise", "organisation"]);
  });
});

describe("recommendations", () => {
  it("always returns three distinct actions ending with the band's next step", () => {
    for (const score of [0, 1, 2, 3, 4] as const) {
      const { actions, band } = complete(all(score));
      expect(actions).toHaveLength(3);
      expect(new Set(actions).size).toBe(3);
      expect(actions[2]).toBe({ exploration: "discovery_workshop", foundation: "foundation_plan", pilot_ready: "scoped_pilot", scaling: "scale_operations" }[band]);
    }
  });

  it("puts blockers before gaps, in blocker priority order", () => {
    const { actions } = complete({ ...all(3), data_quality: 0, gov_oversight: 0, strategy_goals: 0, strategy_use_cases: 0 });
    expect(actions.slice(0, 2)).toEqual(["governance_first", "data_quality_first"]);
  });

  it("addresses the weakest gaps first and skips dimensions a blocker already covers", () => {
    expect(rankActions("foundation", [], ["talent", "strategy"])).toEqual(["talent_enablement", "strategy_definition", "foundation_plan"]);
    expect(rankActions("foundation", ["data_quality"], ["data", "organization"])).toEqual(["data_quality_first", "people_enablement", "foundation_plan"]);
    expect(rankActions("foundation", ["expertise"], ["talent", "infrastructure"])).toEqual(["expertise_first", "tech_foundation", "foundation_plan"]);
  });

  it("fills from the lowest-scoring dimensions when there are no gaps or blockers", () => {
    const { actions, gaps, blockers } = complete({ ...all(4), tech_environment: 2, tech_integration: 3 });
    expect([gaps, blockers]).toEqual([[], []]);
    expect(actions).toEqual(["tech_foundation", "strategy_definition", "scale_operations"]);
  });

  it("reports strengths (≥ 75) and gaps (< 50, weakest first)", () => {
    const result = complete({ ...all(2), ...only("governance", 4, 2), data_access: 0, data_quality: 0, talent_skills: 1, talent_support: 1 });
    expect(result.strengths).toEqual(["governance"]);
    expect(result.gaps).toEqual(["data", "talent"]);
    expect(complete(all(1)).strengths).toEqual([]);
  });

  it("suggests use cases only where the dimensions support them", () => {
    const scores = (s: Partial<Record<ReadinessDimension, number>>) =>
      ({ strategy: 0, infrastructure: 0, data: 0, governance: 0, talent: 0, organization: 0, ...s }) as Record<ReadinessDimension, number>;
    expect(suitableUseCases(scores({}))).toEqual(["process_discovery"]);
    expect(suitableUseCases(scores({ infrastructure: 50, organization: 50 }))).toEqual(["inquiry_triage"]);
    expect(suitableUseCases(scores({ infrastructure: 49, organization: 50 }))).toEqual(["process_discovery"]);
    expect(suitableUseCases(scores({ infrastructure: 75, organization: 75, data: 75, governance: 75 }))).toHaveLength(3);
  });

  it("puts blocker work into the first 30 days of the roadmap", () => {
    expect(buildRoadmap("foundation", ["governance", "data_quality", "integration"])).toEqual({
      d30: ["governance_first", "data_quality_first", "foundation_d30"],
      d60: ["integration_path", "foundation_d60"],
      d90: ["foundation_d90"],
    });
    expect(buildRoadmap("scaling", [])).toEqual({ d30: ["scaling_d30"], d60: ["scaling_d60"], d90: ["scaling_d90"] });
  });
});

describe("share code", () => {
  it("round-trips answers and rejects anything else", () => {
    const answers = { ...all(2), people_ownership: 0 as const, gov_oversight: 4 as const };
    expect(encodeAnswers(answers)).toMatch(/^b[0-4]{12}$/);
    expect(decodeAnswers(encodeAnswers(answers))).toEqual(answers);
    for (const bad of [null, "", "1234", "b01234012340x", "b012340123405", "b0123401234", "<script>alert</script>"]) {
      expect(decodeAnswers(bad)).toBeNull();
    }
  });

  it("never decodes a link of the previous question set onto the new questions", () => {
    expect(decodeAnswers("444444444444")).toBeNull(); // model 2026-10.2: 12 digits without a prefix
  });
});

describe("readiness content", () => {
  it.each(["bg", "en"] as const)("covers every question, band, blocker, action, use case and roadmap entry (%s)", (locale) => {
    const { readinessTool: t } = getContent(locale);
    expect(Object.keys(t.questions).sort()).toEqual([...READINESS_QUESTION_ORDER].sort());
    for (const question of Object.values(t.questions)) expect(question.options).toHaveLength(5);
    expect(Object.keys(t.steps)).toEqual([...READINESS_DIMENSIONS]);
    expect(Object.keys(t.result.bands).sort()).toEqual(["exploration", "foundation", "pilot_ready", "scaling"]);
    expect(Object.keys(t.result.roadmap)).toHaveLength(12);
    expect(Object.keys(t.result.blockers)).toHaveLength(5);
    expect(t.result.methodology.limitations.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps BG and EN aligned and labels the result as indicative", () => {
    const bg = getContent("bg").readinessTool;
    const en = getContent("en").readinessTool;
    expect(Object.keys(en.result.actions)).toEqual(Object.keys(bg.result.actions));
    expect(Object.keys(en.result.useCases)).toEqual(Object.keys(bg.result.useCases));
    expect(en.result.methodology.limitations).toHaveLength(bg.result.methodology.limitations.length);
    expect(JSON.stringify(en)).not.toMatch(/[\u0400-\u04FF]/);
    expect(bg.result.methodology.disclaimer).toContain("ориентировъчна самооценка");
    expect(en.result.methodology.disclaimer).toContain("indicative self-assessment");
    expect(en.result.methodology.disclaimer).toContain("not a certified");
  });

  it("invents no external benchmarks or comparisons", () => {
    for (const locale of ["bg", "en"] as const) {
      const text = JSON.stringify(getContent(locale).readinessTool).toLowerCase();
      for (const claim of ["industry average", "average company", "percentile", "better than", "по-добре от", "средно за", "средната фирма", "% от фирмите", "% of companies"]) {
        expect(text, `${locale}: ${claim}`).not.toContain(claim);
      }
    }
  });
});
