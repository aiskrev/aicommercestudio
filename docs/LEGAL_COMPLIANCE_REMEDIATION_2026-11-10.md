# Legal compliance remediation — 2026-11-10 (technical compliance foundation)

Branch `compliance/legal-remediation`, **uncommitted, unpushed, undeployed**. This is an engineering report, not legal
advice. This work builds a **technical compliance foundation**. It does not make the site, the checkout or the withdrawal
workflow legally compliant: every legal text changed here is an AI-assisted draft marked `pending_lawyer_review`
(`apps/web/src/lib/legal-versions.json`, revision status `draft`), and no lawyer, accountant or owner has approved anything.

Status vocabulary: **TECHNICAL … COMPLETE** (built and tested) · **PARTIALLY FIXED** · **BLOCKED — LEGAL REVIEW / OWNER
DECISION / ACCOUNTING REVIEW / EXTERNAL SERVICE** · **NOT VERIFIED**.

## 1. Git inventory (exact)

Commands run on 2026-11-10 (branch `compliance/legal-remediation`): `git status --short`, `git diff --stat`, `git diff --name-status`, `git ls-files --others --exclude-standard`.

* **Modified tracked files:** 78 (`git diff --stat`: 78 files changed, 2868 insertions(+), 320 deletions(-)).
* **New (untracked) files:** 49. `git status --short` shows 42 `??` lines because it collapses new directories into one line each; the per-file count is the one above.
* **Deleted:** 0. **Renamed:** 0. All changes belong to this compliance work; there is no unrelated change in the working tree.
* **Migrations (new):** `apps/api/alembic/versions/20261110_0023_legal_compliance.py`, `apps/api/alembic/versions/20261110_0024_legal_hardening.py`.
* **Generated files:** `docs/openapi.json` (docs_sync.py --write), `apps/api/app/legal_versions.json` (copy of the web registry), `apps/web/src/lib/legal-versions.json` hashes (UPDATE_LEGAL_VERSIONS=1), `apps/web/e2e/package-lock.json` (npm, for @axe-core/playwright).

<details><summary>Modified files (78)</summary>

