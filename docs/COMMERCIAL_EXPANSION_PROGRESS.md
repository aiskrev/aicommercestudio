# Commercial expansion — progress

Statuses: NOT_STARTED, IN_PROGRESS, IMPLEMENTED, TESTED, BLOCKED, DEFERRED, FAILED.
Branch: `feature/commercial-expansion` (from `origin/main` @ `e56e5cd`). Phases 01-08 are committed and pushed (PR #75 and #76 are merged); Phase 09 is in the working tree, not committed. Nothing is deployed. Migrations `0026` to `0032` exist only in local and test databases; none was applied to any server.

| Phase | Name | Status | Last update | Notes |
| --- | --- | --- | --- | --- |
| 01 | Baseline audit | TESTED | 2026-11-11 | Audit, roadmap and progress documents written; `docs_sync` checked (see checkpoint) |
| 02 | UX and conversion | TESTED | 2026-11-11 | Homepage entry points, header fix with accounts on (BLOCKER-ACC-HEADER-01 closed), see checkpoint |
| 03 | Service packages | TESTED | 2026-11-11 | `/proektni-paketi` page with five packages; two prices pending with the owner (D-09), see checkpoint |
| 04 | Centralised pricing | TESTED | 2026-11-11 | Schedule document shared by web and API, `/tseni` page; owner approval of the schedule still pending (D-04) |
| 05 | Project configurator | TESTED | 2026-11-11 | Behind `PROJECT_CONFIGURATOR_ENABLED` (off); server-side review, quote request creates a lead; see checkpoint and PROJECT_CONFIGURATOR.md |
| 06 | Quote basket | TESTED | 2026-11-11 | Behind `QUOTE_BASKET_ENABLED` (off); migration 0026 (local only); see checkpoint and QUOTE_BASKET.md |
| 07 | Quotations and leads | TESTED | 2026-11-11 | Behind `QUOTATIONS_ENABLED` (off); migration 0027 (local only); acceptance wording unapproved (BLOCKER-COM-ACCEPT-01); see checkpoint and QUOTATIONS.md |
| 08 | Customer accounts hardening | TESTED | 2026-11-11 | Verified against the list; account status, own quote requests by verified ownership, go-live prerequisites tested; customer MFA not built (D-22); see ACCOUNTS_HARDENING.md |
| 09 | Commercial project portal | TESTED | 2026-11-11 | Behind `COMMERCIAL_PROJECTS_ENABLED` (off, needs accounts); migration 0028 (local only); lifecycle, roles, cross-tenant tests; see checkpoint and COMMERCIAL_PROJECTS.md |
| 10 | Documents, uploads, approvals | TESTED | 2026-11-12 | Behind `PROJECT_DOCUMENTS_ENABLED`, `PROJECT_UPLOADS_ENABLED`, `PROJECT_CLIENT_UPLOADS_ENABLED` (all off); migration 0029 (local only); upload gate BLOCKER-COM-UPLOAD-01 open; see checkpoint and PROJECT_DOCUMENTS.md |
| 11 | Transactional e-mail | TESTED | 2026-11-12 | Project e-mail on the existing outbox behind `PROJECT_NOTIFICATIONS_ENABLED` (off); migration 0030 (local only); no real mail sent; see checkpoint and PROJECT_NOTIFICATIONS.md |
| 12 | Admin CRM | TESTED | 2026-11-12 | Extends the existing admin (admin role only, no flag): lead owner, follow-up tasks, overview of real counts, timeline, customer links, safe CSV export; migration 0031 (local only); see checkpoint and ADMIN_CRM.md |
| 13 | Stripe sandbox billing | TESTED (mocked); REAL SANDBOX BLOCKED | 2026-11-12 | Validation of the existing billing: sandbox matrix mapped to tests, four kinds of sale, a deposit can never be approved (migration 0032, local only); no test keys, no live call; see checkpoint and BILLING_SANDBOX_MATRIX.md |
| 14 | AI demos | TESTED | 2026-11-12 | Eight public interactive simulations on invented data, deterministic, no provider, the platform approval policy, notes cannot steer; no flag, no migration; see checkpoint and AI_DEMONSTRATIONS.md |
| 15 | SEO, performance, analytics | TESTED (Lighthouse NOT RE-RUN) | 2026-11-12 | Six anonymous funnel events (no registration event, D-46); indexing rules and sitemap tested; no third-party host and a script budget as tests; Core Web Vitals not re-measured (D-47) |
| 16 | Security and GDPR review | TESTED | 2026-11-12 | Data map in code with a guard test; findings F1 to F9 (admin-only reads, staff view logging, scheduled retention of stored files); dependency audits clean; see SECURITY_GDPR_REVIEW_COMMERCIAL.md |
| 17 | Staging and release gates | DOCUMENT WRITTEN | 2026-11-12 | COMMERCIAL_STAGING_RUNBOOK.md; nothing was changed on any server |
| 18 | Full QA and release review | DONE; STOPS AT THE APPROVAL GATE | 2026-11-12 | COMMERCIAL_RELEASE_REVIEW.md; nothing deployed, committed or pushed |

## Checkpoints

### Phase 01 — 2026-11-11

* Read-only inventory of git state, migrations (head 0025), API routers/models, web routes/lib/components, tests, CI, docs.
* Deliverables: [COMMERCIAL_EXPANSION_AUDIT.md](COMMERCIAL_EXPANSION_AUDIT.md),
  [COMMERCIAL_EXPANSION_ROADMAP.md](COMMERCIAL_EXPANSION_ROADMAP.md), this file.
* No source, dependency, migration or infrastructure change.

### Phase 02 — 2026-11-11

Implemented:

* Homepage section "What do you want to build?" (`components/home/ProjectEntryPoints.tsx`, content in
  `content/{bg,en}/home.ts` → `entry`): five entry points (business website, online store, custom web application,
  AI automation, AI Managed Services). Each card links to its service page and to the quote form pre-set for that
  service, and shows the existing indicative band from `lib/prices.ts`, labelled "indicative, not a quote". Each
  card carries the line drawing of its discipline (`ServiceMotif`). Server component, no client JavaScript.
* Header with customer accounts on: one compact sign-in control on desktop instead of a text link plus a sign-up
  button; bar gaps tighter at the `lg` breakpoint. BLOCKER-ACC-HEADER-01 closed
  (`ACCOUNT_HEADER_LAYOUT_FIXED = True`); the browser test runs without `test.fail()`.
* Test tooling: `legal-e2e-seed` now gives kept synthetic accounts the password of the current run (before, every
  sign-in of a re-run against an existing database failed).

Not changed: hero calls to action (approved copy), financial logic, prices, navigation model, protected content.
"Configure a project" is deferred to Phase 05 (D-03).

Executed on this state:

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite web` (typecheck, lint, unit/UI) | 72 files, 997 tests passed |
| `scripts/test.ps1 -Suite api` (ruff, pytest, docs sync) | 1190 passed, 1 skipped |
| `scripts/test.ps1 -Suite e2e` (production build) | 301 passed, 42 skipped; includes `home-entry.spec.ts` at 360, 390, 768, 1024, 1440 px |
| `scripts/test-legal-e2e.ps1` (accounts on) with responsive, workflow, accessibility and cookie specs | 38 passed, 71 skipped, **1 failed** (see below); header fits at 1024 and 1440 px |

Known limitation (not caused by this phase): `legal-workflows.spec.ts › consumer: two steps…` fails on a re-run
against a database that already holds the consumer's withdrawal from an earlier run (the row from 2026-11-10 is in
`refund_review`, so the withdrawal button is not offered). It passes on a fresh database. Making the legal e2e stack
hermetic (own database per run) is planned for Phase 08.

### Phase 03 — 2026-11-11

Implemented:

* Page `/bg/proektni-paketi` ↔ `/en/project-packages` (`app/[locale]/proektni-paketi/page.tsx`): five packages
  (landing page, business website, starter online store, complete online store, custom web application). Each has
  audience, goal, included and excluded items, prerequisites, technology, design, integrations, content
  responsibilities, typical stages (taken from the service's own workflow), price rule, follow-up care and two
  actions (quote for that service, service page). Below: a comparison table, the two existing care plans for
  websites and stores (linked to `/paketi`, not described twice), an FAQ and a call to action.
* Model `lib/project-packages.ts`: a package is a presentation of an existing service, not a new catalogue entry.
  Three packages show the published band of their service; the landing page and the starter store have no
  separately approved price and say "Price in a written quote" (D-09). The custom web application is marked
  "in stages" and carries a note that its scope is unknown before an assessment.
* Content `content/{bg,en}/project-packages.ts`, typed so the English copy cannot miss a field.
* Discoverability: Solutions menu, footer, sitemap, site search, a "Compare the packages" link in the homepage
  entry section and a link under the price on the three service pages that have packages.
* No database change, no new service key, no API change.

Executed on this state:

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite web` | 73 files passed (new: `lib/project-packages.test.ts`, 8 tests) |
| `scripts/test.ps1 -Suite e2e` | 311 passed, 42 skipped (new: `project-packages.spec.ts`, 10 tests incl. 360–1440 px in both languages) |

The API suite was not re-run for this phase: no file under `apps/api` or any mirrored JSON changed after the
Phase 02 run (1190 passed).

### Phase 04 — 2026-11-11

Implemented:

* `lib/prices.ts` stays the only place where an amount is written; added `PRICE_CURRENCY`, `PRICE_TAX_TREATMENT`
  and `PRICE_SCHEDULE_VERSION`. No amount, factor or rounding rule was changed.
* `lib/price-schedule.ts` + `lib/price-schedule.json`: the active schedule as one document (version, currency,
  approval, tax treatment, `binding: false`, excluded costs, every band). Copied to
  `apps/api/app/price_schedule.json`; `scripts/test.ps1` compares the two files.
* `apps/api/app/pricing.py`: validated loader (`schedule()`, `band()`, `is_owner_approved()`). No route yet; no
  parameter for language, country or address; nothing to do with Stripe amounts.
* Page `/bg/tseni` ↔ `/en/pricing`: every band grouped as one-time projects, monthly services, AI Managed
  Services, care plans and workshops, with the general note, the list of what is never included and how the exact
  price is set. Linked from the Solutions menu, the footer, the packages page, the sitemap and the site search.
* The owner's approval of the schedule is still `pending`; nothing was approved on the owner's behalf.

Executed on this state:

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite web` | 74 files passed (new: `lib/price-schedule.test.ts`, 7 tests) |
| `scripts/test.ps1 -Suite api` | 1197 passed, 1 skipped (new: `tests/test_pricing.py`, 7 tests); ruff and docs sync clean |
| `scripts/test.ps1 -Suite e2e` | 318 passed, 42 skipped, 2 failed: both in the new `pricing.spec.ts`, a test id that the `Alert` component does not forward |
| After the fix: web suite again, and `pricing`, `project-packages`, `home-entry` specs on a rebuilt site | 74 files passed; 26 browser tests passed. The full e2e suite was not repeated after this one-line fix |

### Phase 05 — 2026-11-11

Implemented (details: [PROJECT_CONFIGURATOR.md](PROJECT_CONFIGURATOR.md)):

* Flag `PROJECT_CONFIGURATOR_ENABLED`, off by default, in the API and the web. While off: page 404, API 404, no
  entry point, not in the sitemap.
* Shared model file `lib/configurator-model.json` = `app/configurator/model.json` (hash-checked): options,
  packages, feature tables and every result key.
* API: `app/configurator/{model,schemas,service}.py`, `app/routers/configurator.py` with `GET /meta`,
  `POST /review` (deterministic, stores nothing, own rate limit) and `POST /submissions` (one lead per
  `submission_id`, advisory lock against simultaneous duplicates). Amounts only from `app/pricing.py`; unknown
  request fields are refused. Admin lead detail returns the stored answers and review.
* Web: seven-step form `components/configurator/ProjectConfigurator.tsx` (history-based steps, focus management,
  session draft without contact details), page `/bg/konfigurator` ↔ `/en/configurator`, flag-gated entry links on
  the homepage and the packages page, admin panel on the lead.
* Test stack for flagged features: `docker-compose.commercial-e2e.yml`, `scripts/test-commercial-e2e.ps1`,
  `scripts/test.ps1 -Suite commercial`.
* No database migration (the lead uses `leads.service_details`). Different from the roadmap draft: no
  `configurator_sessions` table and no client-side copy of the evaluation; server-side drafts arrive with the quote
  basket (Phase 06).

Executed on this state:

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite web` | 76 files, 1032 tests passed |
| `scripts/test.ps1 -Suite api` | 1237 passed, 1 skipped; ruff, format and docs sync clean (191 paths in `openapi.json`) |
| `scripts/test.ps1 -Suite e2e` (default stack, flag off) | 321 passed, 54 skipped |
| `scripts/test.ps1 -Suite commercial` (flag on) | 12 passed, 1 skipped (the flag-off test) |

Not verified: the sitemap entry on a running stack (the sitemap is regenerated every 300 s; covered by a unit test
only), a screen-reader pass by a person, real devices.

### Phase 06 — 2026-11-11

Implemented (details: [QUOTE_BASKET.md](QUOTE_BASKET.md)):

* Flag `QUOTE_BASKET_ENABLED`, off by default, in the API and the web. While off: page 404, API 404, the
  configurator keeps its own quote form.
* Migration `0026`: table `quote_baskets` (inputs only, token hash, version counter, expiry, lead link). Additive,
  single Alembic head. Applied to the local test databases only.
* API `app/quotes/{models,schemas,service}.py`, `app/routers/quote_basket.py`: create, read, add, replace and
  remove items, discard, send. Ownership by a secret token in the `X-Basket-Token` header (hash stored; not a
  cookie, not in a URL). Every view recomputed from the published schedule; no request can carry an amount.
  Optimistic concurrency with a row lock; a basket is sent once. Expired drafts are purged by the existing
  maintenance job. The admin lead detail shows the stored basket.
* Web: page `/bg/zayavka` ↔ `/en/quote-request` (`components/quote/QuoteBasket.tsx`), client library
  `lib/quote-basket.ts` (the browser keeps only the token). The contact form of the configurator was extracted
  into `QuoteContactForm` and is shared. With the basket on, the configurator ends in "Add to the request" and can
  edit an item (`?item=<id>`).
* Release gate **BLOCKER-COM-STORAGE-01**: production refuses the configurator and the basket until the cookie
  policy describes their browser storage (D-15).
* The commercial test runner makes two passes (basket on, basket off).

Deferred: attaching a request to a customer account (optional sign-in) → Phase 09 (D-17).

Executed on this state:

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite web` | 77 files, 1045 tests passed |
| `scripts/test.ps1 -Suite api` | 1261 passed, 1 skipped; ruff, format and docs sync clean (195 paths in `openapi.json`); includes the model/migration match and the upgrade/downgrade round trip |
| `scripts/test.ps1 -Suite e2e` (default stack, flags off) | 322 passed, 64 skipped |
| `scripts/test.ps1 -Suite commercial` | pass 1 (all flags on): 22 passed, 2 skipped; pass 2 (basket off): 12 passed, 1 skipped |

Not verified: a look at the basket page by a person (covered by axe, keyboard and width tests only), a screen-reader
pass, real devices, the upgrade to `0026` on a copy of production data (the table is new and empty, nothing existing
is touched).

### Phase 07 — 2026-11-11

Implemented (details: [QUOTATIONS.md](QUOTATIONS.md)):

* **Configured enquiries into the existing workflow.** A lead from the configurator or the basket already holds the
  versioned snapshot (model version, answers, the server's review or the basket view). Linked records in the admin
  now name both kinds. The opportunity form is pre-filled from the configuration (not saved); "generate a first
  draft" uses it (`app/opportunities/configured.py`, labels file shared with the web). The indicative bands are not
  copied into a draft and the commercial section stays the placeholder. Retries create no duplicate lead or
  opportunity (submission id, one-time basket send, `lead_opportunities.lead_id` as primary key).
* **Client-facing quotation** behind `QUOTATIONS_ENABLED` (off): migration `0027` (`quotations`), staff publish an
  approved version and get a secret link once (administrators only), the client reads it at `/bg/oferta` ↔
  `/en/quotation` (secret in the URL fragment, sent in a request body, no storage) and answers once. Withdrawal,
  optional validity date set by staff, view marks, audit events. Nothing is sent by the system.
* Admin: a quotation panel in the approved proposal.
* Release gate **BLOCKER-COM-ACCEPT-01**: production refuses the flag until the meaning and wording of the client's
  answer are approved (D-06).

Not done in this phase: linking an accepted quotation to a customer project (the project object arrives in
Phase 09, D-19); any automatic sending (no approved notification workflow).

Executed on this state:

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite web` | 78 files, 1056 tests passed |
| `scripts/test.ps1 -Suite api` | 1292 passed, 1 skipped; ruff, format and docs sync clean (199 paths in `openapi.json`); model/migration match and round trip included |
| `scripts/test.ps1 -Suite e2e` (default stack, flags off) | 322 passed, 74 skipped, 1 failed: the new switched-off test expected 401 where the staff route correctly answers 404; fixed, the three flagged specs re-run on the default stack: 3 passed, 32 skipped. The full suite was not repeated after this one-line test fix |
| `scripts/test.ps1 -Suite commercial` | pass 1 (all flags on): 32 passed, 3 skipped; pass 2 (basket off): 12 passed, 1 skipped |

Not verified: a look at the quotation page and the admin panel by a person, a screen-reader pass, real devices, the
upgrade to `0027` on a copy of production data (new empty table).

### Phase 08 — 2026-11-11

Verified and hardened the **existing** customer identity layer (details and the full matrix:
[ACCOUNTS_HARDENING.md](ACCOUNTS_HARDENING.md)). No second authentication system, no database migration, public
registration still off (`CUSTOMER_ACCOUNTS_ENABLED=false`).

* Verified against the programme list: registration, e-mail verification, sign-in, sign-out, password reset, sessions,
  profile, language, marketing consent, export and the deletion request, workspace membership.
* Gaps closed: an erased account can never use a session; account status on `/me` (`email_verified`, `created_at`,
  `privacy_notice_version`, `status`) and in the account page; cookie attributes tested in production; every route
  that needs a customer session is now discovered from the application and checked for 401 without sign-in, 403
  without CSRF and for a staff cookie (about 100 parametrised tests).
* **Quote requests and accounts** (`GET /api/accounts/quote-requests`, read-only): a request belongs to an account only
  when it was sent from the account's own *verified* address; never by company, name, phone or domain; no contact
  details, free text, pipeline status, quotation link or content. The anonymous routes are unchanged.
* The go-live prerequisites are tests: a satisfying production configuration is broken one prerequisite at a time.
* The legal e2e stack is hermetic: a throwaway database per run, dropped afterwards (the earlier known limitation, a
  failing re-run, is gone; two consecutive runs passed).

Not done: customer MFA (D-22), changing the sign-in address, bounce handling.

Executed on this state:

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite web` | 79 files, 1060 tests passed |
| `scripts/test.ps1 -Suite api` | 1407 passed, 1 skipped. Ruff reported one over-long comment line in the new test file; fixed and re-checked (ruff check and format clean, docs sync clean). The pytest run was not repeated after that one-line comment change |
| `scripts/test.ps1 -Suite e2e` (flags off) | 323 passed, 77 skipped |
| `scripts/test.ps1 -Suite commercial` | pass 1: 32 passed, 3 skipped; pass 2: 12 passed, 1 skipped |
| `scripts/test.ps1 -Suite legal` (throwaway database), run twice | 50 passed, 1 skipped, both times |

Not verified: a person's review of the account page, screen reader, real devices; customer sign-in on a real mailbox.

### Phase 09 — 2026-11-11

Commercial customer projects: the customer workspace gets a **delivery** side (details and the lifecycle table:
[COMMERCIAL_PROJECTS.md](COMMERCIAL_PROJECTS.md)). Separate from the AI Operations portal and the Advisor Workspace, which
are unchanged. Behind `COMMERCIAL_PROJECTS_ENABLED=false` (the customer side also needs `CUSTOMER_ACCOUNTS_ENABLED`;
production refuses the first without the second). Migration `0028` (local only, like 0026 and 0027).

* Lifecycle defined first and enforced in one table: draft, quotation, awaiting approval, approved, in progress, client
  review, completed, maintenance. Only the customer (owner or `billing`) approves a scope or accepts a result; staff
  cannot approve on their behalf (the schema has no such move).
* The workspace is always the caller's own (or one they belong to); a project of another workspace and a draft answer 404
  `project_not_found`; staff pick the customer by the e-mail of a verified, non-erased account, never by an id.
* The scope is an immutable copy of the accepted quotation's approved version. Contract and invoice **numbers** only: no
  amounts, no documents (Phase 10). Staff names, e-mail addresses and internal notes never reach a customer.
* Optimistic concurrency (`expected_revision`), row locks for simultaneous decisions, idempotent repeats, audit records.
* Customer page `/bg/konto/izrabotka` ↔ `/en/account/delivery` (noindex, no-store, 404 while off); staff `/admin/projects`
  and a panel on the inquiry page. Export includes the customer's projects; an account that owns projects is anonymised.
* D-19 resolved, D-25 to D-30 recorded in [COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md).

Not done: documents and uploads (Phase 10), customer e-mail (Phase 11), amounts and invoices (Phase 13), customer MFA (D-22).

Executed on this state:

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite web` (typecheck, lint, unit) | 80 files, 1070 tests passed |
| `scripts/test.ps1 -Suite api` | 1456 passed, 1 skipped. Ruff reported an import order and one line wrap in the new test file; fixed, then `ruff check` and `ruff format --check` re-run clean (the pytest run was not repeated after that whitespace-only change); docs sync clean |
| `scripts/test.ps1 -Suite e2e` (flags off) | 323 passed, 85 skipped |
| `scripts/test.ps1 -Suite commercial` | pass 1: 32 passed, 3 skipped; pass 2: 12 passed, 1 skipped |
| `scripts/test.ps1 -Suite legal` | 50 passed, 1 skipped (before the new spec was added to its default list) |
| `tests/delivery-projects.spec.ts` on the legal stack | 8 passed (sign-in required and 401, list without the draft, internal note and staff e-mail never shown, request and reply, another customer gets the same 404 as for a missing project, English page, axe and no horizontal scroll at 360 px, staff list). The first run found a wrong comparison in the test itself (white space), fixed |

Not verified: a person's review of the new pages, screen reader, real devices, the member role in the browser (covered by the
API tests and the component tests only), the wording of D-25.

