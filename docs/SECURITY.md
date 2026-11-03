# Security & privacy

## Threat model

Updated 2026-10-27 to cover the interactive tools and the AI operations scaffold, and on 2026-11-03 for
the V2 surfaces (row-level security, the client portal, the opportunity workflow). The audit of the
whole platform with findings by severity is [INTEGRATION_AUDIT_V2.md](INTEGRATION_AUDIT_V2.md).

| Asset | Threats | Main controls |
| --- | --- | --- |
| Lead data (personal data) | unauthorised access, leaks via public API, excessive retention | no public read endpoint; admin-only API with server-side sessions; retention job; minimal fields; IP stored only as keyed hash |
| Admin accounts | credential stuffing, brute force, session theft, CSRF | Argon2id; per-IP + per-e-mail rate limits; **persistent account lockout** (survives restarts; unknown e-mails behave identically); generic errors; HttpOnly SameSite cookies; hashed session tokens; CSRF double submit; Origin check; 8 h absolute + 60 min idle expiry; logout and **logout-all**; session list |
| Contact form | spam, bots, floods, oversized payloads | signed timing token, honeypot, link heuristic, per-client and global rate limits, 64 KB body limit, strict schema (`extra=forbid`) |
| Database | SQL injection | SQLAlchemy parameter binding everywhere; LIKE wildcards escaped; tested with injection payloads |
| Browser | XSS, clickjacking, mixed content | React escaping; JSON-LD `<` escaped; CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`); `X-Frame-Options: DENY`; `nosniff`; HSTS at the proxy/API in production |
| Secrets | leakage via Git or frontend | `.env` git-ignored; no secrets in `NEXT_PUBLIC_*`; random generation by `setup.ps1`; production refuses placeholder secrets |
| AI agents (future) | unintended side effects, prompt injection, data exfiltration | approval policy (fail closed), audited decisions, PII redaction before any external call, read-only V1 feature |
| Interactive tools and their data | personal data or secrets in tool payloads, enumeration of saved links, abuse of PDF generation | ROI, Finder, Solution Builder and Agent Library run in the browser and send nothing. Readiness and team payloads are enumerated values (strict schemas). Saved team links store only a SHA-256 token hash, sent in a POST body, never in a URL. Every public POST is rate-limited. Share codes are versioned and strictly decoded. |
| Tenant data (AI operations scaffold) | cross-tenant read/write, tenant enumeration, privilege escalation | membership resolved per request; foreign organisation → 404 (same as missing); queries only through `scoped()`; composite FK workspace ↔ organisation; RBAC matrix with rank rules and last-owner protection; audited writes. **Row-level security** on every tenant table under the NOLOGIN, NOBYPASSRLS role `acs_app_runtime`, switched to per transaction (`SET LOCAL ROLE`); composite tenant foreign keys on every child row; immutable registry versions and append-only timelines (triggers). Residual risk: the application still *connects* as the schema owner, so code outside `require()` is not under RLS — a separate login role is a release prerequisite (AI_OPERATIONS_PORTAL.md §11a). |
| Client portal (off by default) | account takeover, cross-tenant reads, enumeration, CSRF, replayed codes, exposure of prompts or internal notes | separate identities and cookies; invitation tokens hashed, single-use, in the URL fragment; password + TOTP (derived secret, ±1 step, used steps refused); lockout and identical errors; 8 h / 30 min sessions; CSRF on every write; tenant only from the session under RLS; GET-only data routes (others 405); no prompt, tool, provider or internal-note fields in responses; every view audited. Switched off until explicit approval (CLIENT_PORTAL.md). |
| Opportunity and proposal records (personal data, commercial drafts) | stakeholder data beyond what the client gave, fabricated commercial terms, unreviewed AI output sent to a client, silent edits of history, over-retention | admin-only routes with CSRF; stakeholders only with `provided_in` and an explicit confirmation; plain-text, size-bounded sections; generated drafts deterministic with placeholder commercial terms; approval blocked until a person completes them, warnings acknowledged explicitly; append-only versions (trigger); audit without free text or names; cascade with the lead for retention and erasure; no e-mail or CRM integration; the Ops runtime role has no access to lead tables (migration 0014). |

## Implemented controls

**Input validation** — Pydantic models with explicit limits, control-character filtering, no-link rules
for names, enum/CHECK constraints in the database, mirrored client-side validation for UX.

**Authentication** — see [ARCHITECTURE.md](ARCHITECTURE.md#authentication). Admins are created only via
CLI/bootstrap; there is no public registration. Password policy: ≥12 chars, mixed case and digits.

**Authorisation** — staff have a role (`admin_users.role`): `admin`, `editor` or `viewer`. Every
`/api/admin/*` route outside the catalogue depends on `require_admin`, which requires the `admin` role
(403 `forbidden_role` otherwise). The session endpoints accept every role. The catalogue
(`/api/admin/catalogue/*`) is open by role: `viewer` reads, `editor` also writes drafts, `admin` also
publishes, archives, restores and deletes never-published drafts (`tests/test_catalogue_api.py`, `tests/test_catalogue_admin_extras.py`). Roles are changed by administrators only (`/api/admin/staff`): nobody can change their own role, the last active administrator cannot be demoted, and a change revokes the person's sessions. Catalogue texts are plain text:
markup, HTML entities, Markdown links, script URLs and invisible control or bidi characters are
rejected, not escaped (`app/catalogue/text.py`). The public catalogue API serves publication
snapshots only, never working copies. In addition, every `/api/admin/*` route depends on the staff session. A parametrised test lists 18
of them (`tests/test_admin_auth.py::PROTECTED`). The two report downloads have their own 401 tests
(`test_readiness.py`, `test_team.py`). Every `/api/ops/*` route additionally requires membership in
the organisation and a permission from `app/ops/rbac.py`, and is covered by authorisation and
tenant-isolation tests (`tests/test_ops_portal.py`).

**Assessment engine** — scores are computed only on the server, by versioned pure functions over
typed definitions loaded from the repository (no `eval`, no rules from the database, no LLM in any
score). Requests carry answers only: unknown fields such as `weights` are rejected, answer values are
limited to option keys, booleans, numbers and short lists, and requests are rate limited per client
and globally (saving has its own lower limit). Anonymous scoring stores nothing; an opt-in saved
result holds no personal data or free text, is reachable only with a 256-bit token whose SHA-256
hash is stored, can be deleted by the visitor with that token, and expires after
`ASSESSMENT_RETENTION_DAYS` (purged by `app.cli maintenance`). A saved result is re-scored with its own
definition version before it is shown; a mismatch is logged and the result is not served.

**Catalogue revalidation** — `POST /api/catalogue-revalidate` (web) only marks cached catalogue
data stale. It requires `X-Revalidate-Secret` equal to `CATALOGUE_REVALIDATE_SECRET` (compared in
constant time on SHA-256 digests), answers 404 when the variable is unset or shorter than 16
characters, and is `no-store`. Public catalogue pages make no API call for malformed slugs or for
slugs that are not in the cached published list, so random URLs cannot multiply API requests.
Only published entries reach the pages; catalogue texts are rendered as plain React text.

**Public company contact** — the phone and e-mail shown on the site are approved business data in
`apps/web/src/lib/company.ts`, separate from lead e-mail fields, admin accounts, synthetic seed data
and SMTP settings. No personal address is published, no SMTP credentials are configured, and the
site sends no e-mail to that mailbox. The planned mailbox domain is not active yet.

**CORS** — explicit allow-list (`CORS_ORIGINS`), credentials only for listed origins; `*` refused in production.

**Rate limiting** — sliding window, in memory. Behind the production reverse proxy the client IP is
taken from `X-Forwarded-For` (right-most entry), which Caddy overwrites with the real address. **Do not
expose the web container directly to the internet** — without the proxy, clients can choose their own
`X-Forwarded-For` value (the global contact limit still caps abuse).

**Logging & audit** — JSON logs with request IDs (returned to clients in every error as `request_id`), no request bodies, no personal data. Access to a lead's personal data is audited (`lead.viewed`). `audit_logs`
records logins (successful/failed — failed attempts store only a hash of the e-mail), lead creation,
status changes, notes, deletions, AI triage and AI action decisions.

**Secure defaults** — `APP_ENV=production` forces secure cookies, disables API docs, rejects weak
config. Containers run as non-root users. DB and API ports are bound to `127.0.0.1` locally and not
published at all in the production override.


**AI Business Automation Advisor** — public, anonymous, no tools and no credentials for the model.
Input: PII and links removed, prompt delimiters neutralised, injection phrasing flagged. Output:
schema-validated, links and financial promises removed, human approval forced for side-effect steps.
Rate limited per client and globally; logs carry metadata only. Details: [AI_ADVISOR.md](AI_ADVISOR.md).
The Anthropic API key is read only by the API container and never reaches the browser.

**AI Managed Services intake** — the form collects descriptive information only. A visible warning
asks visitors not to send API keys, passwords, access tokens, customer records, production database
credentials or confidential documents; the client (`looksLikeSecret`) and the API
(`looks_like_secret`, 422 `secrets`) reject text that looks like a credential in the message,
provider and notes fields. Details are validated by a strict model (`extra="forbid"`), stored as
JSONB, re-validated when read and never exposed publicly. The public flow never connects to a
client's AI system. Principle for future operations work: model output must never bypass
deterministic authorisation or business rules ([AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md)).

**Interactive tools** — details in [TOOLS_PLATFORM.md](TOOLS_PLATFORM.md),
[READINESS_REPORTS.md](READINESS_REPORTS.md), [TEAM_CONFIGURATOR.md](TEAM_CONFIGURATOR.md),
[ROI_AND_FINDER.md](ROI_AND_FINDER.md) and [SOLUTION_BUILDER.md](SOLUTION_BUILDER.md).

* No tool has a field for keys, tokens or passwords. The Solution Builder test asserts this.
* Analytics emits only allow-listed, non-personal fields, and no sink is attached.
* Optional submissions require consent.
* Readiness and team leads follow the lead retention policy; unlinked saved configurations expire.
* **Open:** the draft privacy policy (`content/{bg,en}/legal.ts`) mentions only the advisor. It
  must also describe readiness submissions and saved team configurations before launch.

**AI operations scaffold (staff only)**

* Organisation-scoped API under `/api/ops` behind the admin session and CSRF, with roles owner,
  admin, operator, reviewer and viewer.
* Secret-like text and unknown fields are rejected in the registry.
* Demo data is refused in production.
* Design, isolation layers and the RBAC matrix: [AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md).
* Requirements before any client login (RLS with a restricted DB role, client accounts with MFA,
  DPA): [IMPLEMENTATION_DEPENDENCIES_V2.md](IMPLEMENTATION_DEPENDENCIES_V2.md).

**Locale handling** — the language is an allow-list (`bg`, `en`); unknown values in payloads are
rejected (422), in `Accept-Language` they fall back to `bg`. The `acs_locale` preference cookie
contains only `bg`/`en`, is validated before use and never reflected unescaped; locale redirects
build paths from fixed segment maps (no open redirect).

**Dependencies** — exact versions pinned (`requirements.txt`, `package-lock.json`).
`.\scripts\test.ps1 -Suite audit` runs `pip-audit` and `npm audit`; run it before each release.

## GDPR

| Requirement | Implementation |
| --- | --- |
| Data minimisation | only fields needed to answer an inquiry; phone optional; no tracking; IP hashed; the AI advisor asks for no personal data and strips e-mails/phones from the description; AI Managed inquiries collect descriptive system information only, never credentials or customer records |
| Transparency | privacy policy draft; acknowledgement required, timestamped, notice version stored |
| Separate marketing consent | optional checkbox, stored separately with timestamp; never required |
| Retention | `LEAD_RETENTION_DAYS` (730), `AUDIT_RETENTION_DAYS` (1095), `ADVISOR_RETENTION_DAYS` (30, unlinked assessments), `READINESS_RETENTION_DAYS` (365, readiness leads), `TEAM_LEAD_RETENTION_DAYS` (365, team consultation leads), `TEAM_CONFIGURATION_RETENTION_DAYS` (90, unlinked saved team links); `app.cli maintenance`. Ops tenancy data follows the contract lifecycle (no automatic purge). |
| Erasure | admin "Изтрий запитването" deletes lead + notes; audit keeps no personal data |
| Access control | individual admin accounts, sessions, audit trail |
| Cookies | strictly necessary admin cookies, the functional `acs_locale` language preference (set only on an explicit switch) and `acs_cookie_notice` (remembers that the notice was closed, 12 months). Since 2026-11-03 an informational cookie notice (`components/layout/CookieNotice.tsx`, BG/EN, rendered on the client so pages stay static) links to the cookie information, which is final after legal review and indexed (`COOKIE_POLICY_IS_DRAFT = false`). No optional cookies exist, so the notice offers no consent choice |
| Third parties | none on public pages (verified by e2e); e-mail and AI providers disabled by default |
| Processors | when enabling SMTP or an AI provider: sign a DPA, list them in the privacy policy, check data transfers |

Still required from the business (not technical): register the controller details, complete and
legally review the privacy policy/terms, maintain records of processing, define an incident procedure.

## Production checklist

Full procedure, rollback and monitoring: [DEPLOYMENT.md](DEPLOYMENT.md). The API refuses to start in
production when the items marked (enforced) are wrong.


- [ ] `APP_ENV=production`, unique `SECRET_KEY` (≥32 random chars, enforced), strong DB password, `COOKIE_SECURE=true` (enforced)
- [ ] `SITE_URL` and `CORS_ORIGINS` set to the real `https://` domain (enforced); rebuild the web image
- [ ] Use `infra/docker-compose.prod.yml`; put Caddy (or similar) in front with TLS and HSTS
- [ ] Secrets supplied by the host/secret manager, `.env` not copied into images (already in `.dockerignore`)
- [ ] `SEED_SAMPLE_DATA=false` (enforced); create admins with `create-admin` and keep `ADMIN_BOOTSTRAP_PASSWORD` empty
- [ ] Schedule `python -m app.cli maintenance` daily
- [ ] Schedule `python -m app.cli ops-retention` daily (execution records and evaluation results per organisation policy)
- [ ] Migration `0013` creates the NOLOGIN role `acs_app_runtime`: the migrating user needs `CREATEROLE` once (or a DBA creates the role first); the application role must not be a superuser or have `BYPASSRLS`
- [ ] Keep `CLIENT_PORTAL_ENABLED=false` until the portal release prerequisites are met and approved (CLIENT_PORTAL.md)
- [ ] Encrypted, tested PostgreSQL backups (`infra/backup-db.sh`, restore drill monthly)
- [ ] Run `.\scripts\test.ps1` and `-Suite audit`; review results
- [ ] Legal texts completed and reviewed; contact details verified
- [ ] For multiple API instances: move rate limiting to Redis

## Reporting

Security issues should be reported privately to the site owner ([security contact to be defined]).
