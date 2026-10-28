# Interactive tools platform

Foundations for the business assessment and solution-design tools. Hub: `/bg/instrumenti` ↔
`/en/tools`.

## Tools and availability

| Tool | Key | Status | Route (BG ↔ EN) | Flag |
| --- | --- | --- | --- | --- |
| AI Automation Advisor (AI process analysis) | `advisor` | live | `/bg/ai-automation-advisor` ↔ `/en/ai-automation-advisor` | `tool_advisor` (on) |
| AI readiness assessment (12 questions, 6 weighted dimensions) | `readiness` | live | `/bg/instrumenti/ai-gotovnost` ↔ `/en/tools/ai-readiness` | `tool_readiness` (on) |
| Build your AI team (agent configurator with architecture diagram) | `team` | live | `/bg/instrumenti/ai-ekip` ↔ `/en/tools/ai-team` | `tool_team` (on) |
| AI ROI calculator | `roi` | live | `/bg/instrumenti/roi-kalkulator` ↔ `/en/tools/roi-calculator` | `tool_roi` (on) |
| Automation Opportunity Finder (questionnaire) | `finder` | live | `/bg/instrumenti/avtomatizatsii` ↔ `/en/tools/automation-finder` | `tool_finder` (on) |
| AI solution builder (architecture + roadmap) | `solution` | live | `/bg/instrumenti/ai-reshenie` ↔ `/en/tools/solution-builder` | `tool_solution` (on) |
| AI agent library (10 static agent pages) | `agents` | live | `/bg/ai-agenti` ↔ `/en/ai-agents` | `tool_agents` (on) |
| Cloud & Platform Maturity Assessment (engine, 10 areas) | `cloud_maturity` | live | `/bg/instrumenti/zrelost-na-oblak-i-platforma` ↔ `/en/tools/cloud-platform-maturity` | `tool_cloud` (on) |
| DevOps Delivery Maturity (engine, 11 areas, unscored metrics) | `devops_maturity` | live | `/bg/instrumenti/zrelost-na-devops-dostavkata` ↔ `/en/tools/devops-delivery-maturity` | `tool_devops` (on) |
| Observability & Reliability Assessment | `observability` | planned | intro `/bg/instrumenti/nablyudaemost-i-nadezhdnost` ↔ `/en/tools/observability-reliability` | — |
| E-commerce Architecture Assessment | `ecommerce_architecture` | planned | intro `/bg/instrumenti/arhitektura-na-online-magazin` ↔ `/en/tools/ecommerce-architecture` | — |
| Data Integration Assessment | `data_integration` | planned | intro `/bg/instrumenti/integratsiya-na-danni` ↔ `/en/tools/data-integration` | — |
| Responsible AI Governance Assessment | `ai_governance` | planned | intro `/bg/instrumenti/otgovoren-ai` ↔ `/en/tools/responsible-ai-governance` | — |
| AI Operations Readiness Assessment | `ai_ops_readiness` | planned | intro `/bg/instrumenti/gotovnost-za-ai-operatsii` ↔ `/en/tools/ai-operations-readiness` | — |
| FinOps & AI Cost Assessment | `finops` | planned | intro `/bg/instrumenti/finops-i-ai-razhodi` ↔ `/en/tools/finops-ai-cost` | — |

Solution builder and agent library: see [SOLUTION_BUILDER.md](SOLUTION_BUILDER.md). The two engineering
assessments: [ENGINEERING_ASSESSMENTS.md](ENGINEERING_ASSESSMENTS.md); their reports:
[REPORTS.md](REPORTS.md). Advisor V2: [AI_ADVISOR_V2.md](AI_ADVISOR_V2.md).