### Phase 10 — 2026-11-12

Project documents, uploads and approvals on top of the commercial projects ([PROJECT_DOCUMENTS.md](PROJECT_DOCUMENTS.md)).
Three flags, all off: documents, team uploads, customer uploads. Production refuses a flag without its prerequisite and
refuses uploads until the security review is recorded (release gate **BLOCKER-COM-UPLOAD-01**, open). Migration `0029`
(local only).

* Private storage behind a four-method interface (`put`, `open`, `delete`, `exists`); a local directory outside every web
  root today, a Docker volume owned by the API user. Server-made hex keys, strict key pattern, resolved path inside the
  root, atomic writes, modes 0600/0700. No signed or public URL: every download is authorized by the API.
* Strict allowlist by name and by content (pdf, png, jpg, webp, txt, md, csv, docx, xlsx, pptx); the stored type comes from
  the check; Office files are inspected (no macros, no parent paths, size bomb limits); size limited by header and while
  streaming; attachments only, `nosniff`, `no-store`.
* Versions are immutable and numbered; a new file must name the version the uploader saw; the same bytes change nothing.
  The team's upload is a draft until an administrator publishes it; a customer's own upload is visible at once.
* Approvals record who, project, version, decision, note and time; made once by the owner or a `billing` member; repeats
  are idempotent, contradictions, superseded and stale versions are refused; simultaneous decisions record one.
