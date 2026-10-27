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
| [INFORMATION_ARCHITECTURE.md](docs/INFORMATION_ARCHITECTURE.md) | Navigation, services, tools, conversion flows |
| [INTERNATIONALIZATION.md](docs/INTERNATIONALIZATION.md) | BG/EN URLs, switcher, cookie, translations, SEO, API and admin languages |
| [SEO_IMPLEMENTATION.md](docs/SEO_IMPLEMENTATION.md) | SEO checklist, keyword map (unverified), indexation rules, editorial guidelines |
| [AI_ADVISOR.md](docs/AI_ADVISOR.md) | AI Business Automation Advisor: flow, architecture, safety controls, retention, demo |
| [TOOLS_PLATFORM.md](docs/TOOLS_PLATFORM.md) | Tool registry, flags, shared UI, analytics, AI team model |
| [READINESS_REPORTS.md](docs/READINESS_REPORTS.md) | AI readiness: PDF report, submissions, admin view |
| [TEAM_CONFIGURATOR.md](docs/TEAM_CONFIGURATOR.md) | Build your AI team: costs, saved links, PDF plan, consultations |
| [ROI_AND_FINDER.md](docs/ROI_AND_FINDER.md) | ROI calculator and Automation Opportunity Finder: formulas and policy |
| [SOLUTION_BUILDER.md](docs/SOLUTION_BUILDER.md) | AI Solution Builder and AI Agent Library |
| [AI_MANAGED_SERVICES.md](docs/AI_MANAGED_SERVICES.md) | AI Managed Services: page, packages, intake form, storage, admin, limits |
| [AI_MANAGED_SERVICES_PRICING.md](docs/AI_MANAGED_SERVICES_PRICING.md) | Internal, hypothetical pricing guidance (not published) |
| [AI_OPERATIONS_PORTAL.md](docs/AI_OPERATIONS_PORTAL.md) | Portal architecture (data model, API, tenancy, RBAC, telemetry, roadmap) and the staff-only scaffold |
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
| [IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md) | AI Managed Services + bilingual platform iteration (historical) |

## Important notes

- **No real business data is embedded.** Company details, contact e-mail/phone and legal texts are
  placeholders/drafts and must be completed and legally reviewed before publishing.
- Demo leads created in development are **synthetic** (`source = synthetic_seed`, `@example.com`
  addresses, messages prefixed with `[СИНТЕТИЧНИ ДАННИ]`).
- No e-mails are sent unless SMTP is configured; no AI provider is called unless
  `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` are set.
