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

## 2a. Observability & Reliability (`observability_reliability` 1.2.0)

22 questions in 11 areas:

* golden signals and service health;
* metrics, logs and traces;
* OpenTelemetry instrumentation;
* SLIs, SLOs and error budgets;
* alert quality;
* incident response and on-call;
* runbooks and escalation;
* capacity and performance;
* dependency visibility;
* change failure analysis;
* disaster recovery and resilience testing.

The result shows maturity per area and:

* **critical gaps** (5 risks): no alerts, telemetry blind spots, no incident process, untested
  recovery, invisible external dependencies;
* **quick wins** (5);
* **recommendations** per area below 50, capped at 10;
* a **reference telemetry architecture**: OpenTelemetry SDKs → collector with sampling and
  personal-data filtering → stores → SLO alerts correlated by trace id;
* **example SLIs/SLOs**, labelled "illustrative only" and "not recommended values";
* **target states**: an error-budget policy and regular failure exercises.

The disclaimer says the assessment measures no availability or reliability and confirms no SLO
achievement. 1.1.0 and 1.0.0 stay, so saved results re-render. The `observability_signals`
extension (`telemetry`, `alert_routing`) still applies.

## 2b. Five further assessments

| Assessment | Areas (2 questions each) | Context (unscored) |
| --- | --- | --- |
| E-commerce Architecture (`ecommerce_architecture`, **11 areas, 23 questions**) | storefront and performance, maintainability, catalogue and inventory, orders and fulfilment, payment boundaries, search, analytics and consent, SEO and structured data, support and personalisation, ERP/CRM/WMS integrations, resilience and releases | platform (Shopify, WooCommerce, Magento, custom, other) |
| Data & Integration Readiness (`data_integration`, **11 areas, 23 questions**) | ownership and governance, source-system inventory, quality and completeness, API readiness, events, ETL/ELT pipelines, schema evolution and contracts, identity and access, privacy and retention, RAG suitability, lineage and monitoring | systems (ERP, CRM, store, accounting, warehouse, BI) |
| Responsible AI Governance (`ai_governance` **1.1.0, 12 areas, 25 questions**) | AI system inventory, data classification, third-party model and vendor risk, privacy and data handling, threat modelling, prompt injection and exfiltration controls, human oversight and approval boundaries, evaluations and model quality, traceability, incident response, model and version change management, retention and deletion | where AI is used (internal, customers, decisions about people, products); optional |
| AI Operations Readiness (`ai_ops_readiness` **1.1.0, 12 areas, 25 questions**) | agent and app inventory, owners and accountability, environment separation, prompt and model versioning, evaluation coverage, runtime observability, cost and token monitoring, tool permissions and approvals, incident response and rollback, retention and privacy, vendor portability, support and escalation | AI systems (assistant, RAG, agents, extraction); optional |
| FinOps & AI Cost (`finops` **1.1.0, 12 areas, 25 questions**) | allocation and tagging, budget ownership, forecasting and variance, reserved and committed capacity, Kubernetes and compute efficiency, waste detection, model selection and usage governance, token and request accounting, caching and batching, provider cost visibility, budget alerts and quotas, optimisation approvals | spend (AWS, Azure, GCP, Kubernetes, AI APIs, SaaS); optional |

The 1.0.0 versions of the last three (5 areas, 11 questions) stay in the registry so that saved results
still re-render; new scoring uses 1.1.0. In 1.1.0 the context question is optional.

**Finding tracks.** A new optional rule field, `track`, labels how a finding would be addressed:
platform configuration, traditional engineering, or a use case suitable for AI. It is shown as a badge
in the result and in the report.

* **E-commerce.** Uses the tracks throughout. AI cases appear only when their prerequisites hold:
  * support drafts need the order context;
  * product content needs one product data source;
  * semantic search needs search that is already tuned.

  Otherwise a "foundations first" note is shown. The assessment never asks for payment details
  (the card-data question asks only *who* handles card data), never claims access to the store or
  measures its speed, and promises no conversion uplift.
* **Data & Integration.**
  * Integration patterns: an API layer, outbox with an event bus, and ELT.
  * Remediation priorities: quick wins plus recommendations.
  * RAG appears as a pilot only when documents and access are ready (`rag` ≥ 67 and `access` ≥ 50).
    Otherwise it says "RAG is not the next step yet".
  * An always-present caveat says when RAG does *not* fit.
  * Quality answers are labelled as self-assessed, not measured, and no data upload exists.

The three 12-area assessments (1.1.0) each have:

* 4–6 risks and 4–6 quick wins (30 days);
* one recommendation per area below 50 (60 days, capped at 10);
* reference patterns;
* a target state (90 days);
* context notes.

**Responsible AI Governance.**

* **Outputs.** The result contains:
  * a gap analysis: area scores, with a control maturity level per area;
  * a risk-prioritised remediation checklist: risks, then quick wins, then per-area recommendations;
  * example governance documents: templates, explicitly not legal documents;
  * a suggested review and approval workflow, shown while oversight or change management is below 75;
  * links to the related security and engineering services.
* **Limits.** The assessment is educational. It is not legal advice and not a legal audit, and it does
  not confirm compliance with the AI Act, GDPR or any other law. The note on stricter requirements says
  that the assessment does not determine obligations.

**AI Operations Readiness.**

* **Outputs.** The result contains:
  * maturity per area;
  * an operational risk register: risks, each with its rule basis;
  * a minimum production-readiness checklist;
  * recommended managed service boundaries: what an external team can run and what stays with the
    client. This part is shown while support, observability or incidents score below 50;
  * a phased plan: the 30/60/90 roadmap.
* **Limits.** There is no connection to client systems and no telemetry. Every finding names the rule
  and the answer behind it.

**FinOps & AI Cost.**

* **Outputs.** Maturity, control gaps, optimisation recommendations and a roadmap.
* **Limits.**
  * It contains only choice questions: no prices, no currency, no amounts, no example cost formula.
  * It calculates no savings and has no billing access.
  * An always-present note says it is not the ROI calculator.

Every finding is explained by its trigger. The texts say the result is not an audit and not legal
advice.

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

All ten assessment tools share one result layout. Its parts are strengths and gaps, the methodology
version and basis (`ResultBasis`), the calculation note, and the services and workshops. See
[ASSESSMENT_COVERAGE.md](ASSESSMENT_COVERAGE.md).

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
