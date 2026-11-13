# Commercial expansion: staging runbook, Cloudflare and Hetzner checklist, release gates (Phase 17)

Commercial expansion, Phase 17. **This is a document, not a change.** Nothing here was done on any server, in Cloudflare or in
Hetzner; no secret, token or key appears in it. It tells the owner (or a person acting for the owner) how to put the work of
Phases 01 to 16 on a **staging** server safely, in what order to switch features on, what to check at each step, what to watch
at the edge and on the host, how to go back, and which gates still stand between the work and production. The older
documents still apply: [DEPLOYMENT.md](DEPLOYMENT.md) (target architecture, backups, rollback), [ACCOUNTS_RELEASE_CHECKLIST.md](ACCOUNTS_RELEASE_CHECKLIST.md)
(gates G0 to G7 for accounts and payment), [SECURITY.md](SECURITY.md).

## 1. What changes on a server

| Layer | Change | Reversible how |
| --- | --- | --- |
| Database | migrations `0026` to `0032`, all **additive**: baskets, quotations, commercial projects, project documents, outbox columns, lead owner and tasks, offer category | restore the pre-deployment dump (a downgrade drops tables and so data); the application of the previous tag keeps working with the extra tables |
| Disk | a new volume `project_files` mounted at `/var/lib/acs/project-files` in the API container (customer files, only when uploads are on) | stop uploads first; the volume is not deleted by a release |
| Environment | new variables, **every one off by default** (section 3) | unset or set to `false` and restart the API |
| Web | new pages: pricing, packages, demonstrations (public); configurator, basket, quotation, customer projects (behind flags, 404 while off) | flags |
| API | new routes (404 while their flag is off), public demonstrations (always on, stateless) | flags / previous tag |

The roles `acs_app_api` and `acs_app_runtime` already exist; each migration revokes everything from the runtime role and grants the
API role only what it needs (documents, versions, approvals, projects and tasks cannot be deleted by the API role).

## 2. Staging is a separate environment

* Its own host (or at least its own compose project), database, `.env` and domain; **never** the production database or keys.
* Only synthetic data: invented companies, `*.example.com` addresses, the legal e2e seed (`python -m app.cli legal-e2e-seed`) for accounts.
  Real customer data never goes to staging.
* `BILLING_PROVIDER` stays `disabled`, or `stripe` with **test** keys only (a live key is refused in every environment). The first real
  Stripe sandbox run needs the owner's test keys, kept outside the repository (D-43).
* `EMAIL_PROVIDER=dev_file` (writes `.eml` files) or an approved test provider with a test mailbox; never a customer's address.
* Staging is protected: Cloudflare Access (or equivalent) in front of the whole site and `/admin`; staff accounts with MFA.
* The same images and the same migration chain as production will get (build from the release tag).

## 3. Configuration (all off by default)

| Variable | Needs | Turns on |
| --- | --- | --- |
| `PROJECT_CONFIGURATOR_ENABLED` | gate BLOCKER-COM-STORAGE-01 in production | the project configurator |
| `QUOTE_BASKET_ENABLED` | same gate | the quote basket |
| `QUOTATIONS_ENABLED` | gate BLOCKER-COM-ACCEPT-01 in production | the client-facing quotation page and answer |
| `CUSTOMER_ACCOUNTS_ENABLED` | verified e-mail delivery, `EMAIL_DELIVERY_VERIFIED`, the restricted database role | customer sign-in (existing) |
| `COMMERCIAL_PROJECTS_ENABLED` | customer accounts | customer projects and the staff project screens |
| `PROJECT_DOCUMENTS_ENABLED` | commercial projects | documents, downloads, approvals, feedback |
| `PROJECT_UPLOADS_ENABLED` | documents; **gate BLOCKER-COM-UPLOAD-01** in production | staff uploads |
| `PROJECT_CLIENT_UPLOADS_ENABLED` | team uploads | customer uploads |
| `PROJECT_NOTIFICATIONS_ENABLED` | commercial projects, accounts | queueing project e-mail (sent by `outbox-run`) |
| `PROJECT_STORAGE_DIR`, `PROJECT_UPLOAD_MAX_BYTES`, `PROJECT_UPLOAD_REQUIRE_SCAN`, `PROJECT_DOCUMENT_RETENTION_DAYS`, rate limits | – | tuning, see `.env.example` |

