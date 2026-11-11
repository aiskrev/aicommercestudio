# Customer accounts: verification and hardening (Phase 08)

Commercial expansion, Phase 08. This phase builds **no second authentication system** and does not enable public
registration. It checks the existing customer identity layer ([CUSTOMER_ACCOUNTS.md](CUSTOMER_ACCOUNTS.md)) against the
list in the programme, closes the gaps it found, links quote requests to accounts through verified ownership only, and
turns the go-live prerequisites into tests. Customer accounts stay behind `CUSTOMER_ACCOUNTS_ENABLED=false`.

The three identities stay separate: staff (`acs_session`), customer accounts (`acs_account_*`) and the AI Operations
portal (`acs_portal_*`). A staff cookie opens no customer route, and a customer session opens no staff or portal route
(tested for every route below).

## Verification matrix

| Area | Result | Evidence |
| --- | --- | --- |
| Registration | OK. E-mail, password (strength rules), optional name, language, privacy acknowledgement; marketing consent separate, optional, unticked; no invoice data; same 202 for new and existing addresses | `test_accounts.py` (registration, enumeration, weak password, consent tests) |
| E-mail verification | OK. One-time link, 24 h, sign-in refused until confirmed; a resend replaces the earlier link and sends nothing once confirmed | `test_accounts.py` (token, expiry, purpose, resend tests) |
| Sign-in | OK. Generic error for unknown, wrong and locked; `email_not_verified` only after a correct password; dummy hash for unknown addresses; lockout after repeated failures without saying so; per-IP and per-address limits; a new session on every sign-in | `test_accounts.py`, `test_accounts_hardening.py` (new session per sign-in, token stored as a hash) |
| Sign-out | OK. Revokes the session on the server and clears both cookies | `test_accounts.py`, `test_accounts_hardening.py` |
| Password reset | OK. One-time link, 1 h, closes every session, confirms the mailbox | `test_accounts.py` |
| Session management | OK. List, close one, close all others; password change closes the others; 12 h lifetime and 2 h idle limit; another account's session answers 404 | `test_accounts.py` |
| Profile | OK. Name, language, marketing consent with its version and history (consent and withdrawal recorded in `legal_events`) | `test_accounts.py`, `test_compliance*.py` |
| Language preference | OK. Used for the page and for e-mail | `test_accounts.py` |
| Marketing consent | OK. Optional at registration, changeable in the account, history append-only | as above |
| Account security | OK, see "Security requirements" below | |
| Account export | OK (built with the compliance foundation): `GET /api/accounts/data/export`, never includes password or token hashes | `test_compliance*.py` |
| Account deletion request | OK: `POST /api/accounts/data/requests` (kind `deletion`), carried out by an administrator; the answer says "received", never "deleted" | `test_compliance*.py` |
| **Account status** | **Gap, closed.** `/me` now returns `email_verified`, `created_at`, `privacy_notice_version` and `status` (`active` or `deletion_requested`), read-only; the account page shows it. The profile route refuses these fields | `test_accounts_hardening.py`, `quoteRequests.test.tsx`, `account-requests.spec.ts` |
| Workspace membership | Unchanged and off with the workspace flag: invitations and membership roles are explicit, never by e-mail domain | `test_workspace.py` |
| **Quote requests and accounts** | **New, ownership-checked, read-only.** See below | `test_accounts_hardening.py`, `account-requests.spec.ts` |

### Findings fixed in this phase

1. **Erased accounts (defence in depth).** `require_account` did not look at `erased_at`; erasure removes every session,
   so nothing was exploitable, but a surviving session of an erased account would have worked. It is now refused and the
   session is revoked.
2. **No account status.** Added (above).
3. **No systematic route check.** Every route that depends on the customer session is now discovered from the
   application itself and checked for 401 without a sign-in, for 403 without the CSRF token and for a staff cookie
   (about 100 parametrised tests across `/api/accounts`, `/api/workspace`, `/api/zone` and `/api/billing`). A new route
   cannot be added without authentication and CSRF protection: the tests find it.
4. **Cookie attributes in production were only partly tested.** Both cookies are now checked for `Secure`,
   `SameSite=Lax`, `Path=/`, the lifetime, and `HttpOnly` on the session cookie only (the double-submit token must be
   readable by the page).
5. **The legal e2e stack was not hermetic.** It reused the development database, so a second run failed on data from the
   first. Each run now creates an empty throwaway database (`acs_legal_e2e`) and drops it afterwards; the default
   database is never touched (`scripts/test-legal-e2e.ps1`, `docker-compose.legal-e2e.yml`).

## Quote requests and accounts

`GET /api/accounts/quote-requests` (`app/routers/account_requests.py`), off with customer accounts.

* **Ownership.** A request belongs to an account when it was sent **from the account's own address**, and the account
  has a live session, a **verified** e-mail and is not erased. The comparison is on the trimmed, lower-cased address.
  Nothing is matched by company, name, phone, domain or IP. Registering with someone else's address gives access to
  nothing: the mailbox must be confirmed before sign-in is possible.