- `.env.example`
- `README.md`
- `apps/api/alembic/env.py`
- `apps/api/app/accounts/mail.py`
- `apps/api/app/accounts/models.py`
- `apps/api/app/accounts/service.py`
- `apps/api/app/analytics/service.py`
- `apps/api/app/billing/models.py`
- `apps/api/app/billing/service.py`
- `apps/api/app/cli.py`
- `apps/api/app/config.py`
- `apps/api/app/main.py`
- `apps/api/app/models.py`
- `apps/api/app/routers/accounts.py`
- `apps/api/app/routers/billing.py`
- `apps/api/app/routers/workspace.py`
- `apps/api/tests/test_billing.py`
- `apps/web/e2e/package-lock.json`
- `apps/web/e2e/package.json`
- `apps/web/e2e/tests/advisor.spec.ts`
- `apps/web/e2e/tests/contact.spec.ts`
- `apps/web/e2e/tests/i18n.spec.ts`
- `apps/web/e2e/tests/managed-services-v2.spec.ts`
- `apps/web/e2e/tests/readiness-reports.spec.ts`
- `apps/web/e2e/tests/team-costs.spec.ts`
- `apps/web/e2e/tests/workshops.spec.ts`
- `apps/web/src/app/robots.ts`
- `apps/web/src/app/sitemap.ts`
- `apps/web/src/components/account/AccountHome.tsx`
- `apps/web/src/components/account/AdvisorBilling.tsx`
- `apps/web/src/components/account/billing.test.tsx`
- `apps/web/src/components/admin/AdminShell.tsx`
- `apps/web/src/components/advisor/AdvisorTool.test.tsx`
- `apps/web/src/components/contact/ContactForm.test.tsx`
- `apps/web/src/components/contact/ContactForm.tsx`
- `apps/web/src/components/layout/Footer.tsx`
- `apps/web/src/components/tools/ConsultationForm.tsx`
- `apps/web/src/components/tools/ReadinessReport.tsx`
- `apps/web/src/components/tools/team/TeamExport.tsx`
- `apps/web/src/content/bg/legal.ts`
- `apps/web/src/content/bg/offer-pages.ts`
- `apps/web/src/content/bg/tool-engineering.ts`
- `apps/web/src/content/bg/tool-readiness.ts`
- `apps/web/src/content/bg/tool-solution.ts`
- `apps/web/src/content/bg/tool-team.ts`
- `apps/web/src/content/en/legal.ts`
- `apps/web/src/content/en/offer-pages.ts`
- `apps/web/src/content/en/tool-engineering.ts`
- `apps/web/src/content/en/tool-readiness.ts`
- `apps/web/src/content/en/tool-solution.ts`
- `apps/web/src/content/en/tool-team.ts`
- `apps/web/src/content/en/workshops.ts`
- `apps/web/src/content/index.ts`
- `apps/web/src/i18n/account.ts`
- `apps/web/src/i18n/admin/bg.ts`
- `apps/web/src/i18n/admin/en.ts`
- `apps/web/src/i18n/billing.ts`
- `apps/web/src/i18n/config.ts`
- `apps/web/src/i18n/dictionaries/bg.ts`
- `apps/web/src/i18n/dictionaries/en.ts`
- `apps/web/src/lib/account-api.ts`
- `apps/web/src/lib/care-plans.ts`
- `apps/web/src/lib/company.ts`
- `apps/web/src/lib/prices.test.ts`
- `apps/web/src/lib/prices.ts`
- `apps/web/src/lib/routes.ts`
- `apps/web/src/lib/site-analytics.ts`
- `apps/web/src/lib/workshops.test.ts`
- `docs/ACCOUNTS_GO_LIVE.md`
- `docs/ACCOUNTS_RELEASE_CHECKLIST.md`
- `docs/API_REFERENCE.md`
- `docs/INVOICING.md`
- `docs/PRICING.md`
- `docs/SECURITY.md`
- `docs/STRIPE_BILLING.md`
- `docs/openapi.json`
- `infra/deploy/production.env.example`
- `scripts/test.ps1`

</details>

<details><summary>New files (49)</summary>

- `apps/api/alembic/versions/20261110_0023_legal_compliance.py`
- `apps/api/alembic/versions/20261110_0024_legal_hardening.py`
- `apps/api/app/compliance/__init__.py`
- `apps/api/app/compliance/e2e_seed.py`
- `apps/api/app/compliance/events.py`
- `apps/api/app/compliance/models.py`
- `apps/api/app/compliance/service.py`
- `apps/api/app/legal.py`
- `apps/api/app/legal_versions.json`
- `apps/api/app/routers/admin_compliance.py`
- `apps/api/app/routers/compliance.py`
- `apps/api/app/routers/marketing.py`
- `apps/api/tests/test_compliance.py`
- `apps/api/tests/test_compliance_hardening.py`
- `apps/api/tests/test_migration_legal_populated.py`
- `apps/web/e2e/tests/accessibility.spec.ts`
- `apps/web/e2e/tests/cookie-audit.spec.ts`
- `apps/web/e2e/tests/legal-workflows.spec.ts`
- `apps/web/e2e/tests/responsive-legal.spec.ts`
- `apps/web/src/app/[locale]/otkaz-i-vazstanovyavane/page.tsx`
- `apps/web/src/app/[locale]/otkaz-ot-marketing/page.tsx`
- `apps/web/src/app/admin/(protected)/compliance/layout.tsx`
- `apps/web/src/app/admin/(protected)/compliance/page.tsx`
- `apps/web/src/components/account/DataRights.tsx`
- `apps/web/src/components/account/OrderReview.tsx`
- `apps/web/src/components/account/Withdrawal.tsx`
- `apps/web/src/components/account/dataRights.test.tsx`
- `apps/web/src/components/account/withdrawal.test.tsx`
- `apps/web/src/components/admin/Compliance.tsx`
- `apps/web/src/components/admin/compliance.test.tsx`
- `apps/web/src/components/marketing/MarketingWithdrawal.tsx`
- `apps/web/src/components/marketing/marketing.test.tsx`
- `apps/web/src/i18n/marketing.ts`
- `apps/web/src/lib/legal-versions.json`
- `apps/web/src/lib/legal-versions.test.ts`
- `apps/web/src/lib/legal-versions.ts`
- `apps/web/src/lib/sla.test.ts`
- `apps/web/src/lib/sla.ts`
- `docker-compose.legal-e2e.yml`
- `docs/ACCESSIBILITY.md`
- `docs/COOKIE_AUDIT.md`
- `docs/DNS_MAILBOX_VERIFICATION.md`
- `docs/LEGAL_COMPLIANCE_REMEDIATION_2026-11-10.md`
- `docs/LEGAL_CONTENT_RELEASE.md`
- `docs/LEGAL_RETENTION.md`
- `docs/LEGAL_SOURCES.md`
- `docs/legal-templates/DPA_ART28_TEMPLATE.md`
- `docs/legal-templates/MAINTENANCE_MANAGED_SERVICES_AGREEMENT_TEMPLATE.md`
- `scripts/test-legal-e2e.ps1`

