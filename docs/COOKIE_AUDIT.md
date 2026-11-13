# Cookie and browser-storage audit

Status: **PARTIALLY FIXED. Locally verified inventory; production inventory NOT VERIFIED; classification BLOCKED — LEGAL REVIEW.**
The cookie policy lists what the application sets. This page records how that was checked, with the evidence class of
each item, and how to repeat the check against staging or production. It does not classify any cookie under the consent
rules: **`acs_locale` and the other cookies are not declared "strictly necessary" anywhere** until the lawyer decides
(docs/LEGAL_SOURCES.md, section 4).

## Evidence classes

| Class | Meaning |
| --- | --- |
| **code-declared** | Read in the source (`document.cookie =`, `set_cookie`, `sessionStorage`) |
| **locally observed** | Seen in a real browser run against the application on the local Docker stack, without Cloudflare in front |
| **feature-gated** | Exists only when a switch is on (accounts, portal, Turnstile) |
| **third-party documented** | A third party's own documentation says it may set something; not observed here |
| **production observed** | Seen on the live site; says nothing about builds that are not deployed yet |
| **NOT VERIFIED** | Not checked |

## Inventory

| Item | Created by the application? | Evidence |
| --- | --- | --- |
| `acs_locale` (cookie, up to 12 months, `SameSite=Lax`, readable by script) | Yes, only when the visitor uses the language switcher | code-declared (`LanguageSwitcher.tsx`); locally observed (cookie-audit step 2); production: NOT VERIFIED |
| `acs_cookie_notice` (cookie, up to 12 months) | Yes, when the notice is closed | code-declared (`CookieNotice.tsx`); locally observed (step 3) |
| `acs_session`, `acs_csrf` (staff) | Yes, at staff sign-in; `HttpOnly` for the session, the CSRF token is readable by script | code-declared (`admin_auth.py`); locally observed (staff step: names, `HttpOnly`, `SameSite=Lax`); `Secure` in production: NOT VERIFIED |
| `acs_account_session`, `acs_account_csrf` | Yes, at customer sign-in, only with `CUSTOMER_ACCOUNTS_ENABLED` | code-declared (`routers/accounts.py`); feature-gated; **not yet audited in a browser against a real sign-in with the production flags: NOT VERIFIED** (the legal e2e stack signs in, but the audit spec does not yet snapshot those cookies) |
| `acs_portal_session`, `acs_portal_csrf` | Only with the client portal on (off) | code-declared; feature-gated; NOT VERIFIED |
| `sessionStorage` `acs-quote-bar-dismissed`, `acs:roi:process` | Yes, on user action | code-declared; locally observed to stay empty on a plain visit |
| `sessionStorage` `acs.configurator.<model version>` | Yes, only with `PROJECT_CONFIGURATOR_ENABLED` and only while a visitor fills in the configurator: enumerated answers, no personal data; removed when the configuration is sent or added to the request | code-declared (`ProjectConfigurator.tsx`); feature-gated (off); locally observed on the commercial test stack (`quote-basket.spec.ts` checks the keys); described in section 2 of the cookie policy since 2026-11-13 (BG and EN, draft revision under version id `2026-11-13`); BLOCKER-COM-STORAGE-01 closed |
| `localStorage` `acs.quote-basket` | Yes, only with `QUOTE_BASKET_ENABLED` and only after a visitor adds an item to a quote request: the secret token of the draft, nothing else; removed when the request is sent, deleted or found expired | code-declared (`lib/quote-basket.ts`); feature-gated (off); locally observed on the commercial test stack; described in section 2 of the cookie policy since 2026-11-13 (BG and EN, draft revision under version id `2026-11-13`); BLOCKER-COM-STORAGE-01 closed |
| `localStorage` (anything else), IndexedDB | None found in the source | code-declared; locally observed (empty at every step of the default audit) |
| Cloudflare cookies (for example bot management) | Not by the application | third-party documented; the local run has no Cloudflare; **production: single GET requests to 5 public pages on 2026-11-10 returned no `Set-Cookie` header** (production observed, older build, no JavaScript, one visit); anything Cloudflare sets after a challenge or for other visitors: NOT VERIFIED |
| Turnstile | Script from `challenges.cloudflare.com` only on the account forms and only with `TURNSTILE_ENABLED=true` (CSP allows the host only then) | code-declared; feature-gated; what it stores or sets: NOT VERIFIED (check when enabled) |
| Stripe Checkout / portal | Not by this site; they run on Stripe's own domain; no Stripe script is loaded in our pages | code-declared; Stripe's own storage: NOT VERIFIED (third-party documented only) |
| Analytics / advertising / tracking | None; site statistics (when on) use no cookies and no storage | code-declared; locally observed (no tracking-named cookie, no third-party host) |

## What the repeatable audit does

`apps/web/e2e/tests/cookie-audit.spec.ts` records, from a fresh browser: cookies before any interaction; after choosing a
language; after closing the notice; after opening the contact, legal, services and tools pages; localStorage and
sessionStorage at every step; every host the pages talk to; every `Set-Cookie` response header; and, when
`E2E_STAFF_PASSWORD` is set, the staff cookies and their flags. The result is attached as `cookie-audit.json` and printed
as `COOKIE_AUDIT {...}`. It lists what it could not run (customer account cookies, Turnstile, Stripe).

On the local stack it asserts the exact expectation (nothing before interaction; `acs_locale` after the language choice;
`acs_cookie_notice` after closing the notice; no external host; no `Set-Cookie` on public pages). Against any other
environment run it report-only, so an unexpected cookie is a finding rather than a failure:

```bash
COOKIE_AUDIT_REPORT_ONLY=1 E2E_BASE_URL=https://staging.example docker compose --profile test run --rm -e COOKIE_AUDIT_REPORT_ONLY=1 -e E2E_BASE_URL e2e npx playwright test tests/cookie-audit.spec.ts
```

It still fails on anything the privacy documents say can never happen (a cookie named like analytics or advertising,
localStorage use, an unlisted sessionStorage key).

## Still to do (owner and lawyer)

- Run the audit against staging and, once the new build is deployed, against production (both languages, after sign-in
  with accounts on, with Turnstile on if it will be on, and through a real Stripe test checkout with the browser's
  storage inspected).
- The lawyer decides how each cookie is classified and whether any needs consent or a different notice. If an optional
  technology is ever added, a consent mechanism must exist first; none is implemented because none is needed today.