* Malware scanning readiness: a scan result per version, required before publication and customer download by default.
  **No scanner is bundled**; nothing claims a file is safe.
* Retention: `project-documents-purge` removes the bytes after the retention date, keeps records, skips open requests.
* Export and erasure cover the customer's uploads, decisions and comments.
* Review finding fixed: the first version let any staff role (editor, viewer) read customer projects and documents. All
  project, document and delivery routes are now `admin` only (D-39).

Not done: a scanner, a private object store, backup of the storage volume, viewing files in the browser, e-signature.
Decisions D-31 to D-35, D-39.

### Phase 11 — 2026-11-12

Service e-mail about a customer's own project through the **existing** outbox ([PROJECT_NOTIFICATIONS.md](PROJECT_NOTIFICATIONS.md)).
Behind `PROJECT_NOTIFICATIONS_ENABLED=false`; migration `0030` (two nullable columns and a unique index on the outbox). No
real e-mail was sent: the tests inject a sender, the legal stack uses the development file provider and nobody runs
`outbox-run` there; production still needs verified delivery before accounts (and so these messages) can start.

* Nine events become six kinds, queued in the same transaction as the event, once per account and event (unique index), to
  the verified address of the owner and members (decisions go to the owner and `billing` members only). A draft, an
  internal note and the customer's own actions send nothing.
