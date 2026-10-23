# Security & privacy

## Threat model (V1)

| Asset | Threats | Main controls |
| --- | --- | --- |
| Lead data (personal data) | unauthorised access, leaks via public API, excessive retention | no public read endpoint; admin-only API with server-side sessions; retention job; minimal fields; IP stored only as keyed hash |
| Admin accounts | credential stuffing, brute force, session theft, CSRF | Argon2id; per-IP + per-e-mail rate limits; **persistent account lockout** (survives restarts; unknown e-mails behave identically); generic errors; HttpOnly SameSite cookies; hashed session tokens; CSRF double submit; Origin check; 8 h absolute + 60 min idle expiry; logout and **logout-all**; session list |
| Contact form | spam, bots, floods, oversized payloads | signed timing token, honeypot, link heuristic, per-client and global rate limits, 64 KB body limit, strict schema (`extra=forbid`) |
| Database | SQL injection | SQLAlchemy parameter binding everywhere; LIKE wildcards escaped; tested with injection payloads |
| Browser | XSS, clickjacking, mixed content | React escaping; JSON-LD `<` escaped; CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`); `X-Frame-Options: DENY`; `nosniff`; HSTS at the proxy/API in production |
| Secrets | leakage via Git or frontend | `.env` git-ignored; no secrets in `NEXT_PUBLIC_*`; random generation by `setup.ps1`; production refuses placeholder secrets |
| AI agents (future) | unintended side effects, prompt injection, data exfiltration | approval policy (fail closed), audited decisions, PII redaction before any external call, read-only V1 feature |

## Implemented controls

**Input validation** — Pydantic models with explicit limits, control-character filtering, no-link rules
for names, enum/CHECK constraints in the database, mirrored client-side validation for UX.

**Authentication** — see [ARCHITECTURE.md](ARCHITECTURE.md#authentication). Admins are created only via
CLI/bootstrap; there is no public registration. Password policy: ≥12 chars, mixed case and digits.

**Authorisation** — every `/api/admin/*` route depends on `require_admin`; covered by a parametrised test
listing all 14 admin endpoints.

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

**Dependencies** — exact versions pinned (`requirements.txt`, `package-lock.json`).
`.\scripts\test.ps1 -Suite audit` runs `pip-audit` and `npm audit`; run it before each release.

## GDPR

| Requirement | Implementation |
| --- | --- |
| Data minimisation | only fields needed to answer an inquiry; phone optional; no tracking; IP hashed; the AI advisor asks for no personal data and strips e-mails/phones from the description |
| Transparency | privacy policy draft; acknowledgement required, timestamped, notice version stored |
| Separate marketing consent | optional checkbox, stored separately with timestamp; never required |
| Retention | `LEAD_RETENTION_DAYS` (730), `AUDIT_RETENTION_DAYS` (1095), `ADVISOR_RETENTION_DAYS` (30, unlinked assessments); `app.cli maintenance` |
| Erasure | admin "Изтрий запитването" deletes lead + notes; audit keeps no personal data |
| Access control | individual admin accounts, sessions, audit trail |
| Cookies | only strictly necessary admin cookies; no consent banner needed; documented on `/biskvitki` |
| Third parties | none on public pages (verified by e2e); e-mail and AI providers disabled by default |
| Processors | when enabling SMTP or an AI provider: sign a DPA, list them in the privacy policy, check data transfers |

Still required from the business (not technical): register the controller details, complete and
legally review the privacy policy/terms, maintain records of processing, define an incident procedure.

## Production checklist

- [ ] `APP_ENV=production`, unique `SECRET_KEY` (≥32 random chars), strong DB password, `COOKIE_SECURE=true`
- [ ] `SITE_URL` and `CORS_ORIGINS` set to the real `https://` domain; rebuild the web image
- [ ] Use `infra/docker-compose.prod.yml`; put Caddy (or similar) in front with TLS and HSTS
- [ ] Secrets supplied by the host/secret manager, `.env` not copied into images (already in `.dockerignore`)
- [ ] `SEED_SAMPLE_DATA=false`; remove or rotate the bootstrap admin password after first login
- [ ] Schedule `python -m app.cli maintenance` daily
- [ ] Encrypted, tested PostgreSQL backups
- [ ] Run `.\scripts\test.ps1` and `-Suite audit`; review results
- [ ] Legal texts completed and reviewed; contact details verified
- [ ] For multiple API instances: move rate limiting to Redis

## Reporting

Security issues should be reported privately to the site owner ([security contact to be defined]).