**Safeguard:** a tool is linked as a tool and routed to a working page only when `status === "live"`,
it has a path and its flag is on (`isToolAvailable` in `lib/tools.ts`). Planned tools have no flag,
no path and no time estimate: the hub marks them **"Очаквайте скоро" / "Coming soon"**, and their card
links only to an **intro page** under the final slug. The intro page states the purpose, audience,
expected output and what the assessment will cover, offers a consultant-led assessment (contact with
the domain's lead category), the related domain hub and two live tools. It has no form, no
questions and no start button (tested), is `noindex, follow` and is not in the sitemap. When the
tool goes live it keeps the same URL. `/instrumenti/<slug>` is generated only for available tools and
planned intros (`dynamicParams = false`); other slugs return 404.

**Hub (`/instrumenti`):** "Start here" with the featured live tools (`featured` in the registry:
Advisor, readiness, ROI), then every tool in `ToolsDirectory` with category filters (AI planning,
Readiness and governance, Business impact, Engineering assessments; `category` in the registry)
and availability filters (all, available now, coming soon). Filter buttons use `aria-pressed`, the
count is a polite live region, and an empty result offers "Show all". Every card shows the name,
purpose, audience, expected output (`output`), availability, the time only for live tools that
state it, and a CTA: the tool's own CTA when live, "Learn more" (intro page) when planned.

Flags: defaults in `lib/feature-flags.ts`; override at build/render time with
`TOOL_FLAGS="tool_readiness=off,tool_team=on"`. Turning on a planned tool's flag has no effect.

## Architecture

| Layer | Files |
| --- | --- |
| Registry (typed config) | `lib/tools.ts` — `ToolDefinition` (key, status, flag, icon, category, featured, path, minutes, services, domain), `TOOLS`, `TOOL_CATEGORIES`, `toolHrefs`, `toolIntroHrefs`, `toolMinutes`, `SERVICE_TOOLS`; `lib/tool-slugs.ts` — BG/EN slugs of every page under `/instrumenti` (also feeds `EN_SUBSEGMENTS.instrumenti`) |
| Flags | `lib/feature-flags.ts` |
| Analytics | `lib/analytics.ts` — `trackToolEvent`, `sanitizeToolEvent`, `registerAnalyticsSink` |
| Step workflow state | `lib/use-step-flow.ts` — steps, validation callback, start/step/complete callbacks |
| Tool logic (pure) | `lib/readiness.ts` — questions, scoring, levels, recommendations, share code; `lib/ai-team.ts` — agent library, rules, architecture graph, share code |
| Shared UI | `components/tools/ToolUi.tsx` (`StepProgress`, `ChoiceQuestion`, `StepNav`, `ResultSummary`, `RecommendationList`, `ToolLeadCapture`, `ToolState`), `ToolActions.tsx` (print / .txt / share link), `ToolCard.tsx` |
| Tool | `components/tools/ReadinessAssessment.tsx`; `components/tools/team/` (`AiTeamBuilder`, `AgentCard`, `TeamArchitecture`, `TeamResult`, `TeamControls`) |
| Pages | `app/[locale]/instrumenti/page.tsx` (hub: featured + `ToolsDirectory`), `app/[locale]/instrumenti/[tool]/page.tsx` (hosted tools and planned intros via `components/tools/ToolIntro.tsx`) |
| Content | `content/{bg,en}/tools.ts` (catalog + shared UI strings), `content/{bg,en}/tool-readiness.ts`, `content/{bg,en}/tool-team.ts` |

Business logic is pure and unit-tested; components only render and call it. No state library:
React state plus `useStepFlow`.

## Analytics events

Names: `tool_opened`, `tool_started`, `step_completed`, `tool_completed`, `export_requested`.
Fields (allow-list): `name`, `tool`, `locale`, `step`, `totalSteps`, `result` (enumerated bucket,
e.g. `developing` or a team complexity band), `format` (`print` | `text` | `link` | `pdf`). Tool keys include `roi` and `finder`. Anything else — answers, free text, names,
e-mails — is dropped by `sanitizeToolEvent`. Nothing is sent over the network today: events are
dispatched as a DOM `acs:analytics` CustomEvent; a consent-aware provider can be attached with
`registerAnalyticsSink` later.

## Privacy

The readiness result on the page is calculated entirely in the browser. Answers leave the browser
only on an explicit action, and the server re-scores them every time:

* **Download the PDF report** — answer levels (0–4), locale and model version go to
  `POST /api/public/readiness/report`; the PDF is rendered in memory and nothing is stored.
* **Send the result to the team** (optional form) — creates an inquiry with contact details, answer
  levels and the server-computed result, kept for `READINESS_RETENTION_DAYS`.

The share link contains the answer code (`?r=b` + 12 digits, one per question), never personal
data. Codes of the previous question set (12 digits without the `b` prefix) are not decoded, so an old
link opens the empty form instead of mapping its answers onto different questions. Details, API and
privacy assumptions: [READINESS_REPORTS.md](READINESS_REPORTS.md).

## States

`ToolState`: `loading` (skeleton, used as the Suspense fallback of hosted tools), `error`
(alert with optional retry), `empty`, `success` (e.g. "result loaded from a shared link").
Validation: per-step `ChoiceQuestion` errors (fieldset `aria-invalid` + `aria-describedby`) and a
step-level error summary; focus moves to the first invalid answer, and to the next step's heading
on success.

## Readiness model (`lib/readiness.ts`, model `2026-11.1`)

An indicative self-assessment — not a certified or scientifically validated maturity score, and
not compared with any external benchmark. Six dimensions, two questions each, answers 0–4. The
methodology and limitations are published on the tool page (`ReadinessMethodology`, `#methodology`),
generated from the same constants the score uses.

| Dimension | Weight | Questions |
| --- | --- | --- |
| Strategy | 15% | `strategy_goals`, `strategy_use_cases` |
| Infrastructure | 15% | `tech_integration`, `tech_environment` |
| Data | 20% | `data_access`, `data_quality` |
| Governance | 20% | `gov_data_protection`, `gov_oversight` |
| Talent and skills | 15% | `talent_skills`, `talent_support` |
| Organizational readiness | 15% | `people_ownership`, `people_change` |

Model `2026-10.2` (strategy, data, process, technology, people, governance) is retired for new
scores. Its submissions keep their stored result: the admin view and the PDF use the stored
`model_version` (`LEGACY_WEIGHTS` in `app/readiness/scoring.py`; the report texts keep the old
dimension and action names).

* Dimension score = (sum of its two answers / 8) × 100, rounded.
* Weights are normalised at run time (sum = 1). Overall = Σ exact dimension ratio × 100 × weight,
  clamped to 0–100 and rounded once (no accumulated rounding).
* Bands on the rounded overall: 0–24 exploration, 25–49 foundation building, 50–74 pilot ready,
  75–100 scaling readiness.
* Missing or invalid answers (not an integer 0–4) → `{ complete: false, missing: [...] }`; no score.
* Blockers (independent of the score, priority order): governance (data protection ≤ 1 or
  oversight = 0), data quality (≤ 1), integration (`tech_integration` ≤ 1), expertise
  (`talent_support` = 0, no access to technical expertise), organisation (ownership ≤ 1 or
  `people_change` = 0).
* Actions (always three): positions 1–2 = blocker actions in priority order, then gap actions
  weakest-first (dimensions covered by a blocker skipped), then the remaining dimensions lowest-first;
  position 3 = the band's next step (discovery workshop / foundation plan / scoped pilot / scale
  operations). Each action links to a service (`ACTION_SERVICE`).
