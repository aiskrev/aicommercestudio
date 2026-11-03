# AI Solution Builder and Agent Library

This is a **solution design tool**. It does not deploy, connect or run agents. Both pages say so
(`designNotice` / `note`). The diagram is a **reference architecture, never a running system**: it has
no status, health or live data. The example workflows and the plan are illustrative. No live
integration exists. Everything is computed in the browser by deterministic rules. The only request
to the API is the optional enquiry, which carries the design's enumerated share code (see [API](#api)).

Model `2026-11.1` (library `2026-11.1`, share code schema `"2"`) adds:

* two library-only archetypes;
* the seven-stage reference flow;
* composition rules that reject incompatible or unsafe designs, enforced in the browser and on the server;
* visible human-approval points;
* the optional enquiry.

## Routes

| Page | BG | EN | Rendering |
| --- | --- | --- | --- |
| Agent library | `/bg/ai-agenti` | `/en/ai-agents` | static page with client-side filters |
| Agent detail (12) | `/bg/ai-agenti/<slug>` | `/en/ai-agents/<slug>` | SSG (`generateStaticParams`, `dynamicParams = false`) |
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
* `?s=<code>`: a shared design that opens straight on the plan. Invalid, incomplete, incompatible or
  unsafe codes are ignored. Schema-1 codes still open when they pass the rules.

## Data model (no duplication with "Build your AI team")

| What | Source |
| --- | --- |
| Agent definitions (role, departments, integrations, sensitivity, external, dependencies, complexity, minimum checkpoint) | `lib/ai-team.ts → AGENTS` (unchanged) for the 10 team roles; `lib/agent-library.ts → LIBRARY_ONLY` for the 2 library-only archetypes |
| Agent texts (name, purpose, inputs, outputs, oversight, sensitivity note) | `content/{bg,en}/tool-team.ts → agents`; library-only ones in `content/{bg,en}/agent-library.ts → agents` (read through `agentText`) |
| Prerequisites, risks, approval points of every archetype | `content/{bg,en}/agent-library.ts → profiles` |
| Workflow chains | `lib/ai-team.ts → WORKFLOWS` plus `proposal_drafting` and `catalog_enrichment` (`lib/agent-library.ts → LIBRARY_WORKFLOWS`); texts `teamTool.result.workflows` / `agentLibrary.workflows` (`workflowText`) |
| Checkpoints, deployments, security texts, complexity labels | team model and team content |
| Catalogue attributes (risk, categories, data sources, example workflows) | **derived** in `lib/agent-library.ts` |
| Builder rules | `lib/solution.ts` |
| Library and builder texts | `content/{bg,en}/agent-library.ts`, `content/{bg,en}/tool-solution.ts` |

### Library (`lib/agent-library.ts`, `LIBRARY_VERSION = "2026-11.1"`)

**Twelve archetypes.** These are the 10 roles of "Build your AI team" plus two library-only archetypes:

* `proposal_generation`: Proposal Generation Assistant. It drafts proposals from approved templates;
  a salesperson approves before sending.
* `catalog_assistant`: E-commerce Catalog Assistant. It completes product data; changes are approved
  before publishing.

Both are `external`, so their floor is approval before external actions. They are not added to
`AGENTS`: the team configurator, its API port, its pricing file and its golden vectors stay unchanged.
`LIBRARY_KEYS` puts each one next to its closest team role.

**The curated archetypes map to library keys:**

| Archetype | Key |
| --- | --- |
| Customer Support Assistant | `customer_support` |
| Internal Knowledge Assistant | `knowledge_assistant` |
| Document Processing Agent | `document_processing` |
| Sales Qualification Assistant | `lead_qualification` |
| Proposal Generation Assistant | `proposal_generation` |
| E-commerce Catalog Assistant | `catalog_assistant` |
| Workflow Orchestration Agent | `workflow_coordinator` |
| Reporting and Analysis Assistant | `reporting_insights` |
| Human Approval Coordinator | `approval_supervisor` |

Every archetype defines:

* purpose, inputs and outputs;
* prerequisites;
* possible integrations, as categories with the required ones marked;
* risks;
* approvals: the minimum checkpoint and where a person approves;
* indicative complexity.

The detail page shows all of them.

* `INTEGRATION_CATEGORIES` has seven categories: `crm`, `erp`, `email_calendar`, `helpdesk`,
  `databases`, `document_storage`, `internal_apis`. `CATEGORY_OF` maps every team system type to
  exactly one category.
* `riskLevel` is:
  * **high** for highly sensitive data;
  * **medium** for medium sensitivity, or for an agent that acts externally;
  * **low** otherwise.

  This is the risk of the role before mitigation.
* `approval` uses `checkpointFor(def)`, the team rule, shared.
* `workflows`: task agents get the workflows whose chain contains them. Coordination and oversight
  roles get every multi-agent workflow.
