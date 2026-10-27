# Implementation report — AI Managed Services & bilingual platform (BG/EN)

> **Historical (status 2026-10-27).** This report covers the AI Managed Services and bilingual
> iteration of 2026-10-24. The current state and test results are in
> [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) and
> [PLATFORM_BASELINE_AUDIT.md](PLATFORM_BASELINE_AUDIT.md).

Date: 2026-10-24. Environment: Windows 11 Pro, Docker Desktop, local stack only (nothing deployed).

## 1. Summary

* **AI Managed Services** added as the 7th primary service: dedicated 13-section page in both
  languages, three packages (AI Monitor / AI Care / AI Optimize) with “custom quote” only, no SLA /
  24-7 / unlimited promises, conceptual operations diagram, intake form that collects descriptive
  AI-system information and rejects credentials, storage in the existing lead pipeline
  (migration `0004`), admin display, filters and audit.
* **Full Bulgarian/English platform**: locale-prefixed URLs with translated segments and slugs,
  predictable root redirect (default `bg`, explicit cookie preference only), BG | EN switcher on
  desktop and mobile with equivalent-page mapping, complete English content and UI, international
  SEO (canonical, hreflang + x-default, OG locale, localized JSON-LD, bilingual sitemap), localized
  API messages (`Accept-Language`), lead language stored and shown, admin panel in both languages,
  bilingual AI advisor (English demo templates, output language for the real provider).

## 2. Structure

One Next.js app (`apps/web`) and one FastAPI service (`apps/api`) — no second frontend or backend.
See [INTERNATIONALIZATION.md](INTERNATIONALIZATION.md) and [AI_MANAGED_SERVICES.md](AI_MANAGED_SERVICES.md).

### New pages

* `/bg/uslugi/ai-managed-services`, `/en/services/ai-managed-services` (new service page).
* The complete English site under `/en/...` (home, services + 8 service pages, AI solutions,
  industries, process, about, contact, insights + 6 articles + topics, advisor, legal drafts, 404).

### Differences from the requested URLs (documented, intentional)

| Requested example | Actual | Reason |
| --- | --- | --- |
| `/bg/uslugi/seo`, `/en/services/seo` | `/bg/uslugi/seo-optimizatsiya`, `/en/services/seo-optimization` | existing, already indexed SEO slugs were kept |
| `http://localhost:8000/docs` | `http://localhost:8000/api/docs` | existing API docs path (disabled in production) |
| `D:\Projects\AI-Commerce-Studio` | working copy `D:\Projects\Site` | INSTALL_WINDOWS.md §2 covers cloning to the requested path |
| switcher without full reload | full navigation on language change | `<html lang>` lives in the per-locale root layout; Next.js reloads when the root layout changes |

## 3. Added files

| Area | Files |
| --- | --- |
| API | `app/i18n.py`; `app/ai/advisor_mock_en.py`; `app/ai/advisor_template_base.py`; `alembic/versions/20261026_0004_ai_managed_locale.py` |
| API tests | `tests/test_ai_managed_and_locale.py`; `tests/test_advisor_english.py` |
| Web pages/components | `app/[locale]/uslugi/ai-managed-services/page.tsx`; `components/contact/AiManagedFields.tsx`, `FormField.tsx`; `components/layout/LanguageSwitcher.tsx`; `components/sections/AiOpsDiagram.tsx`; `components/admin/AdminI18n.tsx`, `AdminLanguage.tsx` |
| Web content/i18n | `content/bg/ai-managed.ts`; `content/en/*` (11 files); `i18n/dictionaries/en.ts`; `i18n/admin/{bg,en,index}.ts`; `lib/admin-locale.ts`; `lib/contact-form-props.ts` |
| Web tests | `lib/i18n.test.ts`; `e2e/tests/i18n.spec.ts` |
| Docs | `AI_MANAGED_SERVICES.md`, `AI_MANAGED_SERVICES_PRICING.md` (internal, hypothetical), `AI_OPERATIONS_ARCHITECTURE.md`, `INTERNATIONALIZATION.md`, this report |

## 4. Modified files (main ones)

* API: `models.py` (`ServiceKey.AI_MANAGED`, `LeadLocale`, `locale`, `service_details`), `schemas.py`
  (`AiManagedDetails`, `locale`, secret screening, custom error types), `main.py` + `middleware.py`
  (localized errors), `services/leads.py` (locale, details, filter, `by_locale`, audit),
  `routers/admin.py` (locale filter, AI details), `routers/public.py` (localized success),
  `routers/advisor.py` (localized status), `advisor/{schemas,prompt,safety,service}.py` (locale),
  `ai/{mock,advisor_mock,anthropic_provider}.py`, `notifications.py`.
* Web: `i18n/config.ts`, `lib/locale-routing.ts`, `proxy.ts`, `lib/seo.ts`, `app/sitemap.ts`,
  `content/index.ts` and `content/types.ts`, all `[locale]` pages, header/footer/layout, contact form,
  advisor, every admin page and component, `lib/admin-{api,labels,types}.ts`, `lib/use-admin-data.ts`,
  existing unit and e2e tests (new URLs and props).