* Strengths: dimensions ≥ 75 (else the best one if ≥ 50). Gaps: < 50, weakest first.
* Use cases: gated by dimension minimums (inquiry triage: infrastructure and organization ≥ 50;
  document extraction: data ≥ 25 and infrastructure ≥ 50; knowledge assistant: data and governance
  ≥ 50; reply drafting: organization and governance ≥ 50; reporting summaries: data ≥ 50); up to
  three, otherwise "process mapping".
* Next steps: each action links its service; the result also links the AI strategy and the advisory
  and enablement hubs, which list the published workshops and consultant-led assessments (or say
  that none are published yet).
* Golden vectors: `apps/api/scripts/gen_readiness_vectors.py` regenerates them deterministically
  (minimum, maximum, every uniform level, both sides of each band threshold, each blocker alone,
  seeded random sets); copy the file to `apps/web/src/lib/readiness.vectors.json`.
* Roadmap: blocker actions go into days 1–30 (the first two) and 31–60, plus the band's 30/60/90
  milestones.

## AI team model (`lib/ai-team.ts`)

Six steps and a result: business context → departments and problems → agent roles → data and
systems (volume, integrations, environment) → approval and risk (approval checkpoints, who maintains
it) → architecture and rollout → result. Everything is calculated in the browser from fixed rules;
each recommendation carries a reason the UI shows. The architecture step and the result say that the
suggested agents are illustrative: not deployed, not connected to the visitor's systems and not
running. Only an explicitly consented configuration is stored (see
[TEAM_CONFIGURATOR.md](TEAM_CONFIGURATOR.md)).

**Agent library** (10 roles). Each has a role (`task`, `coordination`, `oversight`), departments,
required and optional integrations, whether it acts externally, data sensitivity, a minimum
approval checkpoint, hard dependencies (`requires`), soft pairings (`pairsWith`) and a complexity.
Texts per role (purpose, inputs, outputs, oversight, data note) live in `content/{bg,en}/tool-team.ts`.

