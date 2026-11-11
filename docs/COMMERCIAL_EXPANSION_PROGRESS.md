# Commercial expansion — progress

Statuses: NOT_STARTED, IN_PROGRESS, IMPLEMENTED, TESTED, BLOCKED, DEFERRED, FAILED.
Branch: `feature/commercial-expansion` (from `origin/main` @ `e56e5cd`). Nothing committed, pushed or deployed. Migrations `0026` (committed) and `0027` exist only in the local test databases; neither was applied anywhere else.

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
| 09 | Commercial project portal | NOT_STARTED | | |
| 10 | Documents, uploads, approvals | NOT_STARTED | | Uploads stay disabled |
| 11 | Transactional e-mail | NOT_STARTED | | Real sending blocked by R2 |
| 12 | Admin CRM | NOT_STARTED | | |
| 13 | Stripe sandbox billing | NOT_STARTED | | Needs sandbox keys (R7) |
| 14 | AI demos | NOT_STARTED | | |
| 15 | SEO, performance, analytics | NOT_STARTED | | |
| 16 | Security and GDPR review | NOT_STARTED | | |
| 17 | Staging and release gates | NOT_STARTED | | Documents only |
| 18 | Full QA and release review | NOT_STARTED | | Stops at release approval |

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