* A message holds a reference, a title and a link to the signed-in page: never a note, a file name, a token or an amount.
  BG/EN by the account's language; not marketing, no consent involved (D-36, D-37).
* Provider outage retries with backoff to six attempts; a refused recipient or a 5xx answer fails at once; a vanished
  project or erased account fails cleanly; no provider means `blocked`. Logs carry no address or text.
* Staff see the delivery state per project (kind, state, attempts, error code), admin only.
* Not sent, on purpose: the quotation link (D-38), the visitor acknowledgement (prepared only), internal assignment and
  staff notices (Phase 12), billing notices (Phase 13).

Executed on this state (before the admin-only change of the project read routes, which the next full run re-checks):

| Check | Result |
| --- | --- |
| `scripts/test.ps1 -Suite api` | 1546 passed, 1 skipped; ruff check and format clean; docs sync clean |
| `scripts/test.ps1 -Suite web` | 81 files, 1081 tests passed |
| `scripts/test.ps1 -Suite legal` (now with the delivery, documents and notification specs) | 66 passed |
| Focused: `test_project_documents.py` 62, `test_project_notifications.py` 16 | passed |

Not verified: real devices, a screen reader, a real mailbox, the wording of D-25 and D-37, backup of the storage volume.

### Phase 12 — 2026-11-12