Production refuses a flag whose prerequisite is off (`app/config.py`), and the release gates in `app/release_gates.py` are code, not
configuration: they change only in the commit that records the approval. The demonstrations and the admin CRM have **no flag**: they
add nothing customer-facing that needs approval (the demonstrations are stateless on invented data; the CRM is admin-only).

## 4. Order of switching on, with the check at each step

Do one step, run its check, wait, then the next. Every step is undone by turning its flag off and restarting the API.

1. **Deploy with everything off.** `alembic upgrade head` ran (the API log shows it), `/api/health/ready` is green, the public site and `/admin` work,
   `/bg/konto`, `/bg/oferta`, `/bg/zayavka` and `/bg/konfigurator` answer 404, `GET /api/public/demos` answers 200.
2. **Demonstrations and CRM** (no flag): run a scenario in both languages; sign in to `/admin/crm`, set an owner, add and finish a follow-up,
   export the CSV and check it holds no name, e-mail or phone.
3. **Configurator and basket** (`PROJECT_CONFIGURATOR_ENABLED`, `QUOTE_BASKET_ENABLED`): the cookie policy was updated on 2026-11-13 and BLOCKER-COM-STORAGE-01 is closed; switch them on first in staging, then in production by setting both names in the server `.env` (the production `compose.yml` now passes them to the web app too) and running `acs-deploy deploy` again.
   Check the answers survive a reload, the server recomputes the totals, a request becomes an enquiry in the admin.
4. **Quotations** (`QUOTATIONS_ENABLED`): publish an approved proposal, open the link (the secret is in the address fragment), answer once, see the answer in the admin.
   Production waits for the approved wording (BLOCKER-COM-ACCEPT-01).
5. **Accounts** (existing gates G1 to G3): e-mail delivery first, then sign-up for a closed group.
6. **Commercial projects** (`COMMERCIAL_PROJECTS_ENABLED`): create a draft for a verified synthetic account, move it to "Quotation", read it as the customer, request a change,
   approve a scope as the owner and as a plain member (403).
7. **Documents** (`PROJECT_DOCUMENTS_ENABLED`, then `PROJECT_UPLOADS_ENABLED`): upload a draft (staff), publish it (needs a `clean` scan result while scanning is required),
   download it as the customer, ask for and record an approval, check an infected result withdraws a version. **Back up the `project_files` volume** before and after.
   Customer uploads (`PROJECT_CLIENT_UPLOADS_ENABLED`) last, and in production only after the security review is recorded.
8. **Project e-mail** (`PROJECT_NOTIFICATIONS_ENABLED`, `EMAIL_PROVIDER` test): trigger each event, run `python -m app.cli outbox-run`, read the `.eml` files: a reference, a title and a link, nothing else.
9. **Stripe sandbox** (`BILLING_PROVIDER=stripe` with test keys, staging only): the matrix in [BILLING_SANDBOX_MATRIX.md](BILLING_SANDBOX_MATRIX.md) against the real sandbox. This is the step that is still
   **blocked** for lack of test keys.

## 5. Cloudflare checklist (owner)

Nothing is configured by this repository. Check each item in the dashboard of the staging zone first.

- [ ] **Caching**: bypass the cache for `/api/*`, `/admin*`, `/bg/konto*`, `/en/account*`, `/bg/oferta*`, `/en/quotation*`. The API already sends `Cache-Control: no-store` on the private routes (a test checks the project and document routes) and `public, max-age=300` only on `GET /api/public/demos`.
- [ ] **Do not transform** downloads: no Rocket Loader or Mirage, no minification of `/api/*`. File downloads are attachments with `X-Content-Type-Options: nosniff`.
- [ ] **Rate limiting / WAF** rules in front of the app limits (the app limits stay): `POST /api/public/demos/*/run`, `POST /api/projects/*/documents*` (uploads), `POST /api/public/quotations/*`, `POST /api/public/quote-*`.
- [ ] **Request body size** at least `PROJECT_UPLOAD_MAX_BYTES` (10 MB by default) on the upload routes, and no larger than needed elsewhere. The proxy in front of the API must allow the same size.
- [ ] **Access** (Zero Trust) in front of the whole staging site; a Service Auth policy only for the deploy tunnel (as already described for the test server). Remember: Access answers 403 only while the tunnel is up.
- [ ] **Turnstile** site key for the contact and sign-up forms (existing); the staging key is separate from production.
- [ ] **TLS and headers**: full (strict) TLS, HSTS after the first clean week, no cache of `Set-Cookie` responses.
- [ ] **E-mail Routing** is receive-only (existing). Sending needs a separate approved provider with SPF, DKIM and DMARC (D-05, [DNS_MAILBOX_VERIFICATION.md](DNS_MAILBOX_VERIFICATION.md)); nothing in staging may send to a real address.
- [ ] **Stripe webhook** endpoint (test mode) points to the staging API only; the signing secret stays on the server.

