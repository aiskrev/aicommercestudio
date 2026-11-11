# A.I. Commerce Studio — website, interactive tools and lead management

Bilingual (Bulgarian / English) marketing website and administration panel for an AI-powered
e-commerce engineering studio. It includes:

* the AI Business Automation Advisor;
* seven interactive tools (AI readiness assessment, Build your AI team, ROI calculator, Automation
  Opportunity Finder, AI Solution Builder, AI Agent Library, plus the advisor);
* the AI Managed Services offering;
* a staff-only scaffold for the future AI Operations Portal (organisations, roles, agent registry).

Runs fully on `localhost` with Docker — no domain, hosting, paid AI model or Shopify credentials are
required.

Current verified state (code, branches, migrations, capability inventory):
[docs/PLATFORM_BASELINE_AUDIT.md](docs/PLATFORM_BASELINE_AUDIT.md).

| Part | Technology |
| --- | --- |
| Web (`apps/web`) | Next.js 16 (App Router, standalone), React 19, TypeScript 6, Tailwind CSS 4 |
| API (`apps/api`) | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, Argon2 |
| Database | PostgreSQL 17 |
| Tests | Pytest, Vitest + Testing Library, Playwright, Ruff, ESLint, pip-audit, npm audit |
| Infra | Docker Compose (dev / test / production overrides), Caddy example for HTTPS |

## Quick start (Windows 11, PowerShell, Docker Desktop running)

```powershell
git clone https://github.com/aiskrev/aicommercestudio.git D:\Projects\AI-Commerce-Studio
cd D:\Projects\AI-Commerce-Studio
.\scripts\setup.ps1            # creates .env with random local secrets, prints the dev admin login
.\scripts\start.ps1            # builds and starts db + api + web, waits for health checks
```

- Website: http://localhost:3000 (redirects to http://localhost:3000/bg; English: http://localhost:3000/en)
- AI Managed Services: http://localhost:3000/bg/uslugi/ai-managed-services · http://localhost:3000/en/services/ai-managed-services
- Founder & CEO profile: http://localhost:3000/bg/za-nas/osnovatel · http://localhost:3000/en/about/founder (company contact details: `apps/web/src/lib/company.ts`)
- Admin: http://localhost:3000/admin (credentials are in `.env`: `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`)
- API docs (development only): http://localhost:8000/api/docs

Full step-by-step instructions, troubleshooting and the non-Docker workflow: [docs/INSTALL_WINDOWS.md](docs/INSTALL_WINDOWS.md).

## Tests

```powershell
.\scripts\test.ps1             # API (pytest + ruff), web (typecheck + lint + unit), e2e (Playwright)
.\scripts\test.ps1 -Suite audit  # dependency vulnerability audit (pip-audit, npm audit)
.\scripts\lighthouse.ps1         # Lighthouse lab baseline (mobile + desktop, median of 3)
```

The same suites run in GitHub Actions on every pull request and push to `main`
(`.github/workflows/ci.yml`; weekly dependency audit in `audit.yml`). See [docs/TESTING.md](docs/TESTING.md).

The latest executed results are recorded in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## Repository layout

```
apps/api/        FastAPI backend, Alembic migrations (0001–0008), tests; CLI: seed, create-admin, set-password,
                 maintenance, purge-synthetic, ops-create-org, ops-seed-demo, ops-purge-demo
apps/api/scripts docs_sync.py (API docs check / openapi.json export), gen_team_vectors.py
apps/web/        Next.js site, tools and admin UI, unit tests; apps/web/e2e = Playwright suite + Lighthouse harness
infra/           production compose override, Caddy example, Linux backup script
scripts/         PowerShell helpers: setup, start, stop, test, backup-db, restore-db, demos
docs/            architecture, schema, API, security, testing, roadmap, business plan, status
docker-compose.yml, docker-compose.dev.yml, .env.example
```

## Documentation

Every file in `docs/` is listed here. `scripts/test.ps1` fails when one is missing.

