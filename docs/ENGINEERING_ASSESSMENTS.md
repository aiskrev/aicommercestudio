# Engineering assessments: Cloud & Platform, DevOps Delivery, Observability & Reliability

Two self-assessments built as isolated definitions on the assessment engine
([ASSESSMENT_PLATFORM_ARCHITECTURE.md](ASSESSMENT_PLATFORM_ARCHITECTURE.md)). There is no
assessment-specific scoring code: questions, points, rules and texts are versioned JSON. DevOps adds
one registered extension for its metrics.

| Tool | Definition | Route (BG ↔ EN) | Flag |
| --- | --- | --- | --- |
| Cloud & Platform Maturity | `cloud_platform/1.0.0.json` (live) | `/bg/instrumenti/zrelost-na-oblak-i-platforma` ↔ `/en/tools/cloud-platform-maturity` | `tool_cloud` |
| DevOps Delivery Maturity | `devops_delivery/1.1.0.json` (live; 1.0.0 kept for saved results) | `/bg/instrumenti/zrelost-na-devops-dostavkata` ↔ `/en/tools/devops-delivery-maturity` | `tool_devops` |
| Observability & Reliability | `observability_reliability/1.1.0.json` (live; 1.0.0 kept for saved results) | `/bg/instrumenti/nablyudaemost-i-nadezhdnost` ↔ `/en/tools/observability-reliability` | `tool_observability` |

**Boundaries.** No access to customer cloud environments, repositories or pipelines. No live
scanning, no credentials and no compliance certification. Every page, result and report says that
the result is a self-assessment and that the calculations were not independently verified.

## 1. Cloud & Platform Maturity (`cloud_platform` 1.0.0)

Ten dimensions with equal weight, two scored questions each, four options (0–3 points):

| Dimension | Questions |
| --- | --- |
| Landing zones and organisation | account/subscription/project structure; organisation-wide guardrails |
| Identity and least privilege | console sign-in (SSO, MFA, time-limited elevation); how permissions are granted and reviewed |
| Network segmentation and connectivity | segmentation; connectivity between environments, sites and clouds |
| Infrastructure as Code | coverage; how changes are applied (pipeline, plan review, policy checks, drift detection) |
| Container and compute platform operations | how runtimes are operated; image and runtime patching |
| CI/CD and deployment governance | path to production; who may deploy and how it is recorded |
| Observability and incident readiness | monitoring coverage; incident handling |
| Backup, recovery and resilience | backups and restore tests; disaster recovery with RTO/RPO |
| Security posture and policy automation | posture tracking; policy as code |
| FinOps and capacity management | cost visibility and allocation; capacity and optimisation |

**Vendor contexts.** `cloud_context` is a multi-choice *context* question: AWS, Azure, Google
Cloud, hybrid, private cloud or own servers. It never changes the score (tested). It only triggers
context notes:

* one for each of AWS (Organizations, accounts, SCPs, IAM Identity Center), Azure (management
  groups, subscriptions, Azure Policy, Entra ID) and Google Cloud (organisation, folders, projects,
  Organization Policy, IAM bindings);
* "Several clouds are not equivalent", when two or more public clouds are selected: apply the
  recommendations per provider, not through one abstraction;
* a hybrid and private note, about managed services that are missing on premises.

**Findings** (34 rules):

* 8 architecture risks (30 days), for example everything in one shared account, unmanaged
  identities, a flat network, manual infrastructure, uncontrolled deployments, operating blind,
  no path to recovery, and an unknown posture;
* 6 quick wins (30 days);
* 10 recommendations, one per dimension below 50 (60 days, capped at 10);
* 5 target states, for dimensions at 50 or more (90 days);
* 5 context notes.

Every rule links to up to three service domains.

## 2. DevOps Delivery Maturity (`devops_delivery` 1.1.0)

Eleven dimensions, two scored practice questions each: version control, trunk-based development
and branching, CI pipeline reliability, automated testing and quality gates, continuous delivery
and progressive deployment, Infrastructure as Code, artifact provenance and supply-chain security,
secrets management, GitOps and environment drift, developer experience, and incident learning and
delivery feedback.

**Self-reported practices vs. metrics.** Four optional DORA-style *metric* questions (deployments
in the last 30 days, merge-to-production time, change failure rate, time to restore) and their
source (measured by tooling, or an estimate) are **never scored**. The `devops_evidence` extension:

