# AI Solution Builder and Agent Library

This is a **solution design tool**. It does not deploy, connect or run agents. Both pages say so
(`designNotice` / `note`). The diagram, the example workflows and the plan are illustrative. No
live integration exists, nothing is sent to an API and nothing is stored. Everything is computed
in the browser by deterministic rules.

## Routes

| Page | BG | EN | Rendering |
| --- | --- | --- | --- |
| Agent library | `/bg/ai-agenti` | `/en/ai-agents` | static page with client-side filters |
| Agent detail (10) | `/bg/ai-agenti/<slug>` | `/en/ai-agents/<slug>` | SSG (`generateStaticParams`, `dynamicParams = false`) |
| Solution builder | `/bg/instrumenti/ai-reshenie` | `/en/tools/solution-builder` | hosted tool page + client island in `<Suspense>` |

Slugs live in `lib/agent-slugs.ts` (an import-free map used by `i18n/config.ts`, the
`EN_SUBSEGMENTS["ai-agenti"]` entry). An example is `obrabotka-na-dokumenti` ↔
`document-processing-agent`.

Registry keys are `solution` and `agents`, both `live`, with flags `tool_solution` and `tool_agents`
on. If either flag is off, its pages return 404 and drop out of the hub, the service pages and the
sitemap.

Query parameters:

* `?w=<workflow>`: opens the builder with a workflow and its suggested capabilities and
  integrations. The library detail pages use it.
* `?s=<code>`: a shared design that opens straight on the plan. Invalid codes are ignored.

## Data model (no duplication with "Build your AI team")

| What | Source |
| --- | --- |
| Agent definitions (role, departments, integrations, sensitivity, external, dependencies, complexity, minimum checkpoint) | `lib/ai-team.ts → AGENTS` (unchanged) |
| Agent texts (name, purpose, inputs, outputs, oversight, sensitivity note) | `content/{bg,en}/tool-team.ts → agents` |
| Workflow chains | `lib/ai-team.ts → WORKFLOWS` (now exported), texts `teamTool.result.workflows` |
| Checkpoints, deployments, security texts, complexity labels | team model and team content |
| Catalogue attributes (risk, categories, data sources, example workflows) | **derived** in `lib/agent-library.ts` |
| Builder rules | `lib/solution.ts` |
| Library and builder texts | `content/{bg,en}/agent-library.ts`, `content/{bg,en}/tool-solution.ts` |

### Library (`lib/agent-library.ts`, `LIBRARY_VERSION = "2026-10.1"`)

* `INTEGRATION_CATEGORIES` has seven categories: `crm`, `erp`, `email_calendar`, `helpdesk`,
  `databases`, `document_storage`, `internal_apis`. `CATEGORY_OF` maps every team system type to
  exactly one category, for example email, calendar and chat to `email_calendar`.
* `riskLevel` is:
  * **high** for highly sensitive data;
  * **medium** for medium sensitivity, or for an agent that acts externally;
  * **low** otherwise.

  This is the risk of the role before mitigation.
* `LibraryEntry` has these fields:
  * `key`, `departments`, `role`;
  * `dataSources`: knowledge base, documents, warehouse;
  * `systems`, `categories`, `requiredCategories`;
  * `approval`: `minimumCheckpoint`;
  * `external`, `risk`, `complexity`, `requires`;
  * `workflows`: task agents get the workflows whose chain contains them. Coordination and
    oversight roles get every multi-agent workflow.
* `filterLibrary(filter, text)` filters by department, risk, complexity, category and a free-text
  query. The query is matched case-insensitively against the localized name, short text, purpose
  and departments. Results keep library order.

### Solution configuration (`lib/solution.ts`, schema `"1"`, model `2026-10.1`)

```ts
interface SolutionConfig {
  objective?: Objective;            // 6 enumerated objectives, each with a KPI to measure
  workflow?: WorkflowKey;           // the 6 team workflows
  capabilities: Capability[];       // rag | extraction | classification | generation | decision_support | tool_execution | orchestration
  integrations: IntegrationCategory[];
  sensitivity?: "public" | "internal" | "personal" | "regulated";
  approval?: Checkpoint;            // none | sample_review | before_external | every_action
  deployment?: Deployment;          // managed_cloud | customer_cloud | on_premise
  residency: boolean;               // data stays in the EU/EEA
  redaction: boolean;               // forced on for personal / regulated data
}
```

The configuration holds **only enumerated values**. There is no free text, and no field for keys,
tokens, passwords or URLs. The share code is
`1.<objective>.<workflow>.<capability indexes>.<category indexes>.<sensitivity>.<approval>.<deployment>.<residency><redaction>`.
`decodeSolution` is strict:

* it checks the version, the field count and the index ranges;
* codes are capped at 200 characters;
* it applies `normaliseSolution`;
* it returns null unless the design is complete.

## Rules

