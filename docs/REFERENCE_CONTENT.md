# Reference scenarios and integration patterns — content and governance

Status: implemented on 2026-11-03.

| Page | BG | EN |
| --- | --- | --- |
| Scenarios (20) | `/bg/referentni-stsenarii`, `/bg/referentni-stsenarii/<slug>` | `/en/reference-scenarios`, `/en/reference-scenarios/<slug>` |
| Patterns (11) | `/bg/integratsionni-modeli`, `/bg/integratsionni-modeli/<slug>` | `/en/integration-patterns`, `/en/integration-patterns/<slug>` |

* Slugs are in `lib/reference-slugs.ts`, which the locale routing reads.
* Structure is in `lib/reference.ts`: keys, categories, related domains, assessments and patterns, and
  pattern status.
* Texts are in `content/{bg,en}/reference.ts`.
* Detail pages are statically generated (`dynamicParams = false`).
* All pages are in the sitemap with hreflang alternates and are linked from the footer.

## Scenarios

There are 20 **fictional** scenarios in 7 categories:

| Category | Scenarios |
| --- | --- |
| AI workflows and agents | AI invoice workflow, multi-agent service desk, RAG policy assistant, AI support with handoff |
| Documents and data | contract document intelligence, hybrid integration, data pipeline |
| Commerce | shop–ERP synchronisation, product catalog enrichment |
| Cloud and platform | Azure landing zone, AWS landing zone, Kubernetes platform, cloud migration |
| Delivery | CI/CD and GitOps |
| Operations | observability with OpenTelemetry, platform reliability, FinOps and AI costs, AI operations |
| Security | identity and secrets, secure GenAI gateway |

Each scenario has:

* a fictional label;
* the business problem;
* assumptions and constraints;
* a reference architecture with components by stage, the reusable `FlowDiagram` (HTML list plus a
  table alternative);
* interfaces (from, to, via);
* the data flow;
* security boundaries and where a person approves;
* delivery phases;
* limitations and trade-offs;
* related services (domain hubs), assessments (tools) and patterns.

## Patterns

There are 11 patterns:

* REST APIs and webhooks;
* event-driven integration;
* ERP, CRM and commerce sync;
* RAG ingestion and retrieval;
* the human approval workflow;
* landing zone with hub-spoke networking;
* Terraform and GitOps;
* Kubernetes platform patterns;
* OpenTelemetry collection;
* identity and secret handling;
* the guarded LLM provider adapter.

Each pattern has:

* a description;
* when to use it and when not to;
* a reference diagram;
* prerequisites;
* security controls;
* failure modes with mitigations;
* observability;
* related services and the scenarios that use it.

The index can be searched (client side) and also works without JavaScript.

### Integration status scale

Statuses are stated against **this product's code** (`apps/api/app/integrations.py`, the Ops
platform), never against an assumed client system.

| Status | Meaning | Patterns today |
| --- | --- | --- |
| Documented pattern | A written approach applied in engagements; not run by this product | 7 |
| Demo | Implemented in this platform with internal or synthetic data only | human approval (AI action approvals, Ops change workflow) |
| Available adapter | Code here that calls a third-party API when configured | LLM provider adapter (the advisor's Anthropic adapter; mock otherwise) |
| Configured integration | An adapter connected to a named, verified system | **none** |
| Future | Designed or planned, not built | ERP/CRM sync (interfaces only), OpenTelemetry (contract only) |

## Content governance

1. **Fictional means fictional.**
   * Each scenario's problem starts with "A fictional …" ("Измислена/Измислен …").
   * The index carries the notice that nothing is a client project, a certified architecture or a
     measured result, and every page repeats the label.
   * Real client work would be published only as a case study, with the client's written consent
     ([CONTENT_STRATEGY_BG_EN.md](CONTENT_STRATEGY_BG_EN.md)), never here.
2. **No numbers that look like outcomes.** No percentages, money amounts or measured improvements
   appear in scenarios. Volumes in problem statements ("about a thousand invoices a month") are
   illustrative and are framed as part of the fictional setting.
3. **No vendor claims.** Products are named only where the pattern is specific to them (Azure, AWS,
   Kubernetes, OpenTelemetry). No partnership, certification or "certified connector" is implied.
4. **A status changes only with code.**
   * A pattern moves to "available adapter" when the adapter is merged with tests.
   * It moves to "configured" only when a named system is connected and verified, and the status
     note then names the evidence.
   * The content test fails if anything is marked configured without that change.
5. **Both languages together.** Every change edits `content/bg/reference.ts` and
   `content/en/reference.ts` in the same commit. Tests require the same structure (number of stages,
   items, phases, interfaces) in both.
6. **Review.**
   * Technical accuracy is reviewed by the engineer responsible for the domain.
   * Wording is reviewed against these rules.
   * New pages are added to `lib/reference-slugs.ts`; the sitemap, routing and tests pick them up.

## Tests

| Kind | File |
| --- | --- |
| Unit and content: 20 scenarios covering every topic, every section in both languages with the same structure, fictional labels, no outcome numbers or client claims, valid links, every pattern section, the honest status (none configured), reverse links, search, slugs, localized URLs, portal routing | `apps/web/src/lib/reference.test.ts` |
| Accessibility checks in e2e: one H1, HTML diagrams with table alternatives, labelled search, no horizontal overflow on phones | `apps/web/e2e/tests/reference.spec.ts` |
| e2e: BG index (20 cards, 7 categories, anchor navigation), scenario sections and links, language switch with localized slugs, pattern search and status legend, pattern detail, sitemap and `robots.txt` | `apps/web/e2e/tests/reference.spec.ts` |
