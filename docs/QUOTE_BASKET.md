# Quote basket

`/bg/zayavka` ↔ `/en/quote-request`. A draft **request for a written quote** that can hold several configured
projects and optional extras, kept on the server until the visitor sends it or it expires. Commercial expansion,
Phase 06.

It is not a shop cart: there is no checkout, no payment and no order. The only way out is "send the request", which
creates one lead that a person reviews. Every screen says the prices are indicative and not a quote.

**Off by default.** `QUOTE_BASKET_ENABLED=false` (API and web). While off, the page and the seven API routes answer
404 and the project configurator keeps its own quote form.

## What a basket is

| | |
| --- | --- |
| Holds | **Inputs only**: enumerated configurator answers, and the group and key of published offers. No amount, no contact detail, no free text |
| Items | `configuration` (the answers of the project configurator, [PROJECT_CONFIGURATOR.md](PROJECT_CONFIGURATOR.md)) and `extra` (one offer of the price schedule: a service, a care plan, an AI Managed Services level or a workshop). At most 8; the same extra cannot be added twice |
| View | Recomputed by the server on every request from the stored inputs and the published schedule (`app/quotes/service.py: view`): each line with its band or **requires assessment**, sums of the starting prices with one-time and monthly kept apart, the unpriced requirements, assumptions, exclusions and the reasons a person must review it |
| Owner | Whoever holds the secret token. Creating a basket returns the token once; the server stores only its SHA-256 |
| Lifetime | 30 days after the last change (`QUOTE_BASKET_DAYS`); every change extends it. A sent basket stays readable for 1 day. The daily maintenance job (`python -m app.cli maintenance`) deletes expired rows |

## Flow

1. With the basket on, the configurator's review ends in **Add to the request** instead of the contact form. The
   answers become an item (`POST /api/public/quote-basket`, or `POST …/items` when a basket exists) and the browser
   moves to the basket page. The configurator's session draft is removed.
2. On the basket page the visitor can add extras from the published offers, **change** a configured project (the
   configurator opens with its answers, `?item=<id>`, and the review ends in "Update the item"), **remove** items,
   or **delete** the whole request.
3. **Send**: name, company, e-mail, optional phone, goals and special requirements, the privacy acknowledgement and
   a separate marketing consent. The server creates one lead (`inquiry_type = quote`, `source = quote_basket`) with
   the view it computed, marks the basket as sent and notifies staff. The browser forgets the token.
4. Staff see the sums, the extras and one configurator panel per configured project on the lead.

Not in this phase: sign-in is not needed and not offered. Attaching a basket to a customer account is deferred to
the customer portal work (Phase 09, decision D-17); anonymous quote requests are how the existing contact and quote
forms already work.

## Security

* **Ownership.** The token (43 URL-safe characters from `secrets.token_urlsafe(32)`) travels in the
  `X-Basket-Token` header. It is never in a URL and never a cookie, so a cross-site request cannot carry it: the
  routes need no CSRF token because there is no ambient credential. There is no route that takes a basket id. An
  unknown token and an expired basket get the same 404.
* **No amounts in.** No request model has an amount field and unknown fields are refused (`extra="forbid"`). Tests
  send `price`, `amount`, `total`, `from` and `band` in every position.
* **Validation.** Item ids must be UUIDs, extras must exist in the price schedule (`unknown_offer`), configurations
  pass the configurator's rules (`unsupported_combination`). Items are stored as plain JSON built from validated
  values, never from the raw request.
* **Concurrent changes.** Every change names the version it saw (`expected_version`) and runs under a row lock. A
  stale version is refused with 409 `basket_changed`; the page then shows the current state and says so.
* **Duplicate sends.** Sending takes the same row lock: a second or simultaneous request finds the basket already
  sent and answers 200 with the first reference. One lead, one notification.
* **Rate limits.** `QUOTE_BASKET_RATE_LIMIT` per address and `QUOTE_BASKET_GLOBAL_RATE_LIMIT` per
  `QUOTE_BASKET_RATE_WINDOW_SECONDS` on every route, `QUOTE_BASKET_CREATE_RATE_LIMIT` on creating baskets, and the
  contact-form limits on sending. Sending also has the form token, the honeypot and the link and secret checks.
* **Rules that changed.** A stored configuration that no longer passes the current rules is shown as "needs an
  update", is left out of the sums and blocks sending (`basket_needs_update`) until it is edited.
* **Language and country** play no part in any line or sum.

## Browser storage

| Key | Where | What | When |
| --- | --- | --- | --- |
| `acs.quote-basket` | `localStorage` | the basket's secret token, nothing else | from the first item until the request is sent, deleted or found expired |
| `acs.configurator.<model version>` | `sessionStorage` | the configurator's enumerated answers | while a configuration is being filled in; removed when it is sent or added to the request |

Neither holds personal data. Both are new compared with the published cookie policy, which describes the browser
storage the site uses. **BLOCKER-COM-STORAGE-01** (`app/release_gates.py`) was closed on 2026-11-13: the policy now describes both keys (section 2) and `COMMERCIAL_STORAGE_DISCLOSED` is `True`; reopening it makes the API refuse both flags again (decision D-15). See [COOKIE_AUDIT.md](COOKIE_AUDIT.md).

## Database

Migration `0026` adds one table, `quote_baskets` (additive; the runtime role has no access, the API role may read,
add, change and delete):

| Column | |
| --- | --- |
| `id` | UUID |
| `token_hash` | SHA-256 of the holder's token, unique |
| `locale` | `bg` or `en` |
| `status` | `open` or `submitted` |
| `version` | counter for concurrent changes |
| `items` | JSONB list of inputs |
| `lead_id` | the lead created when it was sent (`ON DELETE SET NULL`) |
| `created_at`, `updated_at`, `expires_at`, `submitted_at` | |

Rollback: `alembic downgrade 0025` drops the table; no other table changes.

## Tests

| Suite | What |
| --- | --- |
| `apps/api/tests/test_quote_basket.py` | flag off = 404; token ownership and hash-only storage; add, edit, remove with recomputed lines; unknown offers, invalid identifiers and unsupported combinations; amounts in every position; size limit; stale versions; simultaneous changes; expiry, extension and the maintenance purge; discard; sending (lead content, no contact details in the basket, closed afterwards); double and simultaneous sends; refused sends; items that need an update; the admin view; rate limit; no dependence on language or country; the production blocker |
| `apps/web/src/components/quote/quote-basket.test.tsx` | the client library (token only in storage, header not URL, retry after a concurrent change, forgetting the token) and the page (empty state, lines and sums from the server, remove, add an extra, "changed elsewhere", one send on a double click, "needs an update") |
| `apps/web/src/components/configurator/configurator.test.tsx` | basket mode of the configurator: "add to the request", the request body, a full basket |
| `apps/web/e2e/tests/quote-basket.spec.ts` | default stack: nothing reachable. Commercial stack (`scripts/test.ps1 -Suite commercial`): configure → add → extra → edit → remove → send, with the sums checked against the pricing page and the storage keys checked at each stage; an English extras-only request and its deletion; a change in another tab; axe on the empty and the filled page; keyboard; 360–1440 px; the API (ownership, amounts, identifiers, one lead) |

The commercial runner makes two passes: every flag on, then the basket off, so the configurator's own quote form
stays covered in a browser.