* **What is shown.** Reference, date, kind (enquiry, quote request, configured project, basket request, tool enquiry),
  the service and, while quotations are on, only the *state* of the quotation. Never contact details, free text, staff
  notes, the pipeline status, a quotation link or a quotation's content: the link is the credential and staff hand it
  out themselves ([QUOTATIONS.md](QUOTATIONS.md)).
* **Anonymous routes unchanged.** `POST /api/public/leads`, `/quote-requests`, the configurator and the basket need no
  account and never create, change or sign in an account (tested for a signed-in and an unregistered sender).
* **Not built, on purpose:** attaching a basket or a quotation to an account, "claim by reference", changing the address
  of an account. Linking an accepted quotation to a customer project is Phase 09 (D-19).
* **Limits.** 50 newest rows; read rate limit shared with the other account reads.

## Security requirements

| Requirement | State |
| --- | --- |
| Secure session cookies | `Secure` in production (`COOKIE_SECURE`, refused if false); tested |
| HttpOnly | Session cookie only; the CSRF cookie is readable by design |
| SameSite | `Lax` on both. The sign-in e-mail links land on a page of the site, so `Strict` would drop the session on the first navigation |
| CSRF | Double-submit token on every state-changing call of a session, on top of the API's Origin check; checked for every route |
| Server-side access enforcement | Every customer route depends on `require_account`; tenants and workspaces are checked per route; discovered and tested |
| Rate limits | Shared in PostgreSQL: per IP and per address on sign-in, recovery, resend, registration; per account on password change, data actions and reads |
| One-time tokens, expiry | Hashed at rest, row lock on use, purpose-bound, 24 h (verify) and 1 h (reset) |
| Password hashing | Argon2 with rehash on sign-in |
| Enumeration protection | Same 202 and same timing for known and unknown addresses; one generic sign-in error |
| Session revocation | Logout, reset, password change, "close all others", erasure; idle and absolute expiry |
| Brute force | Per-IP and per-address limits and a time-boxed lockout that does not say so |

## Go-live prerequisites, tested

Production refuses to start with `CUSTOMER_ACCOUNTS_ENABLED=true` unless every item holds. A test starts from a
configuration that satisfies all of them and then breaks one at a time, so none can be dropped by accident
(`test_accounts_hardening.py`):

1. an e-mail provider that really sends (not `disabled`, not `dev_file`), with host and sender;
2. the restricted database role (`acs_app_api`);
3. `EMAIL_DELIVERY_VERIFIED` after the mailbox, SPF, DKIM and DMARC were checked ([DNS_MAILBOX_VERIFICATION.md](DNS_MAILBOX_VERIFICATION.md));
4. approved retention periods for withdrawals and data requests ([LEGAL_RETENTION.md](LEGAL_RETENTION.md));
5. no legal text pending lawyer review ([LEGAL_CONTENT_RELEASE.md](LEGAL_CONTENT_RELEASE.md));
6. no open release blocker (`BLOCKER-ACC-HEADER-01` is closed);
7. `COOKIE_SECURE`, `https://` site URL and origins, no placeholder secret.

A production start **without** the flag opens nothing: the default is `false`, and nothing in this phase changes it.
The remaining go-live steps (a sending provider, a backup and `migrate-and-deploy`, the outbox timer) are in
[ACCOUNTS_GO_LIVE.md](ACCOUNTS_GO_LIVE.md) and need the owner.

## Still open (not done here)

| Item | Note |
| --- | --- |
| Customer MFA | Not built. Decision D-22: the owner decides whether customers need a second factor before accounts go live |
| Changing the sign-in e-mail address | Not built; an address change needs verification of both addresses and would affect the ownership rule above |
| Bounce handling | Delivery status stops at provider acceptance (needs a provider webhook) |
| Mailbox and provider, lawyer review, retention | Owner, lawyer and accountant decisions listed in [COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md) |
| Real-device and screen-reader review of the account pages | Not done |

## Tests

| Suite | What |
| --- | --- |
| `apps/api/tests/test_accounts_hardening.py` | route discovery; 401 without sign-in, 403 without CSRF and a staff cookie, for every session route; cookie attributes; session token hashing; a new session per sign-in; account status; erased accounts; the status fields cannot be patched; the go-live prerequisites one by one; quote-request ownership (own address only, verified, case and whitespace, no company or name matching, no cross-account, anonymous routes unaffected, flag, rate limit, quotation state without link or content) |
| `apps/web/src/components/account/quoteRequests.test.tsx` | the list shows only server data, empty and failed states, texts in both languages, the status block and a pending deletion request |
| `apps/web/e2e/tests/account-requests.spec.ts` | legal stack: status and own requests, another customer and a stranger's request, anonymous sending still works, 401 without sign-in, axe and 360 px |
