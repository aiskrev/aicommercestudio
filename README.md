# A.I. Commerce Studio — website & lead management (V1)

Bulgarian-language marketing website and administration panel for an AI-powered
e-commerce engineering studio. Runs fully on `localhost` with Docker — no domain,
hosting, paid AI model or Shopify credentials are required.

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

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin (credentials are in `.env`: `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`)
- API docs (development only): http://localhost:8000/api/docs

Full step-by-step instructions, troubleshooting and the non-Docker workflow: [docs/INSTALL_WINDOWS.md](docs/INSTALL_WINDOWS.md).

## Tests

```powershell
.\scripts\test.ps1             # API (pytest + ruff), web (typecheck + lint + unit), e2e (Playwright)
.\scripts\test.ps1 -Suite audit  # dependency vulnerability audit (pip-audit, npm audit)
```

The latest executed results are recorded in [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

## Repository layout

```
apps/api/        FastAPI backend, Alembic migrations, CLI (seed, create-admin, set-password, maintenance), tests
apps/web/        Next.js site + admin UI, unit tests; apps/web/e2e = Playwright suite
infra/           production compose override, Caddy example, Linux backup script
scripts/         PowerShell helpers: setup, start, stop, test, backup-db, restore-db, demos
docs/            architecture, schema, API, security, testing, roadmap, business plan, status
docker-compose.yml, docker-compose.dev.yml, .env.example
```

## Documentation

| Document | Contents |
| --- | --- |
| [INSTALL_WINDOWS.md](docs/INSTALL_WINDOWS.md) | Prerequisites, setup, daily commands, troubleshooting |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Components, request flow, i18n, AI layer, decisions |
| [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) | Tables, constraints, migrations, retention |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | All endpoints with examples |
| [TESTING.md](docs/TESTING.md) | Test strategy and how to run every suite |
| [SECURITY.md](docs/SECURITY.md) | Threat model, controls, GDPR, production checklist |
| [ROADMAP.md](docs/ROADMAP.md) | Next versions |
| [BUSINESS_PLAN.md](docs/BUSINESS_PLAN.md) | Positioning, offer, commercial model (no invented figures) |
| [DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens, contrast, typography, components, motion, accessibility |
| [AI_ADVISOR.md](docs/AI_ADVISOR.md) | AI Business Automation Advisor: flow, architecture, safety controls, retention, demo |
| [SEO_IMPLEMENTATION.md](docs/SEO_IMPLEMENTATION.md) | SEO checklist, keyword map (unverified), indexation rules, editorial guidelines, lab performance |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment (prepared, not executed): proxy, DNS, secrets, backups, monitoring, checklist, rollback |
| [VERIFICATION_REPORT.md](docs/VERIFICATION_REPORT.md) | Independent QA/security/DevOps review: what was verified, issues by severity |
| [IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md) | What is done, what was tested, known limitations |

## Important notes

- **No real business data is embedded.** Company details, contact e-mail/phone and legal texts are
  placeholders/drafts and must be completed and legally reviewed before publishing.
- Demo leads created in development are **synthetic** (`source = synthetic_seed`, `@example.com`
  addresses, messages prefixed with `[СИНТЕТИЧНИ ДАННИ]`).
- No e-mails are sent unless SMTP is configured; no AI provider is called unless
  `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` are set.
