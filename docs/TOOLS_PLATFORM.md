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
| AI solution builder | `solution` | planned | — | `tool_solution` (off) |
| AI agent library / configurator | `agents` | planned | — | `tool_agents` (off) |

**Safeguard:** a tool is linked and routed only when `status === "live"`, it has a path and its
flag is on (`isToolAvailable` in `lib/tools.ts`). Planned tools are shown as "in preparation"
without links, and `/instrumenti/<slug>` is generated only for available tools
(`dynamicParams = false`), so unbuilt tool URLs return 404.

Flags: defaults in `lib/feature-flags.ts`; override at build/render time with
`TOOL_FLAGS="tool_readiness=off,tool_team=on"`. Turning on a planned tool's flag has no effect.

## Architecture

| Layer | Files |
| --- | --- |
| Registry (typed config) | `lib/tools.ts` — `ToolDefinition` (key, status, flag, icon, path, minutes, services), `TOOLS`, `toolHrefs`, `toolMinutes`, `SERVICE_TOOLS` |
| Flags | `lib/feature-flags.ts` |
| Analytics | `lib/analytics.ts` — `trackToolEvent`, `sanitizeToolEvent`, `registerAnalyticsSink` |
| Step workflow state | `lib/use-step-flow.ts` — steps, validation callback, start/step/complete callbacks |
| Tool logic (pure) | `lib/readiness.ts` — questions, scoring, levels, recommendations, share code; `lib/ai-team.ts` — agent library, rules, architecture graph, share code |
| Shared UI | `components/tools/ToolUi.tsx` (`StepProgress`, `ChoiceQuestion`, `StepNav`, `ResultSummary`, `RecommendationList`, `ToolLeadCapture`, `ToolState`), `ToolActions.tsx` (print / .txt / share link), `ToolCard.tsx` |
| Tool | `components/tools/ReadinessAssessment.tsx`; `components/tools/team/` (`AiTeamBuilder`, `AgentCard`, `TeamArchitecture`, `TeamResult`, `TeamControls`) |
| Pages | `app/[locale]/instrumenti/page.tsx` (hub), `app/[locale]/instrumenti/[tool]/page.tsx` (hosted tools) |
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

The share link contains a 12-digit answer code (`?r=`), never personal data. Details, API and
privacy assumptions: [READINESS_REPORTS.md](READINESS_REPORTS.md).

## States

`ToolState`: `loading` (skeleton, used as the Suspense fallback of hosted tools), `error`
(alert with optional retry), `empty`, `success` (e.g. "result loaded from a shared link").
Validation: per-step `ChoiceQuestion` errors (fieldset `aria-invalid` + `aria-describedby`) and a
step-level error summary; focus moves to the first invalid answer, and to the next step's heading
on success.

## Readiness model (`lib/readiness.ts`)

Self-assessment, never a certification. Six dimensions, two questions each, answers 0–4.

| Dimension | Weight | Questions |
| --- | --- | --- |
| Strategy | 15% | `strategy_goals`, `strategy_use_cases` |
| Data | 20% | `data_access`, `data_quality` |
| Process | 15% | `process_definition`, `process_repeatability` |
| Technology & integration | 15% | `tech_integration`, `tech_environment` |
| People & change | 15% | `people_ownership`, `people_change` |
| Governance, security & risk | 20% | `gov_data_protection`, `gov_oversight` |

* Dimension score = (sum of its two answers / 8) × 100, rounded.
* Weights are normalised at run time (sum = 1). Overall = Σ exact dimension ratio × 100 × weight,
  clamped to 0–100 and rounded once (no accumulated rounding).
* Bands on the rounded overall: 0–24 exploration, 25–49 foundation building, 50–74 pilot ready,
  75–100 scaling readiness.
* Missing or invalid answers (not an integer 0–4) → `{ complete: false, missing: [...] }`; no score.
* Blockers (independent of the score, priority order): governance (data protection ≤ 1 or
  oversight = 0), data quality (≤ 1), integration (`tech_integration` ≤ 1), organisation
  (ownership ≤ 1 or `people_change` = 0).
* Actions (always three): positions 1–2 = blocker actions in priority order, then gap actions
  weakest-first (dimensions covered by a blocker skipped), then the remaining dimensions lowest-first;
  position 3 = the band's next step (discovery workshop / foundation plan / scoped pilot / scale
  operations). Each action links to a service (`ACTION_SERVICE`).
* Strengths: dimensions ≥ 75 (else the best one if ≥ 50). Gaps: < 50, weakest first.
* Use cases: gated by dimension minimums (e.g. inquiry triage needs process ≥ 50 and technology
  ≥ 50); up to three, otherwise "process mapping".
* Roadmap: blocker actions go into days 1–30 (the first two) and 31–60, plus the band's 30/60/90
  milestones.

## AI team model (`lib/ai-team.ts`)

Six screens: context → departments → agents → configuration → architecture → result. Everything is
calculated in the browser from fixed rules; nothing is sent or stored (backend persistence is the
next phase). Each recommendation carries a reason the UI shows.

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
* **Rollout:** pilot = the most relevant selected task agent (simplest on ties) plus its
  dependencies; expand = up to two further task agents; scale = the rest, coordination and oversight.
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

1. Add the key to `ToolKey`, a definition to `TOOLS` (status `planned`) and a flag (default off).
2. Add catalog texts (BG + EN) in `content/{bg,en}/tools.ts`.
3. Build the logic in `lib/<tool>.ts` with unit tests; build the UI from `components/tools/*`.
4. Host it: slug in `TOOL_SLUGS`, `EN_SUBSEGMENTS.instrumenti`, the `HOSTED` map in
   `instrumenti/[tool]/page.tsx`; metadata, keyword map and the SEO title map.
5. Switch `status` to `live` and the flag on; add e2e tests (BG + EN).
6. Future backend: keep the pure scoring as the source of truth and add an API call behind the
   same component (as the Advisor does in `lib/advisor.ts`).