</details>

Documentation files touched: 18. Test files touched: 28.


## 2. Issue status

| ID | Status | What exists | Dependency |
| --- | --- | --- | --- |
| P0‑01 Privacy policy | **TECHNICAL IMPLEMENTATION COMPLETE · BLOCKED — LEGAL REVIEW** | 17 sections in BG and EN, version registry, API and web integration. Substantive accuracy is not verified | Lawyer |
| P0‑02 Company data | **PARTIALLY FIXED · NOT VERIFIED — DNS AND MAILBOX** | Entity data in `company.ts`, read by footer, legal texts and the order review. Contact values untouched. Delivery to the published address was not tested | Owner, e-mail provider (docs/DNS_MAILBOX_VERIFICATION.md) |
| P0‑03 Consent | **TECHNICAL IMPLEMENTATION COMPLETE · BLOCKED — LEGAL REVIEW** | Separate unticked marketing checkbox everywhere, versioned history, withdrawal by profile toggle, by staff, and now **by the person with an opaque link** (inquiry-only leads). The system sends no marketing e-mail; the sender, the content and the link in it are outside this repository | Lawyer; whoever sends campaigns |
| P0‑04 Cookies | **PARTIALLY FIXED · LOCAL INVENTORY COMPLETE · PRODUCTION INVENTORY NOT VERIFIED · BLOCKED — LEGAL REVIEW** | Inventory with evidence classes and a repeatable audit (docs/COOKIE_AUDIT.md). Cloudflare, Stripe-hosted checkout, Turnstile and account cookies are NOT verified in production; `acs_locale` is not classified as strictly necessary | Lawyer; owner (audit of staging and production) |
| P0‑05 Versions | **TECHNICALLY FIXED** (while hashes, texts and ids stay consistent: the test enforces it) | Registry with draft/approved/published, per-language hashes, language pairing, draft refused for live acceptance | Lawyer approval to move a text out of draft |
| P0‑06 Pricing | **TECHNICAL ARCHITECTURE FIXED · BLOCKED — OWNER DECISION · BLOCKED — LEGAL REVIEW** | One price list for both languages. **Selecting the Bulgarian schedule as the shared one lowered the effective English prices** (exact amounts in docs/PRICING.md); no Bulgarian price changed | Owner's written approval; lawyer on geo-blocking |
| P0‑07 Order review | **PARTIALLY FIXED · BLOCKED — LEGAL REVIEW** | Review step with seller identification, price, EUR, interval, renewal, cancellation, terms, privacy, third-party-cost note, server-validated acceptance; browser tests and automated accessibility checks pass on the test stack. Not complete until the legal text is approved, a person reviews it with assistive technology, and the mailbox shown as seller contact is verified | Lawyer; accessibility manual review; e-mail provider |
| P0‑08 Withdrawal | **TECHNICAL FOUNDATION COMPLETE · BLOCKED — BULGARIAN LEGAL REVIEW · BLOCKED — OWNER DECISION · BLOCKED — ACCOUNTING REVIEW** | Function with the statutory-style labels, two steps, reference, acknowledgement sent at once, staff queue, manual refund reference; never automatic. It is **not** claimed to comply: see docs/LEGAL_SOURCES.md for the open questions | Lawyer; owner (refund process); accountant |
| P1‑01 SLA and contracts | **TECHNICAL STRUCTURE COMPLETE · BLOCKED — OWNER DECISION · BLOCKED — LEGAL REVIEW** | Empty SLA schema, "Agreed in the individual contract", two draft templates. No figure invented | Owner; lawyer |
| P1‑02 Invoicing | **BLOCKED — ACCOUNTING REVIEW · BLOCKED — OWNER DECISION** | Unchanged: demo issuer only, no VAT rule | Accountant; owner |
| P1‑03 Data rights | **PARTIALLY FIXED** | Export, requests, staff queue with a deletion gate, Stripe attestation, retention configuration, working due dates with on-track / due-soon / overdue indicators and staff-recorded extensions (never automatic), tests. "Disable sign-in only" is **DEFERRED — OWNER/PRODUCT DECISION** (not a defect: docs/LEGAL_RETENTION.md section 3). Stripe-side data is handled by hand. The legal response period is NOT VERIFIED (lawyer) | Owner; lawyer; accountant |
| P1‑04 Security | **PARTIALLY VERIFIED** (not "fully compliant") | New routes are rate-limited and tested; audit events exist for the new actions but not every one has its own test; production cookie security flags are NOT VERIFIED; see section 8 | Production check |

