# Release review: accounts, paid tools, billing and invoicing

Date: 2026-11-04. Scope: `feature/client-zone` on top of `main` at `a8b96b5`.

**Verdict: the code may ship switched off. Nothing here may be switched on yet.** Everything is behind
flags, and production refuses to start with the workspace, Stripe or demo documents on.

"Verified" below means it was run. "Not verified" means it was not, whatever the code looks like.

## 1. Technical checks

### Verified

| Check | Evidence |
| --- | --- |
| Regressions on public pages, tools and lead forms | Playwright e2e suite, `public`, `contact`, `tools`, `seo`, `links` specs: 204 of 205; the one failure was `admin.spec.ts`, see below |
| BG/EN parity of account and client area routes | `/bg/konto/...` and `/en/account/...` opened in a browser; language switch works |
| Language of e-mails | Unit tests for both; a BG verification e-mail read from a local `.eml` file |
| Verification and recovery, expired and reused tokens | `test_accounts.py`; reuse also tried by hand: first 204, second 400 `token_invalid` |
| Tenant isolation and roles | `test_zone.py`, `test_workspace.py`, `test_accounts.py`: each role per operation, outsiders 404 |
| API runs without owner rights | Whole API suite runs as `acs_app_api` (`test_api_login_role.py`) |
| Paid API protection | `test_workspace.py`: free plan calling paid routes directly, a test that walks every route |
| Parallel use and quota accounting | `test_workspace.py`: limits under 8 parallel requests, duplicates run the model once. It found a real deadlock, now fixed |
| Successful and failed payments | `test_billing.py`, against a **fake** Stripe |
| Duplicate, delayed and reordered webhooks | `test_billing.py`, with real signature checks |
| Renewal, cancellation, refund, reconciliation | `test_billing.py`, against a **fake** Stripe |
| Issuing and access to invoices | `test_zone.py`, with the **demo** issuer |
| Mobile | Client area at 375 px: no horizontal overflow, every field labelled (`/bg/konto/fakturi`) |
| no-store for personal data | Measured: account pages send `private, no-cache, no-store`; API routes send `no-store`. Missing on account routes until this review, now fixed |
| Backup and restore rehearsal | Local: `pg_dump` to a new database, 75 tables, version, row counts and the document trigger all matched |
| Schema compatibility with the old version | Local: code at `6e0a4e1` started against schema `0021`, read leads and refused a bad sign-in |
| Flags on, in a real browser | Local: sign-up, confirmation, sign-in, project, assessment, support request and client area pages |

Suites on this branch: API 1061 of 1061, portal 1 of 1, e2e 204 of 205. The web suite failed on a lint
error and `admin.spec.ts` on a selector that found a reference twice. Both are fixed; see the pull request
checks for the final result.

### Not verified

| Check | Why | Needed |
| --- | --- | --- |
| Real Stripe sandbox | No test keys | Owner's sandbox, then the table in `STRIPE_BILLING.md` |
| Apple Pay, Google Pay, PayPal behaviour | Same; also needs real devices | Sandbox and devices |
| Real e-mail delivery | No sending provider | A provider, tested end to end |
| A real accounting issuer | None chosen | The decision in `INVOICING.md` |
| Real AI model in the workspace | `AI_PROVIDER=mock`; tests use a stand-in | Approved AI use |
| Screen reader and full keyboard pass | Only labels and overflow were checked | A manual accessibility pass |
| Restore on the production server for this schema | Rehearsed locally only; the server's own restore test predates it | A rehearsal after migration |
| Staging deployment | **No staging environment exists** | See section below |
| Load | Not tested | Before a public launch |
| Turnstile and Cloudflare rules | Not applied | `infra/cloudflare/README.md` |
| External penetration test | Not done | Required before public sign-up |

## Release plan

Migrations `0016` to `0021` only add tables, roles, policies and a trigger, with these narrow exceptions:
`0016` widens two CHECK constraints, and `0018` adds `acs_purge_audit_logs`, which the retention job needs.
So the order is expand first, and old code keeps working on the new schema.

Flags, all off by default: `CUSTOMER_ACCOUNTS_ENABLED`, `ADVISOR_WORKSPACE_ENABLED`, `BILLING_PROVIDER`,
`INVOICING_SOURCE`, `EMAIL_PROVIDER`.

**Staging:** there is none. Until one exists the local stack with flags on is the only rehearsal, and
that is a real gap: it has no Cloudflare, no Caddy and no production data shape. Recommended before
switching anything on, using a second Compose project on a separate small server, not on production.

Steps for a code-only release, with everything off:

1. Start Release with `migrate-and-deploy` from `main`. Do not use `deploy` while migrations are pending.
2. Approve the `production` environment.
3. Smoke checks: `live_check` (43 checks), `/api/health/ready`, a test inquiry, staff sign-in with MFA,
   and `/bg/konto` returns 404.
4. Confirm `alembic_version` and that a backup was written.

## Rollback

Do not roll the database back. `acs-deploy` redeploys the previous image, and additive migrations stay
in place. Old code ignores tables it does not know.

* Rolling back past `0016` code while a lead uses one of the six new service keys may break that lead in
  the old staff screens. Check before rolling back that far.
* Billing history stays: rollback never touches `billing_*` or `accounting_documents`.
* **Stopping the interface does not stop Stripe.** Subscriptions keep renewing and charging. Once real
  charging exists, a rollback must keep the webhook endpoint answering, or events pile up and retry for
  only 3 days. If the new code is gone, run `billing-reconcile` after redeploying: it fetches 72 hours of
  events and re-reads every subscription. For a longer outage, pause collection in Stripe first.
* If `ADVISOR_WORKSPACE_ENABLED` is turned off with paying customers, they lose the pages but not the
  subscription. Decide in advance how to pause or refund them.

## Readiness by area

| # | Area | State | Owner of the next step |
| --- | --- | --- | --- |
| 1 | Technical checks | Code ready to ship switched off. Gaps listed above | Developer, then owner |
| 2 | Merchant and provider activation | **Not started.** Stripe verification, PayPal, a sending e-mail provider, an accounting issuer | Owner |
| 3 | Confirmed prices and limits | **Not started.** No offer approved; plan limits are starting values | Owner |
| 4 | Accounting settings | **Not started.** No tax scenario, numbering or retention confirmed | Accountant |
| 5 | Terms | **Not started.** Payment, renewal, cancellation, privacy and refund terms not reviewed | Lawyer, owner |
| 6 | Approval of the production release | Per release, in GitHub | Owner |

Off-site backup and alerts are also still missing, and the SaaS plan's gate G0 requires them.
Also before public sign-up: account deletion and export, row-level security on workspace tables, and an
external penetration test.

## Found and fixed in this review

* Account routes did not send `no-store`.
* Counters could deadlock under parallel use (found earlier by the parallel test).
* The web suite's lint rule rejected the export link.
