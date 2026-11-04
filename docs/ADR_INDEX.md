# Architecture decision index

Status: compiled on 2026-11-03 from the decisions already recorded in the design documents. This is an
**index**, not a second copy: each decision stays authoritative in the document named in the last
column, and a change is made there. The project has no separate ADR files; a new decision is
recorded in the document of its area and added here in the same commit.

Statuses: **accepted** (in force, implemented), **accepted · design** (agreed, not built yet),
**open** (owner decision pending), **superseded**.

## Platform and architecture

| ID | Decision | Status | Where |
| --- | --- | --- | --- |
| ADR-01 | Same-origin proxy route (`/api/*` through Next.js) instead of build-time rewrites | accepted | ARCHITECTURE.md → Key decisions |
| ADR-02 | Server-side sessions with CSRF tokens, not JWT | accepted | ARCHITECTURE.md, SECURITY.md |
| ADR-03 | Synchronous SQLAlchemy; FastAPI runs sync endpoints in a thread pool | accepted | ARCHITECTURE.md |
| ADR-04 | In-memory rate limiter for one API instance; Redis before scaling out (P1) | accepted (limit known) | ARCHITECTURE.md, IMPLEMENTATION_DEPENDENCIES_V2.md |
| ADR-05 | Client-only tools where possible; the API only for PDFs, saved links and hand-offs | accepted | ARCHITECTURE.md, TOOLS_PLATFORM.md |
| ADR-06 | Content in typed TypeScript modules, not a CMS | accepted | ARCHITECTURE.md |
| ADR-07 | No analytics or third-party scripts; an informational cookie notice (no consent choice, since no optional cookies exist) since 2026-11-03 | accepted | ARCHITECTURE.md, SECURITY.md |
| ADR-08 | Bulgarian route segments as folder names; English URLs rewritten by the proxy; BG and EN slugs of a page must differ | accepted | INTERNATIONALIZATION.md |

## Service catalogue and content

| ID | Decision | Status | Where |
| --- | --- | --- | --- |
| ADR-10 | Ten service domains group the existing services; a domain never replaces a service page | accepted | SERVICE_TAXONOMY.md |
| ADR-11 | Catalogue publishing per entry through a snapshot, not catalogue-wide releases | accepted (deviation from the design) | SERVICE_CATALOGUE_ARCHITECTURE.md, DATABASE_SCHEMA.md |
| ADR-12 | Assessments, workshops and managed offerings share the `services` table (`offering_type`) | accepted | SERVICE_CATALOGUE_ARCHITECTURE.md |
| ADR-13 | No prices, ranges or guaranteed outcomes on the website; engagements quoted individually | accepted | SERVICE_TAXONOMY.md §2, CONTENT_STRATEGY_BG_EN.md §3 |
| ADR-14 | Case studies only for real work with written client consent (`isPublishable`) | accepted | CONTENT_STRATEGY_BG_EN.md, `content/bg/editorial.ts` |
| ADR-15 | Reference scenarios are fictional and labelled; integration patterns carry a status from a fixed scale; nothing is "configured" without a verified system | accepted | REFERENCE_CONTENT.md |
| ADR-16 | Workshops published as their own catalogue page (IA-D3), ten formats, scoped individually | accepted (2026-11-03) | CONTENT_STRATEGY_BG_EN.md §5.5, INFORMATION_ARCHITECTURE_V2.md §11 |
| ADR-17 | Engineering topics exist without articles; topics with fewer than two articles are `noindex` and out of the sitemap | accepted (2026-11-03) | CONTENT_STRATEGY_BG_EN.md §5.6, SEO_IMPLEMENTATION.md |

## Tools and assessments

| ID | Decision | Status | Where |
| --- | --- | --- | --- |
| ADR-20 | One deterministic assessment engine with versioned definitions and scoring algorithms; saved results only on opt-in | accepted | ASSESSMENT_PLATFORM_ARCHITECTURE.md |
| ADR-21 | Methodology versions are published, and every result shows its basis (heuristic or measured) | accepted | ASSESSMENT_PLATFORM_ARCHITECTURE.md, ROI_AND_FINDER.md |
| ADR-22 | Scoring vectors shared between API and web are byte-identical copies checked by `scripts/test.ps1` | accepted | TESTING.md |
| ADR-23 | Advisor V2 adds deterministic insights on top of the validated V1 assessment; the model never writes them | accepted | AI_ADVISOR_V2.md |

## AI and operations

