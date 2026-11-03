# Assessment coverage matrix

Last updated: 2026-11-03 (branch `feature/assessments-consistency`).

There are ten specialised assessment tools: eight engine assessments, the AI Readiness Assessment and the
AI Opportunity Finder. This page shows, for each tool:

* where its scoring and its report come from;
* what its result shows;
* how it is tested;
* what it still lacks.

The ROI calculator, the AI team configurator, the Solution Builder and the Advisor are planning tools,
not assessments, so they are not listed here.

## 1. Shared results experience

All ten results use the same building blocks from `components/tools/ToolUi.tsx`. Where a tool shows
something differently, the matrix in section 2 says so.

| Element | Component | Notes |
| --- | --- | --- |
| Overall score, level and area bars | `ResultSummary` | the Finder ranks opportunities instead (its job is a ranking, not a maturity score) |
| Strengths and gaps | `StrengthsGaps` | engine: areas with a score of at least 75 / below 50. This is a display grouping only; scores are untouched |
| Risks, quick wins, recommendations, target states, patterns, context | engine finding kinds | each finding has its "Why" (the rule and the answer that triggered it) |
| Methodology version and basis | `ResultBasis` (new) | the version that produced the result; "a heuristic from your answers" or "includes values stated as measured" |
| How the result is calculated | `MethodologyNote` | engine: definition, version, algorithm, weighting, rules, the strengths/gaps thresholds |
| Services and workshops | domain hub links | engine: domains of the findings plus the advisory and enablement hub |
| Optional report | engine: saved result → HTML view and PDF; readiness: PDF | saving is always an explicit action |
| Consultation | engine: consent form linked to the saved result; readiness: team hand-off; finder: contact link | privacy acknowledgement is required; marketing consent is separate and unticked |
| Print and mobile | print styles hide the actions; no horizontal overflow at phone width | — |

**Heuristic or measured.** Every score is a heuristic computed from self-reported answers. The basis
label reads "measured" only when a DevOps visitor states that the metrics they entered come from their
tooling. The site never measures, connects to or verifies a client system.

**Versions.** Each version is kept apart:

* engine definitions are versioned JSON;
* the readiness and finder models carry `READINESS_MODEL_VERSION` and `FINDER_MODEL_VERSION`.

Making the layout consistent changed no assessment's scoring or version.

## 2. Matrix

| Assessment | Version | Backend (scoring) | UI | Report | Tests | Missing capability |
| --- | --- | --- | --- | --- | --- | --- |
| Cloud & Platform Maturity (`cloud_platform`) | 1.0.0, 10 areas | engine API | `EngineAssessment` | HTML + PDF (saved) | API definition, boundaries, explanations, report; web unit; e2e BG full journey, consistency | — |
| DevOps Delivery Maturity (`devops_delivery`) | 1.1.0, 11 areas (1.0.0 kept) | engine API + `devops_evidence` | `EngineAssessment` with metrics | HTML + PDF | API metrics never scored, validation, backlog; web unit; e2e EN, mobile, consistency | — |
| Observability & Reliability (`observability_reliability`) | 1.2.0, 11 areas (1.0.0, 1.1.0 kept) | engine API + `observability_signals` | `EngineAssessment` | HTML + PDF | API boundaries, cross-question check, illustrative SLOs; e2e EN/BG, mobile, consistency | — |
| E-commerce Architecture (`ecommerce_architecture`) | 1.0.0, 11 areas | engine API, finding tracks | `EngineAssessment` | HTML + PDF | API tracks, AI only after foundations; e2e EN, consistency | — |
| Data & Integration Readiness (`data_integration`) | 1.0.0, 11 areas | engine API | `EngineAssessment` | HTML + PDF | API RAG caveats and patterns; e2e BG, consistency | — |
| Responsible AI Governance (`ai_governance`) | **1.1.0, 12 areas** (1.0.0 kept) | engine API | `EngineAssessment` | HTML + PDF | API gap analysis, documents, review workflow, disclaimer; e2e BG, consistency | — |
| AI Operations Readiness (`ai_ops_readiness`) | **1.1.0, 12 areas** (1.0.0 kept) | engine API | `EngineAssessment` | HTML + PDF | API risk register, checklist, boundaries, rule basis; e2e EN, consistency | — |
| FinOps & AI Cost (`finops`) | **1.1.0, 12 areas** (1.0.0 kept) | engine API | `EngineAssessment` | HTML + PDF | API no prices/currencies, not-ROI note; e2e BG, consistency | — |
| AI Readiness (`readiness`) | `READINESS_MODEL_VERSION` 2026-11.1 | client model (`lib/readiness.ts`), API parity test | `ReadinessAssessment` | PDF (`/api/public/readiness/report`) | unit, parity, e2e BG journey, shared link, mobile, consistency | no saved HTML report view (PDF only) |
| AI Opportunity Finder (`finder`) | `FINDER_MODEL_VERSION` 2026-11.1 | client model (`lib/finder.ts`) | `OpportunityFinder` | text summary download and print | unit, e2e ranking, ROI hand-off | no server-side report or PDF; consultation is a contact link, not a form linked to the result |

## 3. What the consistency tests cover

**`apps/api/tests/test_assessments_v2.py`.** These tests are parametrised over every current engine
definition:

* the same answers give the same scores, levels, findings, roadmap and domains in Bulgarian and in
  English;
* repeated scoring is identical, down to the fingerprint;
* markup, wrong types and missing or unknown answers are rejected with `422`;
* the report renders to PDF in both languages.

**`apps/web/e2e/tests/assessment-consistency.spec.ts`:**

* every engine flow, end to end, with the weakest answers: score 0, level Initial, strengths and gaps,
  findings with "Why", services and workshops, version and basis, methodology, disclaimer, report and
  consultation, a single H1 and no horizontal overflow;
* the same locale, repeatability and invalid-input checks through the public API;
* the readiness result's disclosure;
* the AI Operations and FinOps 1.1.0 outputs.

**Unit tests:**

* `engine.test.tsx` covers strengths and gaps, workshops and the version disclosure;
* `tools.test.tsx` and `roi-finder.test.tsx` check the shared disclosure in readiness and the finder.