* Docs: README, INSTALL_WINDOWS, ARCHITECTURE, API_REFERENCE, DATABASE_SCHEMA, SECURITY, TESTING,
  ROADMAP, SEO_IMPLEMENTATION, IMPLEMENTATION_STATUS, `openapi.json` (regenerated).

## 5. Database migration `0004`

Backward compatible, no data loss: adds `ai_managed` to the service CHECK constraints, `leads.locale`
(NOT NULL, server default `bg`, CHECK, index) and `leads.service_details` (JSONB, nullable). Existing
rows receive `locale = 'bg'`. Downgrade maps `ai_managed` leads to `other` instead of deleting them.
Tested: `alembic check`, full upgrade/downgrade round trip, data written under `0003` survives the
upgrade, downgrade re-categorisation.

## 6. API changes

| Endpoint | Change |
| --- | --- |
| all | `Accept-Language: bg|en` selects the language of `detail` and field messages (fallback `bg`); codes unchanged |
| `POST /api/public/leads`, `/quote-requests` | `locale` (bg/en), `service = ai_managed`, `ai_managed` object (only for that service), credential screening, localized success message |
| `GET /api/public/advisor/status` | localized disclaimer |
| `POST /api/public/advisor/assessments` | `locale` — output language |
| `GET /api/admin/leads` | `locale` filter; items include `locale` |
| `GET /api/admin/leads/{id}` | `locale`, `ai_managed` |
| `GET /api/admin/dashboard/stats` | `by_locale` |

No new endpoints; no public endpoint exposes stored lead data.

## 7. Translation coverage

All public pages, navigation, footer, forms (labels, hints, placeholders, validation, success,
errors), accessibility labels, 404/error pages, legal drafts, articles (6), service pages (8),
AI advisor (UI, results, API messages, demo templates), AI Managed Services page, admin login,
dashboard, leads, lead detail, AI approvals, activity, account. Enforced by types and tests (same
keys, no empty strings, no Cyrillic in English except the language name “Български”).

Intentionally Bulgarian: the internal team notification e-mail and the rule-based (mock) lead
triage text; the admin shows a note about the latter when in English.

## 8. Test evidence (executed on 2026-10-24)

| Suite | Command | Result |
| --- | --- | --- |
| API tests | `.\scripts\test.ps1` → `docker compose --profile test run --rm --build api-tests` | **245 passed** |
| API lint | `ruff check --no-cache .` | **All checks passed** |
| Web typecheck + lint + unit | `docker compose --profile test run --rm --build web-tests` (typegen, `tsc`, `eslint`, `vitest`) | **0 type errors, 0 lint findings, 135 passed (9 files)** |
| Production build | `docker compose up --build -d` (Next.js production build in the web image) | **succeeded**, stack healthy |
| End-to-end | `docker compose --profile test run --rm --build e2e` | **44 passed** (desktop Chromium + Pixel 7), final full run |
| Dependency audit | `.\scripts\test.ps1 -Suite audit` | pip-audit: **no known vulnerabilities**; npm audit: **0 vulnerabilities** |
| Visual check | in-app browser, `/en/services/ai-managed-services` at 1280 px and 375 px | layout correct; no horizontal overflow (`scrollWidth = clientWidth = 375`) |

**Failed tests in the final runs: none.** Failures seen earlier and fixed before the final runs are
listed below.

Fixes made during verification: English article meta title over 70 characters; the advisor status
request did not send the page language; admin language test clicked the hidden mobile switch; the
new e2e spec shared the per-IP rate-limit bucket with the rest of the suite (now uses its own client
address, like each run already does).

## 9. Outstanding issues / not verified

* The Anthropic provider was not called (no API key) — the English output instruction is covered by
  unit tests with a fake client only.
* SMTP not configured; customer acknowledgement templates exist but are not sent by design.
* English texts were written for this release but have not been reviewed by a native editor or a
  lawyer (legal pages remain drafts in both languages, `noindex`).
* English keyword map volumes are unverified hypotheses.
* No AI Operations Console exists; the service is operated manually for now.
* Admin language follows the explicit preference cookie; an administrator who never clicked a
  switcher sees Bulgarian.

## 10. Windows PowerShell commands

```powershell
cd D:\Projects\Site
.\scripts\start.ps1                 # build + start db, api, web (migration 0004 runs on API start)
.\scripts\test.ps1                  # API + web + e2e
.\scripts\test.ps1 -Suite audit     # dependency audit
docker compose exec api alembic current   # should print 0004 (head)
```

## 11. Local URLs

* http://localhost:3000 → `/bg` (or `/en` after choosing English)
* http://localhost:3000/bg · http://localhost:3000/en
* http://localhost:3000/bg/uslugi/ai-managed-services · http://localhost:3000/en/services/ai-managed-services
* http://localhost:3000/en/contact?service=ai_managed
* http://localhost:3000/admin
* http://localhost:8000/api/docs (development only)

## 12. Archive

Not applicable — the work stays in the Git working copy; nothing was committed, pushed or deployed.

## 13. Next iteration

Multi-tenant **AI Operations Console** — see [AI_OPERATIONS_ARCHITECTURE.md](AI_OPERATIONS_ARCHITECTURE.md)
and [ROADMAP.md](ROADMAP.md).