Admin CRM, built **on the existing admin** and not as a second CRM ([ADMIN_CRM.md](ADMIN_CRM.md)). Admin role only, like leads
(editors and viewers still reach only the catalogue); no flag, because nothing customer-facing is added. Migration `0031`
(local only): `leads.owner_id` and `lead_tasks`.

* Owner on every enquiry (an active administrator), filter by owner and qualification, owner on every list row.
* Follow-up tasks: text, date, assignee, state, revision; open work first; overdue and this-week views; no customer details
  in the task list; cancelled, never deleted; removed with their lead.
* Overview of **real counts only**: enquiries, open opportunities, approved proposals, quotations waiting and accepted, active
  projects, follow-ups, workload per owner. No revenue, no forecast, no conversion rate (a test fixes the exact fields).
* One timeline per enquiry joining audit, notes, proposals, quotations, projects and tasks; the customer account, projects and
  quotations behind an enquiry for navigation.
* Safe export: a whitelist of 13 pipeline columns, no personal data, formula-injection safe, audited, 5000 rows at most.
* Decisions D-40, D-41.

### Phase 13 — 2026-11-12

Validation of the **existing** Stripe billing, no second integration and no live key ([BILLING_SANDBOX_MATRIX.md](BILLING_SANDBOX_MATRIX.md)).
Migration `0032` (local only): `billing_offers.category`.

