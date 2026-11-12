# Commercial expansion: release review (Phase 18)

Status on 2026-11-12. **The programme stops here, at the release approval gate.** Phases 01 to 18 are implemented and tested in the
working tree. Phases 01 to 08 are committed and pushed (pull requests #75 and #76 are merged). **Phases 09 to 18 are committed locally in `42df564`, not
pushed, not merged and not deployed.** Nothing was changed on any server, in Cloudflare, in Hetzner or in Stripe; no real e-mail was sent; no key was
issued; production was not touched. The customer-facing commercial features (configurator, basket, quotations, projects, documents, project e-mail) are behind flags that are **off**. The admin CRM (admin role only), the stateless demonstrations and the anonymous funnel events have no flag by design (D-40, D-44, D-46).

The master prompt names this document `COMMERCIAL_EXPANSION_RELEASE_REVIEW.md`; the file kept its shorter name. An independent audit of it is in [COMMERCIAL_EXPANSION_FORENSIC_AUDIT.md](COMMERCIAL_EXPANSION_FORENSIC_AUDIT.md).

Read with: [COMMERCIAL_EXPANSION_PROGRESS.md](COMMERCIAL_EXPANSION_PROGRESS.md) (per-phase checkpoints and the executed results),
[COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md) (D-01 to D-50), [COMMERCIAL_STAGING_RUNBOOK.md](COMMERCIAL_STAGING_RUNBOOK.md)
(order of switching on, Cloudflare and Hetzner checklists, rollback) and [SECURITY_GDPR_REVIEW_COMMERCIAL.md](SECURITY_GDPR_REVIEW_COMMERCIAL.md).

## 1. What was built

| Phase | Result | Switch | Migration | Doc |
| --- | --- | --- | --- | --- |
| 01 | baseline audit, roadmap | – | – | COMMERCIAL_EXPANSION_AUDIT, _ROADMAP |
| 02 | homepage entry points; header layout with accounts on | – | – | progress |
| 03 | project packages page | – | – | – |
| 04 | one price schedule shared by web and API; pricing page | – | – | PRICING |
| 05 | project configurator | `PROJECT_CONFIGURATOR_ENABLED` | – | PROJECT_CONFIGURATOR |
| 06 | quote basket | `QUOTE_BASKET_ENABLED` | 0026 | QUOTE_BASKET |
| 07 | quotations to a client, human-approved versions, one answer | `QUOTATIONS_ENABLED` | 0027 | QUOTATIONS |
| 08 | customer accounts verified and hardened; own quote requests | existing | – | ACCOUNTS_HARDENING |
| 09 | customer projects: lifecycle, roles, scope snapshot | `COMMERCIAL_PROJECTS_ENABLED` | 0028 | COMMERCIAL_PROJECTS |
| 10 | project documents, versions, approvals, private storage, uploads | `PROJECT_DOCUMENTS_ENABLED`, `PROJECT_UPLOADS_ENABLED`, `PROJECT_CLIENT_UPLOADS_ENABLED` | 0029 | PROJECT_DOCUMENTS |
| 11 | project e-mail through the existing outbox | `PROJECT_NOTIFICATIONS_ENABLED` | 0030 | PROJECT_NOTIFICATIONS |
| 12 | admin CRM on the existing admin: owner, follow-ups, overview, timeline, export | none (admin role only) | 0031 | ADMIN_CRM |
| 13 | billing validation: sandbox matrix, four kinds of sale, no deposit | – (live and Stripe refusals unchanged) | 0032 | BILLING_SANDBOX_MATRIX |
| 14 | eight public interactive AI demonstrations on invented data | none (stateless, no provider) | – | AI_DEMONSTRATIONS |
| 15 | SEO rules for the new pages, six funnel events, page-weight tests | – | – | ANALYTICS, SEO_IMPLEMENTATION |
| 16 | security and GDPR review, data map, retention of stored files, staff view logging | – | – | SECURITY_GDPR_REVIEW_COMMERCIAL |
| 17 | staging runbook, Cloudflare and Hetzner checklists, release gates | – | – | COMMERCIAL_STAGING_RUNBOOK |
| 18 | this review | – | – | – |

All migrations are additive and exist only in local and test databases.

## 2. Executed on the final state

Each suite was run through `scripts/test.ps1` in Docker; the order was docs sync, `api`, `web`, `e2e`, `commercial`, `legal` (one sequence), then the
failures were fixed and the affected parts re-run.

| Check | Result |
| --- | --- |
| API (`pytest`, ruff check and format, docs sync, the hash checks of the shared files) | **1628 passed, 1 skipped** (the skipped one needs the web copy mounted); ruff and docs sync clean |
| Web (typecheck, lint, unit) | **84 files, 1099 tests passed** (one test of the sequence failed on a label that changed with a hint text; fixed and re-run) |
| End-to-end, default stack (every commercial flag off) | **341 passed, 93 skipped, 0 failed** on the committed tree (the first sequence had 338 passed and one CRM sign-in timeout, fixed by one shared sign-in) |
| CRM spec re-run after the fix | **5 passed** |
| Commercial stack (flags on, two passes: basket on and off) | **32 passed, 3 skipped** and **12 passed, 1 skipped** |
| Legal stack (accounts, projects, documents, notifications on; throwaway database) | **66 passed, 1 skipped**. In the sequence one test of `legal-workflows.spec.ts` failed (a contact form not confirming); the spec alone (25 passed) and the whole suite again (66 passed) were green, so it is recorded as an **unexplained flake**, not a fixed defect |
| Dependency audits (`-Suite audit`) | pip-audit: no known vulnerabilities; npm audit: 0 vulnerabilities |
| Focused additions | documents 62, notifications 16, CRM 18, billing matrix 11, demonstrations 37, data map and privacy 13 |

The focus of the tests is listed per phase in the documents above; the main guards are: cross-tenant access answers 404, every customer route
needs a session and a CSRF header, editors and viewers get 403 on all customer data, no price comes from a quote, an approval is made once, uploads are
checked by name and content, nothing the demonstrations receive is obeyed or echoed, and no export carries personal data.

## 3. Gates that are still open (production refuses these until recorded)

| Gate | State | What closes it |
| --- | --- | --- |
| BLOCKER-COM-STORAGE-01 | open (D-15) | the cookie policy describes the configurator's `sessionStorage` and the basket's `localStorage` token and is approved; the constant is changed in the same commit |
| BLOCKER-COM-ACCEPT-01 | open (D-06) | the meaning and the wording of a client's answer to a quotation are approved by the owner and a lawyer |
| BLOCKER-COM-UPLOAD-01 | open (D-31, D-32, D-33) | the upload policy and the security review are recorded; a scanner is chosen or running without one is accepted; backup of the storage volume exists |
| `EMAIL_DELIVERY_VERIFIED` | not set (D-05) | the mailbox, the sending domain, SPF, DKIM and DMARC are verified |
| Live billing | refused everywhere | the owner, the accountant and a lawyer decide (D-04, D-11, D-12, D-42, D-43) |

## 4. Decisions waiting for the owner, the lawyer or the accountant

D-04 price schedule · D-05 mailbox and sending domain · D-06 and D-25 meaning and wording of the client's answers · D-07 upload policy · D-08 and D-42 project
deposit · D-09 two smaller package prices · D-13 switching the configurator on · D-15 cookie policy text · D-22 customer MFA · D-28 retention of customer projects ·
D-30 switching customer projects on · D-31, D-32, D-33 uploads, scanning, storage and its backup · D-36 and D-37 project e-mail wording and opt-out · D-43 Stripe test keys
for the real sandbox run · D-47 Lighthouse before release · D-48 scheduling the retention job. The full rows, with the default used meanwhile, are in the decisions file.

## 5. What was NOT verified

* **A real Stripe sandbox** (no test keys): the matrix is verified against a fake gateway only. **Real e-mail delivery**: no provider, no verified domain.
* **Real devices, a screen reader, a person's review** of the new pages, the wording of the approvals and of the e-mail, and any legal text.
* **Core Web Vitals** of the new pages (Lighthouse was not re-run); only the page-weight and no-third-party tests exist.
* **A scanner for uploads**: none exists; scanning is a recorded result, not a function of this system. **Load or denial-of-service** behaviour; a penetration test.
* Backup and restore of the `project_files` volume; scheduling of `maintenance`, `outbox-run`, `billing-run`, `billing-reconcile`: no timer is installed.
* Behaviour on a real staging server: nothing was deployed there. The runbook says what to check.

## 6. How to take it further (the owner's call)

1. **Review** the working tree (`git status`) and these documents. Phases 09 to 18 are one local commit (`42df564`); the branch is `feature/commercial-expansion`, which already contains phases 01 to 08.
2. **Push** the branch (phases 09 to 18 are already committed locally in `42df564`); open a pull request against `main`. The pull request description can be built from the checkpoints of the progress file.
   CI runs the API, web, end-to-end and client-portal jobs; the commercial and legal suites are local (`scripts/test.ps1 -Suite commercial`, `-Suite legal`).
3. **Deploy to staging only**, following [COMMERCIAL_STAGING_RUNBOOK.md](COMMERCIAL_STAGING_RUNBOOK.md): migrations `0026` to `0032` are additive; every feature starts off.
4. **Production**: nothing in this work needs to be switched on for production, and three gates stay open on purpose. A production release needs the owner's approval and the
   decisions above; the commit that closes a gate is the commit that records its approval.

**Stop.** This review ends the programme at the release approval gate. No deployment, commit or push is made without the owner.
