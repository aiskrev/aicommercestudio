# Commercial expansion — baseline audit (Phase 01)

Date: 2026-11-11. Type: read-only audit. No application code, dependency, migration or deployment was changed.
Baseline: `origin/main` @ `e56e5cd` (PR #74, legal compliance foundation), branch `feature/commercial-expansion`
(no commits yet, nothing pushed). Evidence comes from the checked-out code; documents are treated as claims.

Companion documents: [COMMERCIAL_EXPANSION_ROADMAP.md](COMMERCIAL_EXPANSION_ROADMAP.md) (phases, dependencies,
data model, API, routes, flags, migrations) and [COMMERCIAL_EXPANSION_PROGRESS.md](COMMERCIAL_EXPANSION_PROGRESS.md)
(phase statuses and checkpoints).

## 1. Repository facts

| Item | State |
| --- | --- |
| Monorepo | `apps/web` (Next.js 16 App Router, React 19, TypeScript, Tailwind 4), `apps/api` (FastAPI, SQLAlchemy, Alembic, PostgreSQL 17) |
| Alembic | single linear head **0025** (0023–0025 are the compliance migrations, already in production) |
| API surface | 26 router modules; about 215 route handlers (`ops_platform` 42, `ops` 12, `zone` 14, `workspace` 13, `accounts` 13 …) |
| Database | 83 tables; application role `acs_app_api` is restricted (no DDL) |
| Tests | API: 41 test files, ~773 test functions. Web: 71 unit/UI test files. E2E: ~38 Playwright specs (desktop and mobile) |
| CI | `ci.yml` (api, web + production build, e2e, portal), `audit.yml` (weekly pip/npm audit), `uptime.yml`, `release.yml` (manual: build-only / deploy / migrate-and-deploy, GitHub environment `production` with approval) |
| Compose files | `docker-compose.yml`, `.dev.yml`, `.legal-e2e.yml` (accounts + billing routes on, no Stripe), `.portal-e2e.yml` |
| Host tooling | No Node/Python on the host; every check runs in Docker (`scripts/test.ps1 -Suite api|web|e2e|portal|legal|audit|all`) |
| Docs | 70+ files in `docs/`; `apps/api/scripts/docs_sync.py` requires `README.md` to link each one and `API_REFERENCE.md` to list every route |

Protected content (CLAUDE.md) is unchanged by this programme: founder portrait, contact details through
`lib/company.ts` / `ContactDetails`, founder profile content, the logo.

## 2. Identity boundaries (three separate systems — they must stay separate)

| System | Cookie | Purpose | Code |
| --- | --- | --- | --- |
| Staff admin | `acs_session` (+ MFA) | CRM, catalogue, compliance, analytics | `routers/admin*.py`, `app/admin/(protected)` |
| Customer accounts / workspace | `acs_account_*` | Self-service: advisor projects, plan, billing, invoices, organisation, support | `app/accounts`, `routers/accounts.py`, `workspace.py`, `zone.py`, `app/[locale]/konto/*` |
| AI Operations portal | `acs_portal_*` | Read-only view of a managed client's AI operations | `app/portal`, `routers/ops*.py`, `app/portal` |

The commercial project portal (Phase 09) is built on the **customer account** system, never on `/portal`.
Public registration is controlled by `customer_accounts_enabled` and must stay off in production.

## 3. Feature-flag system

| Layer | Mechanism | Flags |
| --- | --- | --- |
| API (`app/config.py`, Pydantic settings, production guard) | environment variables | `ai_provider`, `assessments_preview_enabled`, `client_portal_enabled`, `advisor_workspace_enabled`, `billing_provider` (disabled/sandbox/stripe), `invoicing_source`, `analytics_enabled`, `customer_accounts_enabled`, `legal_cleanup_enabled`, `email_provider` (disabled/smtp/dev_file), `crm_provider`, `seo_data_provider`, `email_delivery_verified`, `workspace_rate_limit_floor` (test only) |
| Web (`lib/feature-flags.ts`, `lib/account-flag.ts`) | `TOOL_FLAGS="name=on|off"` server-side; account/billing routes hidden when the API answers 404 | `tool_*` (15 tools) |
| Release gates (`app/release_gates.py`) | code constant | `ACCOUNT_HEADER_LAYOUT_FIXED=False` (BLOCKER-ACC-HEADER-01) |

The production guard refuses to start with workspace, Stripe, sandbox billing, demo invoicing, dev_file mail,
unapproved retention or draft legal texts combined with accounts/billing. New commercial flags follow the same
pattern: Pydantic setting default **off**, exposed to the web through an API 404 (like billing) rather than a
build-time constant, and added to the production guard where activation needs an owner decision.

## 4. Capability inventory

Legend: **I** implemented, **P** partial, **M** missing.

| # | Feature | Implementation (paths) | Endpoints | Models | Flag | Status | Tests | Required change |
| - | --- | --- | --- | --- | --- | - | --- | --- |
| 1 | Public marketing site BG/EN | `app/[locale]/*`, `content/{bg,en}`, `i18n/config.ts` | — | — | — | I | unit + `public`, `i18n`, `seo`, `links` e2e | Conversion pass (Phase 02) |
| 2 | Service catalogue (DB) | `app/catalogue/*`, `lib/catalogue*.ts`, `/uslugi` | `/api/public/catalogue/*` (7), `/api/admin/catalogue/*` (12) | `service_domains`, `service_families`, `services`, `products`, `catalogue_entities`, `entity_translations`, `entity_relations`, `family_services` | — | I | `catalogue*.spec`, `test_catalogue*` | Add package/option layer (Phase 03) |
| 3 | Service packages | `/paketi` = *care plans* only (`lib/care-plans.ts`); workshops `/rabotni-sreshti` | — | none (static) | — | P | `care-plans.test.ts` | Packages for build services; versioned definitions (Phase 03) |
| 4 | Pricing | `lib/prices.ts` (bands "from / typical", factors BG 0.9, EU 1.08, `ACTIVE_PRICE_SCHEDULE="bg"`, `PRICE_SCHEDULE_OWNER_APPROVAL="pending"`), `PriceTag`; server price list only for billing (`billing_offers`) | `/api/billing/offers` | `billing_offers`, `plans`, `plan_prices`, `plan_versions`, `tax_scenarios` | — | P | `prices.test.ts` | One pricing source usable by web **and** API; no new approved prices (Phase 04) |
| 5 | Interactive tools (advisor, readiness, ROI, finder, team, solution builder, 8 more) | `components/tools`, `lib/{ai-team,solution,readiness,roi,finder}.ts`, `app/[locale]/instrumenti/*` | `/api/public/{advisor,readiness,solution,team,assessments}` | `advisor_assessments`, `assessment_*`, `team_configurations` | `tool_*` | I | golden vectors (web + API), tool e2e | Reuse as configurator inputs |
| 6 | Project configurator (generic) | none; team/solution tools are the nearest pattern (enumerated input, server model, share token, PDF) | — | — | — | M | — | Phase 05 |
| 7 | Quote basket | none | — | — | — | M | — | Phase 06 |
| 8 | Quote request / contact | `components/contact`, `routers/public.py` | `POST /api/public/leads`, `/quote-requests`, `/form-token` | `leads` (platform, budget_range, timeline, `service_details` JSONB, consents, marketing token) | — | I | `contact.spec`, `test_leads*` | Accept structured basket payload (Phase 06/07) |
| 9 | Leads / CRM (staff) | `routers/admin.py`, `app/opportunities`, `components/admin/*` | `/api/admin/leads*` (16), `/api/admin/leads/{id}/opportunity|proposals…` (8) | `leads`, `lead_notes`, `lead_opportunities`, `lead_proposals`, `lead_proposal_versions` | — | P | `admin.spec`, `test_opportunities*` | No company/contact entities, tasks, pipeline view, activity timeline (Phase 07/12) |
| 10 | Human-approved proposal | `opportunities/{service,drafts}.py`: kinds proposal/SOW; statuses draft → in_review → approved/rejected/withdrawn; generated drafts always `draft`; optimistic concurrency | `/api/admin/leads/{id}/proposals*` | `lead_proposals`, `lead_proposal_versions` | — | I (staff only) | `OPPORTUNITY_WORKFLOW.md` tests | Customer-facing quotation view/accept (Phase 07/09) |
| 11 | Customer accounts | `app/accounts`, `/konto/*` | `/api/accounts/*` (13) | `customer_accounts`, `customer_sessions`, `customer_tokens` | `customer_accounts_enabled` | I (off in prod) | `customer-accounts.spec`, `test_accounts*` | Hardening review (Phase 08); BLOCKER-ACC-HEADER-01 |
| 12 | Customer workspace | `routers/workspace.py`, `zone.py` | 13 + 14 routes | `customer_workspaces`, `workspace_members`, `workspace_invitations`, `workspace_projects` (advisor demo projects), `support_requests`, `entitlement_grants`, `usage_*` | `advisor_workspace_enabled` | I (advisor-scoped) | `workspace*.test`, e2e | **Commercial** project model is missing (Phase 09) |
| 13 | Commercial project portal | none (`workspace_projects` holds advisor versions, not client engagements) | — | — | — | M | — | Phase 09 |
| 14 | Documents / uploads / approvals | accounting documents only (`invoicing`); no `UploadFile` anywhere in the API | `/api/zone/documents*` | `accounting_documents` | `invoicing_source` | M | — | Phase 10 (uploads stay disabled until security review) |
| 15 | Transactional e-mail | `accounts/mail.py`, `notifications.py`; outbox table; providers disabled/smtp/dev_file | — | `outbox_messages` | `email_provider`, `email_delivery_verified` | P | outbox tests; no real mail in tests | New templates only; sending blocked until mailbox verified (Phase 11) |
| 16 | Stripe sandbox billing | `app/billing`, `routers/billing.py`, `AdvisorBilling.tsx` | `/api/billing/*` (9) | `billing_*` (9 tables) | `billing_provider` | I (sandbox only; prod guarded) | `billing*.test`, e2e legal stack (no Stripe) | Extend to quotation-based invoices only if owner decides (Phase 13) |
| 17 | Invoicing | `app/invoicing` | `/api/zone/documents*` | `accounting_documents` | `invoicing_source` | P (demo) | tests | Accountant decisions pending |
| 18 | AI demos | `/demo-tsentar`, `/ai-automation-advisor`, `/ai-agenti`, mock provider | `/api/public/advisor` | — | `ai_provider` (mock default) | I | `advisor.spec` | Presentation pass (Phase 14); no fake metrics |
| 19 | SEO | `lib/seo.ts`, `sitemap.ts`, `robots.ts`, JSON-LD, hreflang | — | — | — | I | `seo.spec`, `routing-and-seo.test.ts` | New pages must join sitemap + tests (Phase 15) |
| 20 | Analytics | own, anonymous, cookie-less page views and clicks; admin dashboard | `/api/public/analytics`, `/api/admin/analytics*` | `analytics_events` | `analytics_enabled` | I | `site-analytics.test.ts` | Funnel events for configurator/basket (Phase 15) |
| 21 | Legal / GDPR foundation | `app/compliance`, `legal-versions.json`, withdrawal, data requests | see `API_REFERENCE.md` | `legal_events`, `withdrawal_requests`, `data_requests` | `legal_cleanup_enabled` | I (texts are drafts) | `test_compliance*`, legal e2e | Owner/lawyer items remain open |
| 22 | AI Operations (managed services) | `app/ops`, `/portal` | `/api/ops/*` (54) | `ops_*` (21 tables) | `client_portal_enabled` | I | `portal.spec`, `ops-platform.spec` | Out of scope; keep isolated |
| 23 | Release process | `release.yml`, `docs/DEPLOYMENT.md` | — | — | — | I | — | Gates and staging (Phase 17) |

## 5. What the lead-to-delivery chain looks like today

```text
 Catalogue/pages ─▶ (tools: advisor, team, solution…) ─▶ contact / quote-request form ─▶ Lead (NEW…LOST)
                                                                                           │
                                                          staff: opportunity + proposal versions
                                                          (human approval, generated = draft only)
                                                                                           │
                                                           ──── gap: nothing customer-facing ────
                                                                                           │
 Customer account/workspace (advisor projects, plan, billing, invoices, support)   ◀── no link to a lead
```

Gaps that block the target flow: no configurator → no basket → leads carry only free text/JSONB; proposals never
reach the customer; no commercial project object; no documents, approvals or notifications.

## 6. Target architecture

```text
Catalogue ─▶ Configurator ─▶ Quote basket ─▶ Quote request ─▶ Lead / Opportunity
                                                                   │  (human review)
                                                                   ▼
                              Human-approved proposal (quotation, versioned) ─▶ customer accepts / comments
                                                                   │  (explicit acceptance, audit trail)
                                                                   ▼
        Customer workspace ─▶ Commercial project ─▶ milestones / tasks / updates
                                     │                    │
                                     ├─ Documents & approvals (uploads gated)
                                     ├─ Support requests
                                     └─ Optional billing (Stripe sandbox → owner decision)
```

Design rules: server is the only price/total calculator; browser sends enumerated keys; AI never produces an
approved offer; every customer-visible state change is audited; each stage is behind its own flag (off by
default); `/portal` identity is never reused.

## 7. Risks and blockers carried into the programme

| ID | Item | Effect |
| --- | --- | --- |
| R1 | Price schedule unapproved (`OWNER_DECISION_PRICE_SCHEDULE.md`) | Phases 03/04/06 may model structure and "from/typical" bands but must not publish new approved prices |
| R2 | Mailbox/domain unverified (`ai-ecomstudio.site` NXDOMAIN; live site on `ai-commercestudio.com`) | Phase 11 builds templates and outbox only; real sending stays blocked (`EMAIL_DELIVERY_VERIFIED`) |
| R3 | BLOCKER-ACC-HEADER-01 (header overflow with accounts on) | Customer-facing portal navigation cannot ship to production until fixed (Phase 02 can address the layout) |
| R4 | Legal texts are drafts; lawyer/accountant decisions open | No quotation acceptance may be presented as a binding contract; wording marked "pending legal review" |
| R5 | Uploads: no existing upload infrastructure or malware scanning | Phase 10 designs and implements behind a flag, default off, no public upload |
| R6 | Shared hot files (`models.py`, `config.py`, `main.py`, `routes.ts`, `i18n/config.ts`, `content/index.ts`, `conftest.py`) | Phases run sequentially, one author, linear migrations |
| R7 | Stripe has no credentials in this environment | Phase 13 limited to code + mocked/fixture tests; real sandbox run = BLOCKED until owner supplies test keys |
| R8 | Staging/Cloudflare/Hetzner changes need paid resources or DNS edits | Phase 17 produces runbooks and gates only; no infrastructure actions |
| R9 | `company.test.ts` times out under heavy parallel load (passes alone) | Known flake; do not disable |

## 8. Phase gate

The baseline is documented; no implementation started before this document. Proceed to Phase 02 per the roadmap.
