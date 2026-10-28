# Security & privacy

## Threat model

Updated 2026-10-27 to cover the interactive tools and the AI operations scaffold.

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
| Tenant data (AI operations scaffold) | cross-tenant read/write, tenant enumeration, privilege escalation | membership resolved per request; foreign organisation → 404 (same as missing); queries only through `scoped()`; composite FK workspace ↔ organisation; RBAC matrix with rank rules and last-owner protection; audited writes. **RLS not yet enabled** (the runtime DB role is the schema owner). |

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
| Cookies | strictly necessary admin cookies plus the functional `acs_locale` language preference (set only on an explicit switch); no consent banner needed; documented on `/bg/biskvitki` and `/en/cookies` |
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
- [ ] Encrypted, tested PostgreSQL backups (`infra/backup-db.sh`, restore drill monthly)
- [ ] Run `.\scripts\test.ps1` and `-Suite audit`; review results
- [ ] Legal texts completed and reviewed; contact details verified
- [ ] For multiple API instances: move rate limiting to Redis

## Reporting

Security issues should be reported privately to the site owner ([security contact to be defined]).