* `filterLibrary(filter, text)` filters by department, risk, complexity, category and a free-text query.

### Solution configuration (`lib/solution.ts`, schema `"2"`, model `2026-11.1`)

```ts
interface SolutionConfig {
  objective?: Objective;            // 6 enumerated objectives, each with a KPI to measure
  workflow?: SolutionWorkflow;      // the 6 team workflows + proposal_drafting, catalog_enrichment
  capabilities: Capability[];       // rag | extraction | classification | generation | decision_support | tool_execution | orchestration | business_rules
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

* `parseSolutionCode` checks the version (`1` or `2`), the field count, the index ranges, duplicates
  and every enumerated value;
* codes are capped at 200 characters;
* the design must pass every composition rule. A tampered approval below the floor is **rejected**,
  not raised;
* it is then normalised and must be complete.

## Composition rules (reject, never repair)

`compositionIssues(config)` returns the broken rules in a fixed order. `stepIssues` reports each rule on
the step where the visitor fixes it. The review step re-checks all of them, because a choice may have
changed on the way back. The plan is not generated while any rule is broken.

| Rule | Step | Rejects |
| --- | --- | --- |
| `workflow_capability` | capabilities | the process lacks its required capability (`WORKFLOW_CAPABILITY`, e.g. document intake → extraction, knowledge answers → RAG) |
| `orchestration_needs_agents` | capabilities | orchestration with fewer than two task agents |
| `rag_needs_source` | integrations | RAG without documents/knowledge, databases or internal APIs |
| `extraction_needs_documents` | integrations | extraction without documents, e-mail or helpdesk |
| `decision_support_needs_data` | integrations | decision support without databases, CRM or ERP |
| `tool_execution_needs_target` | integrations | tool execution without a writable system (databases are read-only) |
| `regulated_needs_residency` | security | regulated data that does not stay in the EU/EEA (unsafe) |
| `approval_below_minimum` | security | approval below the floor (unsafe; only possible in a hand-edited code) |

Every `WORKFLOW_DEFAULTS` entry is a valid composition (tested).

## Reference architecture and human approval

`STAGES` = `trigger → input → orchestration → ai_rules → review → output`, with `monitoring` across
all of them.

| Stage | Components |
| --- | --- |
| trigger | `trigger:<kind>` from the workflow |
| input | `input:vector_index` (RAG), `input:data_access` (databases / documents), `input:<category>` connectors with read or read-and-write access |
| orchestration | `orchestration:coordinator` or `orchestration:workflow_engine` |
| ai_rules | `agent:<archetype>`, `rules:redaction`, `rules:business_rules`, and always `rules:output_validation` (model output never bypasses deterministic checks and permissions) |
| review | `review:gate` (approval before external actions / every action) or `review:sample_review` |
| output | `output:<workflow>` and, with tool execution, `action:<category>` for every writable category |
| monitoring | `monitoring:audit_log`, `monitoring:quality`, `monitoring:cost` |

Each component may carry `approval`:

* `"before"`: a person approves before it takes effect. This applies to the gate, every write action,
  external output behind the gate, and all output with "every action";
* `"sample"`: a sample is reviewed afterwards.

`humanApprovalPoints` lists them. The diagram marks them with text and an icon, not colour alone. The
table and the text export show them too, and the result has a "Where a person approves" section.

## Rules

| Rule | Function |
| --- | --- |
| **Suggestions.** Choosing a workflow replaces capabilities and integrations with `WORKFLOW_DEFAULTS`. Everything stays editable. | `WORKFLOW_DEFAULTS` |
| **Approval floor.** The floor is sample review. It rises to approval before external actions for generated output in a customer-facing workflow (inquiry → meeting, support, content) or for tool execution. It rises to approval of every action for tool execution on regulated data. Lower options are disabled and the reasons are shown. | `minimumApproval`, `allowedApprovals` |
| **Redaction.** It is forced on for personal or regulated data. | `redactionRequired`, `normaliseSolution` |
| **Agents.** They are:<br>• the workflow chain;<br>• capability agents (RAG → knowledge assistant, extraction → document processing, decision support → reporting, orchestration → coordinator);<br>• dependencies (`addAgent`);<br>• the approval supervisor, when approval is before external actions or every action and there are ≥ 2 task agents.<br>Each agent comes with its reason. | `proposedAgents` |
| **Architecture.** The seven stages above. | `architecture`, `humanApprovalPoints` |
| **Write access.** It is `read_write` only with tool execution and a writable category; databases stay read-only. Writes are gated when approval is before external actions or every action. Authentication is OAuth for CRM, email/calendar and helpdesk, otherwise a service account. | `integrationRequirements` |
| **Business rules.** 1 complexity point. They add `rules:business_rules` and the automation service. | `assessComplexity`, `relatedServices` |
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

## API

`POST /api/public/solution/enquiries` is the optional enquiry ([API_REFERENCE.md](API_REFERENCE.md)).

* **What it receives.** Only `{model_version, code}` plus the contact fields. No architecture, agents
  or results come from the browser.
* **Rule check.** `apps/api/app/solution/model.py` ports `parseSolutionCode`, `compositionIssues`,
  `minimumApproval`, `normaliseSolution`, `proposedAgents`, `assessComplexity`, `humanApprovalPoints`
  and `encodeSolution`.
* **Rejection.** A design that breaks a rule gets 422 `solution_invalid`, with `errors[].type` = the
  rule (or `malformed` / `incomplete`). Nothing is stored for it.
* **Accepted.** An accepted enquiry creates a lead (`service = ai_agents`, `source = solution_builder`).
  `service_details` = `{"kind": "solution", "model_version", "code", objective, workflow, capabilities,
  integrations, sensitivity, approval, minimum_approval, deployment, residency, redaction, agents,
  complexity, approval_points}`, all derived on the server.
* **Audit and admin.** The audit entry has counts and enumerations only. The admin lead detail shows
  a "Design from the AI solution builder" panel with a link that reopens the design.

**Parity.** `scripts/gen_solution_vectors.py` writes 120 golden vectors: 30 valid, the rest rejected,
covering every rule. They go to `apps/api/tests/fixtures/solution_vectors.json`, copied to
`apps/web/src/lib/solution.vectors.json`. Both apps test against them (`tests/test_solution.py`,
`src/lib/solution.parity.test.ts`), and `scripts/test.ps1` checks that the two copies are identical.
Change both implementations together and bump `SOLUTION_MODEL_VERSION` / `MODEL_VERSION`.

## Security and privacy

* No form field accepts free text. The builder has no text, password or key inputs, and a test
  asserts this. The integrations step says: never enter API keys or passwords; access is set up
  during implementation with test keys and minimal permissions.
* No configuration value is sensitive. The share link carries only enumerated values.
* No API calls are made while designing. The optional enquiry sends the enumerated code and the
  contact fields; it uses a form token and a honeypot, a required privacy acknowledgement, and a
  separate, unticked marketing consent. The page has no secrets and no environment values in client code.
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
| Unit: 12 archetypes, curated mapping, library-only roles not in the team model, derivation, risk, filters, dependencies, slugs, localized URLs, every profile field in BG/EN | `src/lib/agent-library.test.ts` |
| Unit: validation, defaults are valid compositions, every composition rule (one example each, several at once, step mapping), approval floor, normalisation, agents, the seven stages, output validation always present, human-approval points, write access, security, complexity bands, roadmap, services, determinism, share code (schema 1 still opens, tampered / unsafe codes rejected), BG/EN structure parity | `src/lib/solution.test.ts` |
| Parity with the API: 120 golden vectors | `src/lib/solution.parity.test.ts` |
| UI: builder flow, stages and approval marks in the diagram, approval floor, forced redaction, no free-text inputs in the steps, composition errors on the right step (capability, RAG source, residency), unsafe shared code ignored, the optional enquiry (privacy required, marketing unticked, only the code sent), `?w=`, `?s=` (BG), analytics allow-list; library filters with 12 cards | `src/components/tools/solution/solution.test.tsx` |
| API: golden vectors, every rule covered, rejection instead of repair, enquiry → lead with the server-derived design, rejected designs store nothing, validation, consent and abuse protection, admin view | `apps/api/tests/test_solution.py` |
| e2e: library BG (12 cards, filters, detail, builder link), library-only archetypes (profile fields, BG/EN slugs, own workflow), language switch and sitemap, builder EN end to end with stages and approvals, composition rejected in the builder and by the API, enquiry sent, shared code BG, phone overflow | `e2e/tests/solution.spec.ts` |

## Limitations

* The rules are a planning heuristic. Weeks are indicative, there is no cost estimate (the team
  configurator has one), and there are no savings figures.
* There is one workflow per design. Several processes need several designs, or the team
  configurator.
* Integration categories are coarse: no vendor-specific systems, no API capability check and no
  data-volume sizing.
* The library has 12 fixed archetypes. A new team role goes into `AGENTS`, the team content and
  `AGENT_SLUGS`. A new library-only one goes into `LIBRARY_ONLY`, the library content, `AGENT_SLUGS`,
  the API port's `_LIBRARY_ONLY` and the vectors.
* Library-only archetypes are not offered in "Build your AI team" and have no cost estimate.
* There is no server-side save or PDF. The optional enquiry attaches the design to a lead. Otherwise
  sharing is by link only.
* There is no optional AI step: the builder is fully rule-based. An AI step would have to go through
  the advisor safety pipeline (`PLATFORM_EXPANSION_PLAN.md`, phase 6).