* The sandbox matrix (13 cases) is mapped to the tests of the fake gateway; gaps got tests: a declined first payment, an
  asynchronous failure, another account reaching a workspace it does not belong to, a price differing from Stripe.
* **MOCKED TESTED; REAL SANDBOX BLOCKED**: the project has no Stripe test keys (D-43). Nothing was called in Stripe.
* The four kinds of sale are kept apart (`saas_subscription`, `managed_service`, `one_time_service`, `project_deposit`); a
  **project deposit can never be approved** (database CHECK, checkout refusal, CLI refusal; D-42).
* An indicative quote can never become a price: tests fail if billing imports quotations, basket, configurator, pricing,
  projects, opportunities or CRM, or exposes a route about them.
* Not touched: production refusals in `app/config.py`, the live-key refusal, VAT and legal text (owner, accountant, lawyer).

### Phase 14 — 2026-11-12

Eight public **interactive simulations** of AI automation ([AI_DEMONSTRATIONS.md](AI_DEMONSTRATIONS.md)): product description,
lead qualification, support routing, order workflow, inventory warning, CRM automation, quotation drafting and human approval.
No flag, no migration, no storage, no cookie.

* Six steps each (trigger, input check, AI / rules, output check, human approval, proposed action), on invented data,
  clearly labelled "Simulation"; `executed` is always false.