| Rule | Function |
| --- | --- |
| **Suggestions.** Choosing a workflow replaces capabilities and integrations with `WORKFLOW_DEFAULTS`. Everything stays editable. | `WORKFLOW_DEFAULTS` |
| **Approval floor.** The floor is sample review. It rises to approval before external actions for generated output in a customer-facing workflow (inquiry → meeting, support, content) or for tool execution. It rises to approval of every action for tool execution on regulated data. Lower options are disabled and the reasons are shown. | `minimumApproval`, `allowedApprovals` |
| **Redaction.** It is forced on for personal or regulated data. | `redactionRequired`, `normaliseSolution` |
| **Agents.** They are:<br>• the workflow chain;<br>• capability agents (RAG → knowledge assistant, extraction → document processing, decision support → reporting, orchestration → coordinator);<br>• dependencies (`addAgent`);<br>• the approval supervisor, when approval is before external actions or every action and there are ≥ 2 task agents.<br>Each agent comes with its reason. | `proposedAgents` |
| **Architecture.** The layers are trigger → orchestration (coordinator or fixed workflow) → agents → retrieval (vector index for RAG, data access for databases or documents) → tools (one per category) → approval (gate or sample review) → output. Monitoring (audit log, quality, cost) spans every layer. | `architecture` |
| **Write access.** It is `read_write` only with tool execution and a writable category; databases stay read-only. Writes are gated when approval is before external actions or every action. Authentication is OAuth for CRM, email/calendar and helpdesk, otherwise a service account. | `integrationRequirements` |
| **Complexity.** Points come from:<br>• capabilities: rag 2, extraction 2, classification 1, generation 1, decision support 2, tool execution 3, orchestration 3;<br>• integrations: crm 1, erp 3, email/calendar 1, helpdesk 1, databases 2, documents 1, internal APIs 3;<br>• data: personal 2, regulated 3;<br>• approval of every action: 1;<br>• deployment: customer cloud 1, on-premise 3.<br>Bands: low < 8, medium 8–14, high ≥ 15. | `assessComplexity` |
| **Security.** The considerations reuse the team `SecurityKey` texts (least privilege, secrets, audit log, provider terms, personal data, untrusted input, external actions, document permissions, regulated data, data location). | `securityConsiderations` |
| **Roadmap.** The phases are:<br>• discovery: 1–2 weeks;<br>• pilot: the core agent with its dependencies and the first two integrations, read-only, at `PHASE_WEEKS` of the band (high is capped to medium);<br>• integration of the remaining agents, integrations and write actions: only when there is something to add;<br>• operation: ongoing. | `roadmap` |
| **Services.** `ai_agents` is always included. `integrations` is added if there are integrations, `automation` for tool execution, `ai_tools` for RAG or generation and `ai_managed` always. `audit` is added for regulated data or high complexity. | `relatedServices` |

Every function normalises its input, so the result does not depend on the order of choices.

## Components

| Component | Purpose |
| --- | --- |
| `components/agents/AgentLibraryBrowser.tsx` | Search form (`role="search"`) with native selects, a live count, reset, and cards that link to the detail pages. |
| `components/tools/solution/SolutionBuilder.tsx` | Five input steps, then the architecture review. The plan is the result, so `StepProgress` shows 7 labels. It reuses `SelectCard`, `PillGroup`, `StepNav`, `ToolActions` (print / .txt / link), `ToolLeadCapture` and `MethodologyNote`. |
| `components/tools/solution/SolutionDiagram.tsx` | The layered HTML flow: an ordered list of layers with component toggle buttons (`aria-pressed`, `aria-controls`), a details panel (`aria-live`), a monitoring band, and **"The diagram as a list"**, a table of layer, component and responsibility. |

Pages:

* `app/[locale]/ai-agenti/page.tsx`
* `app/[locale]/ai-agenti/[agent]/page.tsx`
* `app/[locale]/instrumenti/[tool]/page.tsx`, which hosts `solution`

The sitemap lists the library index and the 10 detail pages per locale, with hreflang alternates.

## Security and privacy

* No form field accepts free text. The builder has no text, password or key inputs, and a test
  asserts this. The integrations step says: never enter API keys or passwords; access is set up
  during implementation with test keys and minimal permissions.
* No configuration value is sensitive. The share link carries only enumerated values.
* No API calls are made. The page has no secrets and no environment values in client code.
* Analytics use the existing allow-list (`tool: "solution"`, step numbers, complexity band, export
  format).

## Accessibility and mobile

* All inputs are native radios and checkboxes inside fieldsets with legends. Validation errors are
  linked to their fields, and focus moves to the first invalid input or to the next step heading.
* The diagram is HTML, not an image: the layers are list items and the components are buttons. A
  table alternative sits next to it.
* On phones the layers stack and the monitoring band follows them. Wide tables scroll inside their
  section, and the e2e tests assert there is no horizontal page overflow.

## Tests

| Kind | File |
| --- | --- |
| Unit: library derivation, risk, filters, slugs, localized URLs, texts | `src/lib/agent-library.test.ts` |
| Unit: validation, approval floor, normalisation, agents, architecture, write access, security, complexity bands (7/8, 14/15), roadmap, services, determinism, share code, BG/EN structure parity | `src/lib/solution.test.ts` |
| UI: builder flow, approval floor, forced redaction, no free-text inputs, diagram selection and table, `?w=`, `?s=` (BG), invalid code, analytics allow-list; library filters | `src/components/tools/solution/solution.test.tsx` |
| e2e: library BG (filters, detail, builder link), language switch and sitemap, builder EN end to end, shared code BG, phone overflow | `e2e/tests/solution.spec.ts` (+ updated `ia`, `tools`, `mobile` specs) |

## Limitations

* The rules are a planning heuristic. Weeks are indicative, there is no cost estimate (the team
  configurator has one), and there are no savings figures.
* There is one workflow per design. Several processes need several designs, or the team
  configurator.
* Integration categories are coarse: no vendor-specific systems, no API capability check and no
  data-volume sizing.
* The library has 10 fixed roles taken from the team model. New roles must be added to `AGENTS`, the
  team content and `AGENT_SLUGS`.
* There is no server-side save, PDF or lead hand-off with the configuration attached. The
  consultation CTA opens the contact form without the design. Sharing is by link only.
* There is no optional AI step: the builder is fully rule-based. An AI step would have to go through
  the advisor safety pipeline (`PLATFORM_EXPANSION_PLAN.md`, phase 6).