## 3. Defects found and fixed during this pass and the previous verification

1. Two web tests had been broken by the pricing change; the earlier "923 passed" figure was stale. Fixed.
2. `.env.example` and the production example still set `PRIVACY_NOTICE_VERSION` / `MARKETING_CONSENT_VERSION`, which would have overridden the registry. Removed; the settings now ignore any such value.
3. A staff-executed deletion could anonymise an account with a live Stripe subscription. Now fails closed on every non-final state.
4. The cookie policy claimed Cloudflare set no cookies at a check that was not made; replaced by what was actually observed.
5. **`PATCH /api/accounts/me`** would have discarded a pending name change when a marketing change was saved (found by a test while adding the row lock); the lock now comes first.
6. **A contract without checkout evidence was read as a business customer.** It now defaults to consumer for the first reading (staff decide), so a consumer is never told they "stated they are a business customer".
7. **The withdrawal acknowledgement was only queued**, waiting for a scheduled `outbox-run`. It is now dispatched at once (a failure stays queued and retries), because the Bulgarian act published in State Gazette 87/2026 asks for it no later than the end of the working day.
8. The confirmation button said "Потвърждавам отказа от договора"; it now says "Потвърждавам отказа" / "Confirm withdrawal", and the second step shows the account name and the e-mail the acknowledgement goes to.
9. An unset (`WITHDRAWAL_RETENTION_YEARS=`) variable crashed the settings; empty now means "not approved".
10. The production build failed on the extended registry type cast (not caught by the earlier type check); fixed.

## 4. What was implemented in this pass