* rejects a source without any metric (`inconsistent`);
* derives `metrics_evidence`: `measured` (source: tooling), `estimate`, `unspecified` or `none`.

The result and the report show the metrics separately as "entered by you, not verified". They
never treat them as measured unless the visitor says so. A missing metric triggers the quick win
"Start measuring delivery"; an estimate triggers a context note.

**Findings** (27 rules):

* 6 risks and 6 quick wins (30 days);
* 11 recommendations, one per dimension below 50 (60 days, capped at 10);
* 3 example architecture patterns (90 days): trunk-based development with fast CI, pull-based
  GitOps, and progressive delivery with automatic rollback;
* 1 context note.

The result lists the findings in priority order as a **prioritised implementation backlog**,
grouped by 30/60/90 days.

**Versioning.** 1.0.0 (8 questions, preview) stays in the repository, so results saved with it
re-render. New requests use 1.1.0. A client still on 1.0.0 gets 409 `assessment_version_outdated`.

## 2a. Observability & Reliability (`observability_reliability` 1.1.0)

It uses the same eight questions as 1.0.0, in four areas weighted 30/25/25/20:

* signals: what is collected centrally, and log retention;
* alerting: routing, and how many alerts are actionable;
* incidents: the process, and reviews;
* SLOs: targets, and status communication.

1.1.0 makes it live and gives the rules kinds, horizons and domains:

* 3 risks (30 days): no alerts, no incident process, blind spots when signals score below 25;
* 2 quick wins (30 days): on-call routing, reducing alert noise;
* 4 recommendations (central telemetry, an incident runbook, SLOs, and a workshop for the
  reactive band), capped at 6;
* 2 target states (90 days): a reliability review, and error budgets with a release policy.

The `observability_signals` extension still rejects an on-call rota without collected telemetry,
and still reports the missing core signals.

## 3. Shared engine features (backward compatible)

* **Evidence**: `practice` (scored), `metric` and `context` (never scored, no points allowed).
* **Finding kinds**: `recommendation`, `risk`, `quick_win`, `target_state`, `pattern`, `context`.
  Only `recommendation` counts toward `max_recommendations`, so older definitions get the same
  results.
* **Horizon**: 30, 60, 90 or none; the result's `roadmap` groups findings by horizon.
* **Domains**: up to three of the ten catalogue domains; the web links them to the published hubs.
* **Explanations**: each finding's `because` lists the condition that triggered it. It quotes the
  visitor's answer for an answer condition, the score and threshold for a dimension or overall
  condition, and only the parts that held of an `any`. Explanations are computed from the stored
  answers; nothing new is stored.
* **Maturity per area**: each dimension gets a level from the same bands (Initial 0, Developing 25,
  Defined 50, Optimised 75).

## 4. Web

`components/tools/assessment/EngineAssessment.tsx` loads the localized definition from the API and
shows one area per step:

* native radios, checkboxes and text inputs;
* errors linked with `aria-describedby`, and focus on the step heading;
* metrics marked optional and unscored.

The result has:

* the overall score and level, with bars per area;
* findings by kind, each with "Why", plus a horizon badge;
* the roadmap or backlog;
* the metrics and their evidence;
* related service domains and the disclaimer;
* "Save and create the report" (opt-in), the HTML report view, the PDF download and deletion;
* an optional consultation.

Texts are in `content/{bg,en}/tool-engineering.ts`.

## 5. Tests

* API, `apps/api/tests/test_assessments_v2.py`: the ten requested domains; 0/100 boundaries;
  inclusive band thresholds; context that never scores; explanations and roadmap order; strong
  answers producing target states; the cap ignoring other kinds; metrics never scored and their
  evidence; answer validation (an inconsistent source, ranges, non-integers, unknown options,
  missing answers); backlog order and patterns; 1.0.0 still present; schema guards (points on
  unscored questions, unknown domains); the API in both locales; and a public definition without
  points.
* `tests/test_assessments.py`: the engine tests, pinned to the 1.0.0 definitions, are unchanged.
* Web: `engine.test.tsx` (step validation, numbers, metrics, explanations, report, consultation)
  and `tools-hub.test.tsx` (both tools live with localized URLs).
* e2e: `engineering-assessments.spec.ts` (a full Cloud journey in BG, DevOps in EN, API version and
  token checks, language switch) and `mobile.spec.ts` (DevOps completed on a phone with no
  horizontal scrolling).
