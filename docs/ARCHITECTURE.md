# Architecture

## Overview

```
Browser ──HTTPS──▶ Reverse proxy (production: Caddy) ──▶ web: Next.js (port 3000)
                                                          │  pages (SSG), admin UI, /api/* proxy
                                                          ▼
                                                     api: FastAPI (port 8000, internal)
                                                          │  SQLAlchemy 2 / psycopg 3
                                                          ▼
                                                     db: PostgreSQL 17 (volume pgdata)
```

* The **browser only talks to the web origin**. `apps/web/src/app/api/[...path]/route.ts` forwards
  `/api/*` to `API_INTERNAL_URL` at runtime. Session cookies are therefore first-party, CORS is not
  needed for normal use, and the same web image works in every environment.
* Public pages are **statically generated** at build time (32 routes) and served by the Next.js
  standalone server. Only admin pages, `/api/*` and the 404 route are dynamic.
* The API is stateless apart from PostgreSQL and an in-memory rate limiter (single instance in V1).

## Frontend (`apps/web`)

| Area | Location |
| --- | --- |
| Locale routing | `src/proxy.ts` (Next 16 "proxy", formerly middleware) + pure logic in `src/lib/locale-routing.ts` |
| Public pages | `src/app/[locale]/…` — home, services, service detail, AI solutions, industries, about, process, contact, articles, legal |
| Admin | `src/app/admin/login`, `src/app/admin/(protected)/…` (server-verified session in the group layout); strings in `src/i18n/admin/{bg,en}.ts` via `useAdminI18n()` |
| Content | `src/content/{bg,en}/*.ts` (typed; English typed against the Bulgarian shape), accessed through `getContent(locale)` |
| UI strings | `src/i18n/dictionaries/{bg,en}.ts` via `getDictionary(locale)` |
| AI Managed Services | `src/app/[locale]/uslugi/ai-managed-services/page.tsx`, `src/components/contact/AiManagedFields.tsx`, `src/components/sections/AiOpsDiagram.tsx` |
| SEO | `src/lib/seo.ts` (metadata, canonical, Open Graph, JSON-LD), `app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx` |
| Design system | Tailwind 4 tokens in `src/app/globals.css`, primitives in `src/components/ui`, in-house SVG icons |

### Internationalisation

All pages live under `app/[locale]` and every public URL is locale-prefixed: `/bg/...` (default)
and `/en/...` with translated segments and slugs (`/en/services/seo-optimization`). The proxy
redirects `/` to the explicitly chosen language (cookie `acs_locale`) or `/bg`, permanently
redirects legacy unprefixed URLs to `/bg/...`, and rewrites English segments to the internal
Bulgarian-named folders. The root layout per locale sets `<html lang>`. Details, URL table, switcher,
SEO and API languages: [INTERNATIONALIZATION.md](INTERNATIONALIZATION.md).

## Backend (`apps/api`)

| Module | Responsibility |
| --- | --- |
| `app/main.py` | App factory, middleware, exception handlers (Bulgarian validation messages) |
| `app/config.py` | `pydantic-settings`; refuses unsafe production configuration |
| `app/models.py` | SQLAlchemy models (mirrored 1:1 by the Alembic migration — verified by `alembic check` in tests) |
| `app/routers/` | `health`, `public` (form token, lead submit), `admin_auth`, `admin` |
| `app/services/` | Business logic (leads, retention, AI approvals) — independent of HTTP |
| `app/deps.py` | Client IP, rate limiting, admin session + CSRF dependency |
| `app/middleware.py` | Request ID, JSON access log, security headers, origin check, body-size limit |
| `app/ai/` | Provider abstraction, mock provider, Anthropic provider, approval policy |
| `app/integrations.py` | Contracts + configuration status for Shopify / WooCommerce / CRM / SEO / webhooks |
| `app/notifications.py` | SMTP notification (disabled unless configured; e-mail contains no personal data) |
| `app/cli.py` | `seed`, `create-admin`, `maintenance` |