* **Rate limits** (shared PostgreSQL windows, no IP stored, per account / workspace / staff member): data export, data requests and their list, withdrawal preview, confirmation, contracts and requests lists, every staff action in the legal queues, the public marketing withdrawal (per client and for the whole endpoint). Settings: `LEGAL_ACTION_RATE_LIMIT`, `LEGAL_READ_RATE_LIMIT`, `STAFF_ACTION_RATE_LIMIT`, `MARKETING_WITHDRAW_RATE_LIMIT`.
* **Duplicates and races:** partial unique indexes (migration 0024) for one acceptance per checkout and one confirmation per reference; the existing one-open-withdrawal and one-open-data-request indexes now answer a lost race as a repeat; consent changes and erasure lock the row; a late subscription event for an erased account is flagged in the audit log.
* **Seller identification** in the order review, from `company.ts`.
* **Self-service marketing withdrawal:** staff prepare a stable link (`POST /api/admin/compliance/leads/{id}/marketing-withdrawal-link`) with an HMAC token in the URL fragment, stored only as a hash; the page asks for one click; invalid, tampered and never-issued tokens get one answer; the history keeps the consent and adds a `self_service` withdrawal.
* **Retention configuration** (`WITHDRAWAL_RETENTION_YEARS`, `DATA_REQUEST_RETENTION_YEARS`, `LEGAL_CLEANUP_ENABLED`): empty by design; production refuses accounts or billing without them; cleanup tested with test periods; refunded withdrawals wait for the accounting period (docs/LEGAL_RETENTION.md).
* **Deletion gate** over every subscription state, open checkout and stale local state, with the Stripe attestation (matrix in docs/LEGAL_RETENTION.md).
* **Legal revisions:** draft/approved/published, per-language hashes, language pairing, a draft cannot back a live acceptance (config guard and checkout guard), docs/LEGAL_CONTENT_RELEASE.md.
* **Staff screens** "Legal requests" (BG and EN): lists with filters, details, audit trail, decisions with a manual refund reference, deletion blockers and attestation.
* **Browser tests** of order review, withdrawal, data rights, deletion safety and marketing consent, a cookie audit, axe accessibility checks and a responsive capture; a test-only stack (`docker-compose.legal-e2e.yml`, `scripts/test-legal-e2e.ps1`) with synthetic accounts and no Stripe.
* **Populated-database migration test** (synthetic data), documentation and an official-source package.

## 5. Tests actually executed (final code)

All in Docker on the developer's machine, on the final code (2026-11-10/11). Nothing was reused from earlier runs.

| Check | Command (container) | Exit | Result |
| --- | --- | --- | --- |
| Web type check | `npm run typecheck` (web-tests image, sources mounted) | 0 | no errors |
| ESLint | `npm run lint` | 0 | no findings |
| Web unit and component tests | `npx vitest run` | 0 | 71 files, **988 passed**, 0 failed, 0 skipped, 72 s |
| Legal version hashes, BG/EN pairing | part of vitest (`lib/legal-versions.test.ts`) | 0 | 6 passed; web and API copies byte-identical (`cmp`) |
| Production build | `next build` inside the web image (`docker compose up --build`) | 0 | built; an earlier build in this pass caught a type error (fixed) |
| Python lint | `ruff check app tests alembic` | 0 | all checks passed |
| Python formatting | `ruff format --check app tests alembic` | 0 | 220 files already formatted |
| Migrations | `alembic upgrade head` + `alembic check` | 0 | no drift |
| Migration on populated synthetic data | part of pytest (`tests/test_migration_legal_populated.py`) | 0 | 6 passed |
| Backend, full | `python -m pytest tests` (api-tests image, PostgreSQL 17) | 0 | **1 179 passed**, 0 failed, 0 skipped, 13 min 43 s |
| Rate limits, duplicates, concurrency, retention, deletion gate, self-service withdrawal, draft guard | part of pytest (`tests/test_compliance_hardening.py`) | 0 | 49 passed |
| Playwright, full suite, default stack (accounts off) | `docker compose --profile test run --rm e2e` | 0 | **294 passed**, 0 failed, 40 skipped (the account-only specs and the known-defect markers, which need the accounts stack), 15.4 min |
| Playwright, legal flows on the test stack (accounts and billing routes on, no Stripe) | legal-workflows, accessibility, cookie-audit, responsive-legal specs | 0 | **57 passed**, 0 failed, 71 skipped (public-page variants that run on the default stack), 3.2 min |
| Accessibility (axe-core, WCAG 2.0/2.1 A and AA, serious and critical) | part of both Playwright runs | 0 | no serious or critical violation on the pages and flows listed in docs/ACCESSIBILITY.md |
| BG/EN structural parity | vitest shape checks and the parity checks in the legal specs | 0 | same keys and section structure; meaning not machine-checked |
| Documentation sync | `python scripts/docs_sync.py` (re-run after the last documentation edit) | 0 | "docs in sync: openapi.json, API_REFERENCE.md routes, README links" |