**Start here**

| Document | Contents |
| --- | --- |
| [PLATFORM_BASELINE_AUDIT.md](docs/PLATFORM_BASELINE_AUDIT.md) | Verified state: branches, migrations, capability inventory, risks, doc contradictions |
| [IMPLEMENTATION_DEPENDENCIES_V2.md](docs/IMPLEMENTATION_DEPENDENCIES_V2.md) | Next-generation phases, dependencies and acceptance criteria |
| [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | What is done, latest executed test results, known limitations |
| [RELEASE_REPORT.md](docs/RELEASE_REPORT.md) | Release review: gates, fixes, performance, migration/deployment, verdict |
| [ROADMAP.md](docs/ROADMAP.md) | Next versions |
| [COMMERCIAL_EXPANSION_AUDIT.md](docs/COMMERCIAL_EXPANSION_AUDIT.md) | Commercial expansion baseline: inventory, identity boundaries, flags, target architecture, risks |
| [COMMERCIAL_EXPANSION_ROADMAP.md](docs/COMMERCIAL_EXPANSION_ROADMAP.md) | Commercial expansion phases, dependencies, data model, API and route plan, flags, migrations |
| [COMMERCIAL_EXPANSION_PROGRESS.md](docs/COMMERCIAL_EXPANSION_PROGRESS.md) | Commercial expansion phase statuses and checkpoints |
| [COMMERCIAL_EXPANSION_DECISIONS.md](docs/COMMERCIAL_EXPANSION_DECISIONS.md) | Commercial expansion decisions taken and decisions still pending with the owner |
| [PROJECT_CONFIGURATOR.md](docs/PROJECT_CONFIGURATOR.md) | Project configurator (off by default): model, rules, prices, human review, security, tests |
| [QUOTE_BASKET.md](docs/QUOTE_BASKET.md) | Quote basket (off by default): server-side draft request, ownership by token, concurrency, expiry, storage, tests |
| [QUOTATIONS.md](docs/QUOTATIONS.md) | Quotations (off by default): configured enquiry to human-approved, client-facing offer; secret link, one answer, audit, gate |

**Strategy and positioning**

| Document | Contents |
| --- | --- |
| [PLATFORM_VISION.md](docs/PLATFORM_VISION.md) | Next-generation positioning, product architecture, principles, outstanding decisions |
| [SERVICE_TAXONOMY.md](docs/SERVICE_TAXONOMY.md) | Ten service domains: names, slugs, families, deliverables, engagement models, status, SEO texts |
| [CONTENT_STRATEGY_BG_EN.md](docs/CONTENT_STRATEGY_BG_EN.md) | Voice, claims policy, keywords, page templates, navigation, roll-out phases (BG/EN) |
| [BG-LANGUAGE-STYLE-REVIEW.md](docs/BG-LANGUAGE-STYLE-REVIEW.md) | Bulgarian copy review 2026-11-10: voice, glossary, changes, coverage and open questions |
| [BG-FINAL-STYLE-PASS.md](docs/BG-FINAL-STYLE-PASS.md) | Final Bulgarian style pass: exact changes, terminology decisions, kept copy and validation |
| [INFORMATION_ARCHITECTURE_V2.md](docs/INFORMATION_ARCHITECTURE_V2.md) | Next IA: site map, mega-menu, mobile nav, breadcrumbs, recommendations, canonical/hreflang/indexability rules, route-by-route matrix, migration risks |
| [PRODUCT_MODULES.md](docs/PRODUCT_MODULES.md) | Product modules (foundation, public, staff, client portal): routes, code, API, status, relations |
| [SERVICE_CATALOGUE_ARCHITECTURE.md](docs/SERVICE_CATALOGUE_ARCHITECTURE.md) | Service catalogue design: conflicts with the current schema, model, lifecycle, locale policy, caching, migration and backfill plan (V1 slice implemented) |
| [DATABASE_SCHEMA_V2.md](docs/DATABASE_SCHEMA_V2.md) | Catalogue tables, constraints, indexes and roles; migration 0009 implements the V1 slice, the rest is planned |
| [API_ARCHITECTURE_V2.md](docs/API_ARCHITECTURE_V2.md) | Planned public and admin catalogue API: pagination, filtering, concurrency, caching, errors (not implemented) |

**Setup, architecture and operations**

| Document | Contents |
| --- | --- |
| [INSTALL_WINDOWS.md](docs/INSTALL_WINDOWS.md) | Prerequisites, setup, daily commands, troubleshooting |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, request flow, i18n, AI layer, decisions |
| [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Tables, constraints, migrations, retention |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | All endpoints (checked against the code); [`openapi.json`](docs/openapi.json) |
| [TESTING.md](docs/TESTING.md) | Test strategy and how to run every suite |
| [SECURITY.md](docs/SECURITY.md) | Threat model, controls, GDPR, production checklist |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment (prepared, not executed): proxy, DNS, secrets, backups, monitoring, rollback |
| [PERFORMANCE_BASELINE.md](docs/PERFORMANCE_BASELINE.md) | Lighthouse lab baseline and method |
| [VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md) | Independent QA/security/DevOps review (2026-10-23) |

**Product areas**

| Document | Contents |
| --- | --- |
| [INFORMATION_ARCHITECTURE.md](docs/INFORMATION_ARCHITECTURE.md) | Current navigation, services, tools, conversion flows (v2 design: INFORMATION_ARCHITECTURE_V2.md) |
| [INTERNATIONALIZATION.md](docs/INTERNATIONALIZATION.md) | BG/EN URLs, switcher, cookie, translations, SEO, API and admin languages |
| [SEO_IMPLEMENTATION.md](docs/SEO_IMPLEMENTATION.md) | SEO checklist, keyword map (unverified), indexation rules, editorial guidelines |
| [AI_ADVISOR.md](docs/AI_ADVISOR.md) | AI Business Automation Advisor: flow, architecture, safety controls, retention, demo |
| [AI_ADVISOR_V2.md](docs/AI_ADVISOR_V2.md) | Advisor V2: versioned contract, enumerated context, deterministic insights with provenance, compatibility |
| [ASSESSMENT_PLATFORM_ARCHITECTURE.md](docs/ASSESSMENT_PLATFORM_ARCHITECTURE.md) | Deterministic assessment engine: definitions, scoring, rules, saved results, retention |
| [ENGINEERING_ASSESSMENTS.md](docs/ENGINEERING_ASSESSMENTS.md) | The eight engine assessments (cloud, DevOps, observability, e-commerce, data, AI governance, AI operations, FinOps): domains, rules, metrics evidence, roadmap |
| [ASSESSMENT_COVERAGE.md](docs/ASSESSMENT_COVERAGE.md) | Coverage matrix of the ten assessment tools: shared results layout, backend, UI, report, tests and missing capabilities |
| [REPORTS.md](docs/REPORTS.md) | Report documents: HTML view and PDF architecture, access by token, limits, optional consultation |
| [TOOLS_PLATFORM.md](docs/TOOLS_PLATFORM.md) | Tool registry, flags, shared UI, analytics, AI team model |
| [READINESS_REPORTS.md](docs/READINESS_REPORTS.md) | AI readiness: PDF report, submissions, admin view |
| [TEAM_CONFIGURATOR.md](docs/TEAM_CONFIGURATOR.md) | Build your AI team: costs, saved links, PDF plan, consultations |
| [ROI_AND_FINDER.md](docs/ROI_AND_FINDER.md) | ROI calculator and Automation Opportunity Finder: formulas and policy |
| [SOLUTION_BUILDER.md](docs/SOLUTION_BUILDER.md) | AI Solution Builder and AI Agent Library: 12 archetypes, composition rules, reference architecture, optional enquiry |
| [REFERENCE_CONTENT.md](docs/REFERENCE_CONTENT.md) | 20 fictional reference scenarios and 11 integration patterns with honest status; content governance |
| [AI_MANAGED_SERVICES.md](docs/AI_MANAGED_SERVICES.md) | AI Managed Services: page, packages, intake form, storage, admin, limits |
| [AI_MANAGED_SERVICES_V2.md](docs/AI_MANAGED_SERVICES_V2.md) | AI Managed Services v2: proposed service levels, current vs planned capability, qualification form, admin categorisation |
| [AI_MANAGED_SERVICES_PRICING.md](docs/AI_MANAGED_SERVICES_PRICING.md) | Internal, hypothetical pricing guidance (not published) |
| [AI_OPERATIONS_PORTAL.md](docs/AI_OPERATIONS_PORTAL.md) | Ops platform architecture: tenancy, RLS with a restricted role, RBAC, verified security properties, registry, evaluations, roadmap |
| [AI_OBSERVABILITY.md](docs/AI_OBSERVABILITY.md) | Bounded observability data model, costs with versioned rate cards, budgets, retention, future OpenTelemetry ingestion contract |
| [AI_OPERATIONS_RUNBOOK.md](docs/AI_OPERATIONS_RUNBOOK.md) | Incident and controlled change workflows (record management, no automation) |
| [CLIENT_PORTAL.md](docs/CLIENT_PORTAL.md) | Read-only client portal (off by default): identities, MFA, sessions, recovery, release prerequisites |
| [CUSTOMER_ACCOUNTS.md](docs/CUSTOMER_ACCOUNTS.md) | Customer accounts (off by default): registration, verification, recovery, sessions, e-mail outbox and shared rate limits |
| [ADVISOR_WORKSPACE.md](docs/ADVISOR_WORKSPACE.md) | Advisor Workspace (off, not released): plans, entitlements, quota policy, projects and versions |
| [STRIPE_BILLING.md](docs/STRIPE_BILLING.md) | Stripe in test mode: checkout, webhooks, access policy, reconciliation and live activation steps |
| [INVOICING.md](docs/INVOICING.md) | Who issues documents, snapshots, the retry queue and the tax gate; nothing real is issued yet |
| [ANALYTICS.md](docs/ANALYTICS.md) | Anonymous, cookieless site statistics: what is collected, what is not, the admin dashboard, how to switch it on, retention |
| [ACCOUNTS_GO_LIVE.md](docs/ACCOUNTS_GO_LIVE.md) | Steps to switch customer accounts on at the live site: Brevo, Turnstile, server `.env`, release, checks, rollback |
| [ACCOUNTS_RELEASE_CHECKLIST.md](docs/ACCOUNTS_RELEASE_CHECKLIST.md) | Gates G0–G7 and the order of switching on accounts, paid plans and billing (2026-11-10) |
| [SERVICES_DEMO_PLAN.md](docs/SERVICES_DEMO_PLAN.md) | Plan: demo of the services for free, paid for more; two tracks, stages, decisions for the owner |
| [PRICING.md](docs/PRICING.md) | Published indicative prices: Bulgarian and EU markets, the rule, where they appear, open checks |
| [LEGAL_COMPLIANCE_REMEDIATION_2026-11-10.md](docs/LEGAL_COMPLIANCE_REMEDIATION_2026-11-10.md) | Legal compliance remediation: issue-by-issue status, blockers, legal and accounting review packages, verification, commands |
| [legal-templates/](docs/legal-templates/) | Draft (not lawyer-reviewed) structure templates: maintenance / managed services agreement and Article 28 GDPR schedule |
| [LEGAL_SOURCES.md](docs/LEGAL_SOURCES.md) | Legal source package for the Bulgarian lawyer: official sources, what was verified and what was not, open questions |
| [LEGAL_RETENTION.md](docs/LEGAL_RETENTION.md) | Retention of withdrawal and data requests (no period approved), the deletion rules by billing state, Stripe-side data |
| [LEGAL_CONTENT_RELEASE.md](docs/LEGAL_CONTENT_RELEASE.md) | Draft, approved, published and accepted legal text revisions; hashes; how a legal text is released |
| [DNS_MAILBOX_VERIFICATION.md](docs/DNS_MAILBOX_VERIFICATION.md) | DNS and mailbox evidence, its limits, and the owner's verification checklist |
| [COOKIE_AUDIT.md](docs/COOKIE_AUDIT.md) | Cookie and browser-storage audit procedure and results, with the evidence class of every item |
| [ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | Automated accessibility checks of the legal flows, results, and what still needs a manual review |
| [OWNER_DECISION_PRICE_SCHEDULE.md](docs/OWNER_DECISION_PRICE_SCHEDULE.md) | Owner decision record (not taken): one price list for Bulgarian and English pages, with the exact before/after amounts |
| [RELEASE_REVIEW_ACCOUNTS_BILLING.md](docs/RELEASE_REVIEW_ACCOUNTS_BILLING.md) | Release review: evidence, gaps, rollback and readiness by area |
| [OPPORTUNITY_WORKFLOW.md](docs/OPPORTUNITY_WORKFLOW.md) | Engineering opportunity record, proposal and SOW drafts, review checks, human approval, retention |
| [INTEGRATION_AUDIT_V2.md](docs/INTEGRATION_AUDIT_V2.md) | Integration and quality audit of the V2 platform: capability matrix, findings by severity, executed tests, launch blockers, V2 document map |
| [REDESIGN_AUDIT_V4.md](docs/REDESIGN_AUDIT_V4.md) | Public website redesign v4: audit, token and typography proposal, component mapping, owner decisions, phases and implementation report |
| [ADR_INDEX.md](docs/ADR_INDEX.md) | Index of the architecture decisions recorded across the design documents |
| [CLAUDE_IMPLEMENTATION_PROMPTS.md](docs/CLAUDE_IMPLEMENTATION_PROMPTS.md) | How implementation work is briefed to an AI coding agent; shipped prompt packages |
| [AI_OPERATIONS_ARCHITECTURE.md](docs/AI_OPERATIONS_ARCHITECTURE.md) | Earlier console concept (superseded by AI_OPERATIONS_PORTAL.md) |
| [BUSINESS_PLAN.md](docs/BUSINESS_PLAN.md) | Positioning, offer, commercial model (no invented figures) |

**Design**

| Document | Contents |
| --- | --- |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, contrast, typography, components, motion, accessibility (current) |
| [VISUAL_DIRECTION_V3.md](docs/VISUAL_DIRECTION_V3.md) | Visual direction "Signal" (partly implemented) |
| [UI_AUDIT.md](docs/UI_AUDIT.md) | UI audit before the redesign (historical) |
| [UI_IMPLEMENTATION_REPORT.md](docs/UI_IMPLEMENTATION_REPORT.md) | First premium UI redesign (historical) |
| [UI_REDESIGN_REPORT.md](docs/UI_REDESIGN_REPORT.md) | Premium-editorial redesign (historical; merged as `831fe81`) |

**History and plans**

| Document | Contents |
| --- | --- |
| [PLATFORM_EXPANSION_PLAN.md](docs/PLATFORM_EXPANSION_PLAN.md) | Tools and portal expansion plan with phase checklist |
| [SAAS_EXPANSION_PLAN.md](docs/SAAS_EXPANSION_PLAN.md) | Plan for customer accounts, plans, usage and billing: status matrix, architecture, ADR-52, backlog and open decisions (design only) |
| [IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md) | AI Managed Services + bilingual platform iteration (historical) |

## Important notes

- **No real business data is embedded.** Company details, contact e-mail/phone and legal texts are
  placeholders/drafts and must be completed and legally reviewed before publishing.
- Demo leads created in development are **synthetic** (`source = synthetic_seed`, `@example.com`
  addresses, messages prefixed with `[СИНТЕТИЧНИ ДАННИ]`).
- No e-mails are sent unless SMTP is configured; no AI provider is called unless
  `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` are set.