## 6. Hetzner checklist (owner / DevOps)

- [ ] Firewall: 22 (key only, from known addresses), 80/443 or tunnel only; the database port is never public.
- [ ] Unattended security updates; disk alerts. **The `project_files` volume grows with customer files**: alert at 70 % and plan the object-store replacement (D-33).
- [ ] **Backups cover both**: the PostgreSQL dump and the `project_files` volume (snapshot or `rsync` to a second location). A restore drill restores both and then
  opens a document through the API; records without their bytes or bytes without records are both failures.
- [ ] `python -m app.cli outbox-run`, `billing-run`, `billing-reconcile`, `project-documents-purge` are scheduled (timers are **not installed**: the repository only provides the commands).
- [ ] `.env` is `chmod 600`, owned by the deploy user, with fresh secrets; no secret in the repository, logs or the compose file.
- [ ] Log retention and rotation (existing); the API logs carry ids, never addresses, notes or file names (tests check the project, document and notification paths).
- [ ] An uptime monitor on `/api/health/ready` and one on a public page.

## 7. Release gates

| Gate | What it protects | State |
| --- | --- | --- |
| BLOCKER-COM-STORAGE-01 | production refuses the configurator and the basket until the cookie policy describes their browser storage | **open** (D-15) |
| BLOCKER-COM-ACCEPT-01 | production refuses quotations until the meaning and wording of the client's answer are approved | **open** (D-06) |
| BLOCKER-COM-UPLOAD-01 | production refuses uploads until the security review and the upload policy are recorded | **open** (D-31, D-32, D-33) |
| BLOCKER-ACC-HEADER-01 | the header layout with accounts on | closed (D-01) |
| `EMAIL_DELIVERY_VERIFIED` | accounts, and so project e-mail, in production | **not set**: the mailbox and sending domain are not verified (D-05) |
| Legal texts approved | order review, terms, withdrawal, privacy | owner and lawyer ([LEGAL_CONTENT_RELEASE.md](LEGAL_CONTENT_RELEASE.md)) |
| Billing live | live Stripe key, tax treatment, refund rules | **refused** in every environment until the owner decides (D-04, D-11, D-12, D-42, D-43) |
| Customer MFA | before accounts go live | **not built** (D-22) |
| Retention periods | withdrawals, data requests (accounts gate) and commercial records | **not approved** (D-28, `LEGAL_RETENTION.md`) |

The full list of owner decisions is [COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md).

## 8. Rollback, by layer

1. **A feature misbehaves**: set its flag to `false`, restart the API (and the web container for the web-only flags). Data stays; the routes answer 404 again.
2. **The application**: `git checkout <previous tag>`, rebuild, restart. The extra tables and columns do not matter to the old code.
3. **A migration**: restore the pre-deployment dump (never `alembic downgrade` on live data); restore the `project_files` volume from the matching snapshot. Anything written between the deployment and the rollback is lost: export new enquiries first.
4. **Uploads in doubt**: set `PROJECT_UPLOADS_ENABLED=false` and `PROJECT_CLIENT_UPLOADS_ENABLED=false`; record a scan result `infected` on a suspect version (it is withdrawn at once and closes its approval request).

## 9. Smoke test after each deployment

`/api/health/ready`; `/bg`, `/en`, `/bg/demo-tsentar`; one demonstration; `/admin` sign-in with MFA; `/admin/crm`; a test enquiry visible and deleted afterwards;
`/bg/konto` answers what its flag says (404 while off); response headers on a private API route (`Cache-Control: no-store`); `robots.txt` and `sitemap.xml` as in
[SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md); the e2e suites against staging where possible (`scripts/test.ps1 -Suite e2e`, `commercial`, `legal`, which build their own test stacks and database and never touch production).

## 10. Not done here

No server, Cloudflare or Hetzner setting was changed. No timer was installed, no volume created on a server, no key issued, no e-mail sent, no Stripe call made, nothing deployed.