**Not executed:** Safari and Firefox; real phones; a screen reader; a real Stripe test-mode checkout; anything against
staging; anything against the new build in production.


## 6. Not executed / not verified

* Any check against staging or production for the new build; the live site runs an older build.
* A real Stripe test-mode checkout, webhook and refund; the browser tests intercept the redirect to Stripe.
* Real-device and screen-reader testing; manual review of the new account and staff screens by a person.
* Delivery of e-mail to the contact address or from the transactional sender (docs/DNS_MAILBOX_VERIFICATION.md).
* Safari and Firefox (Chromium only).
* The whole Bulgarian and EU legal analysis beyond the provisions listed in docs/LEGAL_SOURCES.md.

## 7. Local versus production

All results above are from the local Docker stack (and, for the DNS and live-header observations, read-only requests from the
developer's machine on 2026-11-10). Nothing was run against staging. Production was only read: five public pages returned no
`Set-Cookie` header and no external host; the DNS records are in docs/DNS_MAILBOX_VERIFICATION.md.

## 8. Residual security risks

* Rate limits and audit events are tested for the new routes, but not every audit action has its own test.
* `Secure`, `HttpOnly` and `SameSite` flags are verified locally and by the production configuration guard; they are NOT verified on the live site for the new build.
* The marketing withdrawal token never expires (by design) and depends on `SECRET_KEY`; rotating the key invalidates links until staff prepare them again.
* A late Stripe event for an erased account is only flagged, not prevented.
* With accounts switched on the Bulgarian header overflows the screen at 1024 and 1440 px. It is release blocker **BLOCKER-ACC-HEADER-01**: the API refuses a production start with accounts on until the header is fixed in code (apps/api/app/release_gates.py).

## 9. Owner decisions required (none was made for you)

| # | Question | Default today | Evidence |
| --- | --- | --- | --- |
| 1 | Should the current Bulgarian public price schedule become the single BG/EN schedule? Yes / No | The Bulgarian schedule is shown in both languages; `PRICE_SCHEDULE_OWNER_APPROVAL = "pending"` | Exact before/after amounts: docs/PRICING.md |
| 2 | Should statutory-withdrawal refunds stay manually reviewed and manually executed? Yes / No | Manual; the system never refunds | docs/LEGAL_RETENTION.md |
| 3 | Should deletion stay blocked while any potentially chargeable Stripe state exists? Yes / No | Blocked (fail closed) | docs/LEGAL_RETENTION.md section 3 |
| 4 | Which SLA fields, if any, may be published? | None; "Договаря се в индивидуалния договор." / "Agreed in the individual contract." | `lib/sla.ts` |
| 5 | Which verified mailbox is approved for public contact, privacy requests, withdrawal confirmations, billing and transactional mail? | None approved or verified | docs/DNS_MAILBOX_VERIFICATION.md |
| 6 | Has a Bulgarian lawyer approved the exact BG and EN texts and their hashes? | No: every document is `draft` / `pending_lawyer_review` | docs/LEGAL_CONTENT_RELEASE.md |
| 7 | What retention periods for withdrawal and data requests? | None; nothing is deleted | docs/LEGAL_RETENTION.md |
| 8 | How should the header be laid out with accounts on (move the consultation button or the account links into a menu)? | Not decided; BLOCKER-ACC-HEADER-01 keeps accounts off in production | docs/ACCESSIBILITY.md |
| 9 | Is a separate "disable sign-in only" state wanted? | Deferred | docs/LEGAL_RETENTION.md section 3 |
| 10 | Which unified price schedule (decision record) | Not decided | docs/OWNER_DECISION_PRICE_SCHEDULE.md |

## 10. Blockers by who must act

* **Lawyer:** every legal text and wording; the withdrawal function, the start of the period, early start, proportionate payment, the acknowledgement timing; geo-blocking; cookie classification; the DPA template; Bulgarian provisions not read from an official source (docs/LEGAL_SOURCES.md).
* **Accountant:** retention of accounting and refund records, VAT treatment, who issues invoices, credit notes for refunds.
* **Owner:** items 1–8 above; the audit of staging and production for cookies; accessibility review with a screen reader.
* **E-mail provider / owner:** a verified contact mailbox, SPF, DKIM, DMARC, transactional sender.
* **Technical fix (after the owner's design decision):** the header overflow with accounts on (BLOCKER-ACC-HEADER-01).
* **External service:** a Stripe test-mode run end to end; Cloudflare and Turnstile cookie behaviour in production.

## 11. Feature flags (code defaults; the production `.env` was not read)

`CUSTOMER_ACCOUNTS_ENABLED=false`, `ADVISOR_WORKSPACE_ENABLED=false`, `BILLING_PROVIDER=disabled`, `INVOICING_SOURCE=none`,
`EMAIL_PROVIDER=disabled`, `ANALYTICS_ENABLED=false`, `LEGAL_CLEANUP_ENABLED=false`. The production guard refuses the
workspace, Stripe, sandbox billing, demo invoicing, `dev_file` mail, unapproved retention and unapproved texts when accounts or
billing are on, and the test-only `WORKSPACE_RATE_LIMIT_FLOOR`. `docker-compose.legal-e2e.yml` switches things on for a local
test stack only; `scripts/test-legal-e2e.ps1` restores the default afterwards.

## 12. Migrations

`0023` (legal events, withdrawal requests, data requests, four nullable columns) and `0024` (self-service token hash, two
partial unique indexes). Both additive. Validated: upgrade from base, downgrade by one, re-upgrade, `alembic check`, and a
populated synthetic database (tests/test_migration_legal_populated.py). **Rollback risk:** a downgrade after release drops the
evidence tables; roll the application back instead. Not applied to any production database.

## 13. Deployment readiness

Not ready for accounts, payments or invoicing. The public pages, footer and contact form could be deployed after a lawyer
reviews the texts and the owner approves the price list; the production configuration guard already refuses the risky flags.
Deployment, pushing and any production migration need the owner's explicit approval (CLAUDE.md).

## 14. Closure pass (2026-11-11)

This pass closed the items below and nothing else. It does **not** make every item complete: see "Deferred" and the
blockers. No legal text was changed in substance.

| # | Item | Result |
| --- | --- | --- |
| 1 | Withdrawal must not be hidden or blocked by the shared per-workspace limit | **DONE.** The four withdrawal routes resolve the workspace without the plan's shared limit and use dedicated limits (per workspace and per account) that answer 429 with `Retry-After`. A repeat for a contract with an open request returns it without using a limit. The section renders at one stable position, stays visible with the retry time and the e-mail alternative when its own data cannot load, and is hidden only when billing is off (404). API, component and browser tests |
| 2 | Deadline tracking for data-subject requests | **DONE (operational aid only).** `received_at`, `base_due_at` (1 calendar month, configurable), `extended_due_at`, `extension_reason`, `extension_notified_at`, `completed_at` (migration 0025, additive, backfilled); on-track / due-soon / overdue indicators in the staff screen; extension only as an audited staff decision; nothing extends automatically. Not a legal determination: the period is for the lawyer |
| 3 | "Disable sign-in only" | **DEFERRED — OWNER/PRODUCT DECISION** (not an implementation defect; docs/LEGAL_RETENTION.md section 3) |
| 4 | Header overflow with accounts on | **NOT FIXED — RELEASE BLOCKER BLOCKER-ACC-HEADER-01.** Measured: with accounts off only ~19 px are free at 1280–1440 px, so a fix needs a design decision. `apps/api/app/release_gates.py` makes the API refuse a production start with accounts on until the fix lands with `ACCOUNT_HEADER_LAYOUT_FIXED = True`; the browser test is tagged with the blocker id and marked `test.fail()` |
| 5 | Git reconciliation | Section 15 |
| 6 | Article 52a | Official source kept (State Gazette 87/2026); interpretation marked **NOT VERIFIED — BULGARIAN LAWYER MUST CONFIRM** (docs/LEGAL_SOURCES.md). Wording unchanged |
| 7 | E-mail delivery | **Hard go-live blocker kept and enforced:** production with accounts or billing refuses to start without the owner attestation `EMAIL_DELIVERY_VERIFIED=true`; operational checklist with 11 rows in docs/DNS_MAILBOX_VERIFICATION.md section 4. MX records are explicitly not treated as proof |
| 8 | Owner decision record for the unified price schedule | docs/OWNER_DECISION_PRICE_SCHEDULE.md: decision NOT TAKEN; current BG prices, previous EN prices, the change per offer, behaviour after merge, review status |
| 9 | Focused tests, then the full regression once | Section 16 |
| 10 | This report | Updated; it no longer implies that every item is complete |

## 15. Git state (2026-11-11)

**PR #73** (`content/bg-final-style-pass`): fix commit `15cba84` ("e2e: team configurator spec follows the renamed
lead-department label") pushed; CI 4/4 passed (API, Web, End-to-end, Client portal e2e). The PR was then **merged by
the owner** into `main` as `1e68688` (2026-11-10 21:23 UTC).

**`compliance/legal-remediation`** (this work): based on `ec25aa4`; **0 commits** of its own; **not pushed** (no remote
branch); **not deployed**; 0 staged files, 78 modified (unstaged) tracked files, 52 untracked files (45 `??` lines in
`git status --short`, because new directories collapse), 0 deleted, 0 renamed; `git diff --stat`: 78 files changed,
3 110 insertions, 318 deletions. It is **1 commit behind `origin/main`** (the PR #73 merge) and **0 ahead**. Six files
were changed on both sides and will need a merge with care before a PR: `README.md`, `apps/web/src/content/bg/offer-pages.ts`,
`tool-engineering.ts`, `tool-readiness.ts`, `tool-team.ts`, `apps/web/src/i18n/dictionaries/bg.ts` (after merging, the
legal-version hashes must be refreshed if a consent wording is touched). Generated artifacts: `docs/openapi.json`,
`apps/api/app/legal_versions.json` (copy of the web registry), the hashes in `apps/web/src/lib/legal-versions.json`,
`apps/web/e2e/package-lock.json`. **Secret scan** (pattern scan of all 130 changed and new files for live/test Stripe
keys, webhook secrets, cloud keys, private keys, tokens, JWTs, and literal password or secret assignments): **no
findings** (only UI labels such as "Парола"); no `.env` file is tracked. The placeholders in
`docker-compose.legal-e2e.yml` are named as such and are never sent to Stripe.

## 16. Tests of the closure pass (fresh)

**Focused, for the closure changes:** API `test_compliance_hardening.py`, `test_compliance.py`, `test_security.py`,
`test_production_features.py`, `test_workspace.py`, the migration tests (all passed); web component tests for the
account and staff screens (passed); browser: "withdrawal stays reachable …" (2) and the two BLOCKER-ACC-HEADER-01 markers
(expected failures) — 4 passed after one fix (the withdrawal section was remounted while the plan list loaded; it now
renders at one stable position).

**Full regression, once, on the final code:**

| Suite | Result |
| --- | --- |
| Web typecheck / ESLint | exit 0 / exit 0 |
| Web unit and component (vitest) | 71 files, **993 passed** (the first full run had 1 timeout in `company.test.ts` while three other suites loaded the machine; it passes alone in 3.5 s and the whole suite passed on the idle machine) |
| Production build | built inside the web image (`docker compose up --build`, exit 0) |
| Ruff lint / format | all checks passed / 222 files formatted |
| Alembic | upgrade to 0025, `alembic check`: no drift |
| API (pytest, full) | **1 191 passed**, 0 failed, 16 min 21 s |
| Playwright, default stack (accounts off) | **294 passed**, 0 failed, 42 skipped (account-stack-only tests), 15.5 min |
| Playwright, legal stack (accounts and billing routes on, no Stripe) | **59 passed**, 0 failed, 71 skipped (public-page variants that run on the default stack), 3.5 min |
| Documentation sync | see the last line of this section |
| Documentation sync after the last edit | `python scripts/docs_sync.py`: "docs in sync: openapi.json, API_REFERENCE.md routes, README links" (exit 0) |