### Request flow: contact form

1. The form loads and fetches a signed timing token (`GET /api/public/form-token`).
2. The client validates (same rules as the server), then `POST /api/public/leads`.
3. The API applies per-client and global rate limits, then Pydantic validation, the honeypot,
   the token signature/age and a link-spam heuristic.
4. The lead is stored with privacy acknowledgement timestamp, notice version, separate marketing
   consent and a keyed hash of the IP (never the raw IP). An audit entry is written.
5. A background task notifies the team by e-mail if SMTP is configured; otherwise it only logs.

### Authentication

* Argon2id password hashes; constant-time behaviour for unknown e-mails.
* Opaque session token (32 random bytes) in an **HttpOnly, SameSite=Lax** cookie; only its SHA-256
  is stored (`admin_sessions`). Sessions expire after `SESSION_TTL_HOURS` and are revocable.
* Double-submit **CSRF** token (readable cookie + `X-CSRF-Token` header, hash stored server-side)
  required for every state-changing admin request; plus an Origin check on unsafe methods.
* Next.js protects `/admin/*` twice: the proxy redirects requests without a cookie, and the
  `(protected)` layout verifies the session against the API on every render. The API remains the
  authority — every admin endpoint depends on `require_admin`.

## AI layer

```
AIProvider (protocol) ── MockProvider (default, deterministic, offline)
                      └─ AnthropicProvider (official SDK, structured JSON output,
                                            server-side refusal fallback, PII redaction)
policy.evaluate(action) → risk + requires_approval   (unknown actions fail closed)
services.ai_actions.propose_action / decide           → ai_action_requests + audit_logs
```

* AI is used for two **text-only** features: lead triage in the admin panel (classification,
  priority, suggested next step — low risk under the policy and audited) and the public
  **AI Business Automation Advisor** (`/ai-automation-advisor`, `AIProvider.assess_automation`,
  `app/advisor/`). The advisor runs in a clearly labelled demo mode without an API key; see
  [AI_ADVISOR.md](AI_ADVISOR.md) for its validation, injection defences, retention and limits.
* Any future action that sends messages, changes products/prices/orders or touches sensitive data
  must be proposed as an `AIActionRequest`, approved by an administrator in **Admin → AI одобрения**
  and only then executed. V1 records decisions but ships no executors.
* Only the selected service and a redacted message (e-mails/phones removed) are sent to an external
  model; names and company names are never sent.

## Configuration & environments

| File | Purpose |
| --- | --- |
| `.env` (from `.env.example`) | All configuration; never committed |
| `docker-compose.yml` | Local production-like stack + `test` profile (`api-tests`, `web-tests`, `e2e`) |
| `docker-compose.dev.yml` | Hot reload: bind mounts, polling watchers |
| `infra/docker-compose.prod.yml` | Production override: no published DB/API ports, docs off, no seed data |
| `infra/reverse-proxy/Caddyfile.example` | TLS termination, HSTS, trusted `X-Forwarded-For` |

`APP_ENV=production` makes the API refuse to start with placeholder secrets, wildcard CORS,
insecure cookies or seed data enabled.

## Key decisions

| Decision | Reason |
| --- | --- |
| Same-origin proxy route instead of `next.config` rewrites | Rewrites are fixed at build time; the route reads `API_INTERNAL_URL` at runtime and controls forwarded headers. |
| Server-side sessions instead of JWT | Immediate revocation, no token in JS, simple CSRF model. |
| Synchronous SQLAlchemy | Simpler, well-understood; FastAPI runs sync endpoints in a thread pool. Adequate for V1 traffic. |
| In-memory rate limiter | No extra infrastructure for V1. Replace storage with Redis when running more than one API instance. |
| Content in typed TS modules (not a CMS) | Fast static pages, type-checked, versioned. A headless CMS can replace `getContent` later. |
| No analytics or third-party scripts | Avoids consent requirements; nothing non-essential is loaded (verified by an e2e test). |