* Deterministic plain rules, **no AI provider** (D-44); the approval step uses the platform's real policy (`app.ai.policy`).
* A free-text note is data: validated, only flagged, never echoed or obeyed; eleven steering attempts are tested against all
  scenarios; an approval cannot be talked away.
* Rate limits, blocked-input states, empty and error states, BG and EN pages at their own addresses, sitemap and site search,
  a shared scenario list and code list with a hash check between API and web.

Executed on this state: see the table below (the suites run in one sequence after Phase 14).

### Phases 15 to 18 — 2026-11-12

* **15** — six anonymous funnel events, SEO rules and sitemap tests, page-weight and no-third-party tests ([ANALYTICS.md](ANALYTICS.md), [SEO_IMPLEMENTATION.md](SEO_IMPLEMENTATION.md), [PERFORMANCE_BASELINE.md](PERFORMANCE_BASELINE.md)). Lighthouse was **not** re-run (D-47).
* **16** — security and GDPR review with a data map in code ([SECURITY_GDPR_REVIEW_COMMERCIAL.md](SECURITY_GDPR_REVIEW_COMMERCIAL.md)); findings F1 to F9; audits clean.
* **17** — [COMMERCIAL_STAGING_RUNBOOK.md](COMMERCIAL_STAGING_RUNBOOK.md). Nothing was changed on any server.
* **18** — [COMMERCIAL_RELEASE_REVIEW.md](COMMERCIAL_RELEASE_REVIEW.md). The programme **stops at the release approval gate**: nothing is committed (Phases 09 to 18), pushed or deployed.

### Executed results of the final run (Phases 09 to 18, one sequence, then re-runs of what failed)

| Check | Result |
| --- | --- |
| API suite, ruff, docs sync, shared-file hash checks | 1628 passed, 1 skipped |
| Web typecheck, lint, unit | 84 files, 1099 tests passed (one failing test fixed, re-run green) |
| End-to-end, flags off | 338 passed, 93 skipped, 1 failed (CRM spec sign-in timeout); fixed with one shared sign-in; CRM spec re-run: 5 passed |
| Commercial stack, two passes | 32 passed / 3 skipped, and 12 passed / 1 skipped |
| Legal stack | 61 passed and 1 failure in the sequence (`legal-workflows`, marketing consent); the spec alone 25 passed, the whole suite again 66 passed, 1 skipped: recorded as an unexplained flake |
| Audits (pip-audit, npm audit) | no known vulnerabilities, 0 vulnerabilities |

Not verified: a real Stripe sandbox, real e-mail delivery, real devices and a screen reader, Core Web Vitals, a scanner for uploads, backup of `project_files`, any scheduled timer.