| Agent | Role | Requires | External | Sensitivity | Minimum approval | Complexity |
| --- | --- | --- | --- | --- | --- | --- |
| Lead Qualification | task | — | no | medium | sample review | low |
| Sales Research | task | — | no | low | sample review | low |
| Customer Support | task | Knowledge Assistant | yes | high | before external actions | medium |
| Content Operations | task | — | yes | low | before external actions | medium |
| Document Processing | task | — | no | high | sample review | high |
| Knowledge Assistant | task | — | no | medium | sample review | medium |
| Scheduling | task | — | yes | medium | before external actions | low |
| Reporting and Insights | task | — | no | medium | sample review | medium |
| Workflow Coordinator | coordination | ≥ 2 task agents | no | medium | sample review | high |
| Human Approval Supervisor | oversight | — | no | medium | every action | medium |

Rules:

* **Recommendations:** the main challenge maps to agents (weight 10), each department in scope to
  agents (weight 1); sorted by weight, then library order. Coordinator is suggested at ≥ 3 task
  agents; the supervisor when a task agent is external with high sensitivity, or at ≥ 3 task agents.
* **Dependencies:** adding an agent adds what it requires (transitively). A required agent cannot be
  removed while a dependent is selected (its checkbox is disabled with "Needed by …"); removing the
  dependent removes the automatic addition. At least one task agent is needed; a coordinator needs
  at least two.
* **Approval floor:** the role minimum, raised to "before external actions" for agents that act
  externally and to "sample review" for high-sensitivity data. Lower options are disabled.
  Required integrations are always selected.
* **Complexity points:** agent role complexity (1/2/3 each), each connected system (1), highest
  volume band (0–3), sensitive data (2), external actions (1), coordination (2), environment
  (managed 0 / your cloud 1 / on-premise 3). Bands: < 7 low, 7–13 medium, ≥ 14 high.
* **Risks** and **prerequisites** are explicit conditions (e.g. "approval bottleneck" = every-action
  approval at ≥ 1,000 tasks per month; "infrastructure" = your cloud or on-premise).
* **Workflows:** fixed chains (inquiry → meeting, support resolution, document intake, content
  pipeline, reporting, knowledge answers) filtered to the selected agents, with the coordinator first
  and a human step after any agent approved before external actions or on every action.
* **Rollout (MVP → pilot → production):** MVP = the most relevant selected task agent (simplest on
  ties) plus its dependencies, with test examples and human approval and no customer access until
  quality is proven; pilot = up to two further task agents with real users; production = the rest,
  coordination and oversight. A phase with no agents is not shown. (Internal keys stay `pilot`,
  `expand`, `scale` so saved links and the API are unchanged.)
  Phase effort is an indicative range by phase complexity (low 3–5, medium 5–8, high 8–12 weeks),
  labelled as an estimate with its assumptions; no savings or productivity figures are shown.
* **Architecture graph:** users (team, and customers when an agent acts externally) → orchestration
  (the coordinator, or "triggers and routing") → agents → approval points (for before-external /
  every-action agents; the supervisor organises them) → external systems; shared knowledge and data
  (knowledge base, documents, warehouse) are read by agents. `TeamArchitecture` renders it as SVG
  (horizontal from `lg`, vertical below), with roving focus (arrows, Home/End, Enter/Space, Escape),
  connection highlighting, a details panel and the same graph as a text list.
* **Share link** `?t=`: base64url JSON of enumerated values only (never the custom department name);
  decoding drops unknown values, re-applies the rules and restores only complete configurations.

Costs, saved configurations, the PDF plan and consultations (API, cost model, privacy, migration
0007): [TEAM_CONFIGURATOR.md](TEAM_CONFIGURATOR.md).

ROI calculator and Opportunity Finder (formulas, rubric, policy, charts): [ROI_AND_FINDER.md](ROI_AND_FINDER.md).

## Adding a tool

1. Add the key to `ToolKey`, a definition to `TOOLS` (status `planned`, category, domain) and its
   BG/EN slugs to `lib/tool-slugs.ts`; this publishes the "Coming soon" intro page.
2. Add catalog texts (BG + EN) in `content/{bg,en}/tools.ts`: title, purpose, audience, output,
   `covers`, intro `metaTitle` / `metaDescription`; no `cta` while planned.
3. Build the logic in `lib/<tool>.ts` with unit tests; build the UI from `components/tools/*`.
4. Host it: a flag (default off), the `HOSTED` map in `instrumenti/[tool]/page.tsx`, page
   content, metadata, keyword map and the SEO title map.
5. Switch `status` to `live` with `path` and `minutes`, add the `cta`, turn the flag on; add e2e tests
   (BG + EN). The URL stays the same, and the page becomes indexable and enters the sitemap.
6. Future backend: keep the pure scoring as the source of truth and add an API call behind the
   same component (as the Advisor does in `lib/advisor.ts`).