| ID | Decision | Status | Where |
| --- | --- | --- | --- |
| ADR-30 | AI providers only suggest; side effects go through an approval policy and an audited approval record | accepted | AI_ADVISOR.md, `app/ai/policy.py`, SECURITY.md |
| ADR-31 | Tenant isolation in code and in PostgreSQL: composite tenant foreign keys plus RLS under a NOLOGIN, NOBYPASSRLS runtime role switched to per transaction | accepted (2026-11-03) | AI_OPERATIONS_PORTAL.md §3 |
| ADR-32 | Registry versions are immutable once out of draft; incident and change timelines are append-only (triggers) | accepted | AI_OPERATIONS_PORTAL.md, AI_OPERATIONS_RUNBOOK.md |
| ADR-33 | Evaluations are simulated until a real runner is approved; output never approves a release | accepted | AI_OPERATIONS_PORTAL.md §13 |
| ADR-34 | Observability holds counters only, never prompt or output content; a future OTel gateway drops content at the edge | accepted · design (gateway) | AI_OBSERVABILITY.md |
| ADR-35 | The client portal is read-only, off by default and released only with explicit approval; TOTP secrets are derived, not stored | accepted (off) | CLIENT_PORTAL.md |
| ADR-36 | A separate runtime **login** role for the application before any public client access | accepted · design | AI_OPERATIONS_PORTAL.md §11a, CLIENT_PORTAL.md |
| ADR-37 | The earlier AI Operations Console target architecture | superseded by ADR-31…36 | AI_OPERATIONS_ARCHITECTURE.md |

## Leads and opportunities

| ID | Decision | Status | Where |
| --- | --- | --- | --- |
| ADR-40 | `submitted_service` is never changed; staff re-categorise `service` | accepted | DATABASE_SCHEMA.md |
| ADR-41 | Personal-data access is audited (`lead.viewed`), and audit details never contain personal data | accepted | SECURITY.md, DATABASE_SCHEMA.md |
| ADR-42 | Opportunity and proposal data cascade from the lead: retention and erasure remove them with it | accepted (2026-11-03) | OPPORTUNITY_WORKFLOW.md §3 |
| ADR-43 | Proposal versions are append-only; approval is a recorded human decision, blocked until a person has completed the commercial terms; it is not a signature and sends nothing | accepted (2026-11-03) | OPPORTUNITY_WORKFLOW.md §2 |
| ADR-44 | First drafts are assembled deterministically from the record (no LLM); a future LLM drafter must keep the same rules | accepted (2026-11-03) | OPPORTUNITY_WORKFLOW.md §2 |
| ADR-45 | The Ops runtime role has no privileges on lead tables | accepted (2026-11-03) | OPPORTUNITY_WORKFLOW.md §3, migration `0014` |
| ADR-46 | No automated e-mail sending and no CRM synchronisation without a separate approved integration task | accepted | OPPORTUNITY_WORKFLOW.md, SECURITY.md |

## Brand and protected content

| ID | Decision | Status | Where |
| --- | --- | --- | --- |
| ADR-50 | The logo, wordmark and favicon are frozen by owner decision | accepted | DESIGN_SYSTEM.md, CLAUDE.md |
| ADR-51 | The founder portrait and public contact details have one source and are protected by tests | accepted | CLAUDE.md, `lib/protected-content.test.ts`, `lib/company.test.ts` |
| ADR-52 | Product accounts stay separate from the operations portal; a link needs staff approval and registration never grants operational data | proposed | SAAS_EXPANSION_PLAN.md §5 |
| ADR-53 | Modular monolith with shared `auth_core` and separate principals; no microservices or second auth stack | accepted · design | SAAS_EXPANSION_PLAN.md §4 |
| ADR-54 | The catalogue stays free of prices; commercial data lives in the `products` module | accepted · design | SAAS_EXPANSION_PLAN.md §6 |
| ADR-55 | Hosted checkout behind a provider port; card data never touches our systems | accepted · design | SAAS_EXPANSION_PLAN.md §6 |
| ADR-56 | Transactional e-mail through an approved provider and an outbox; replaces ADR-46 for account and billing mail once approved | open | SAAS_EXPANSION_PLAN.md §6 |

## Open owner decisions

These are listed where they belong and are not repeated here:

* business decisions D1–D7: PLATFORM_VISION.md §10;
* content decisions C-1–C-6: CONTENT_STRATEGY_BG_EN.md §10;
* IA decisions IA-D1, IA-D2 and IA-D4: INFORMATION_ARCHITECTURE_V2.md §11;
* hosting, DPA, content capture and MFA method: IMPLEMENTATION_DEPENDENCIES_V2.md §4.
