# Quotations: from a configured enquiry to a client-facing, human-approved offer

Commercial expansion, Phase 07. It connects the configurator and the quote basket to the **existing** opportunity and
proposal workflow ([OPPORTUNITY_WORKFLOW.md](OPPORTUNITY_WORKFLOW.md)) and, behind a flag, lets a client read the
approved version and answer once.

Nothing is sent by the system. A proposal is never shown to a client unless a person completed it, approved it and
then chose to publish it.

## The path

```text
configurator / basket ──▶ lead (one per submission) ──▶ opportunity (staff save it) ──▶ proposal draft ──▶ review
        │                       │                                                          │
   enumerated answers      service_details:                                  human completes + approves
   + server review         answers, review,                                              │
                           basket view                                    publish (QUOTATIONS_ENABLED)
                                                                                         │
                                       secret link, shown once ──▶ staff send it themselves ──▶ client reads, answers once
```

| Step | What happens | Where |
| --- | --- | --- |
| Submit | A configured enquiry or a sent basket creates **one lead** (a repeated submission id or a sent basket returns the first lead: no duplicates from retries). The lead stores the versioned snapshot: `model_version`, the answers and the review the server computed, or the basket view | `app/configurator/service.py`, `app/quotes/service.py` |
| Opportunity | One per lead by construction (`lead_opportunities.lead_id` is the primary key). Staff open the lead and see the opportunity form **pre-filled** with the package and the client's choices; nothing is saved until they save it | `app/opportunities/service.py: opportunity_out` |
| Draft | "Generate a first draft" now uses the stored configuration: scope, deliverables, exclusions, dependencies and stages in the words the client saw. The indicative bands are **not** copied into the draft, the commercial section is the placeholder, and anything without a published price is listed as needing an assessment | `app/opportunities/configured.py`, `drafts.py` |
| Revisions | Unchanged: immutable versions, change notes, authors, `expected_revision` on every change | `app/opportunities/*` |
| Approval | Unchanged: a person must complete the commercial terms and every placeholder; blocking findings stop approval; approval is a recorded human decision | `drafts.review`, `service.transition` |
| Publish | Staff (administrators) publish the approved version. The server returns the secret link **once**; only its SHA-256 is stored. Optional validity date, only if staff set one | `app/quotations/service.py`, `app/routers/quotations.py` |
| Client | The holder of the link reads the approved version and answers "we want to proceed" or "we decline", once, with a name and an explicit confirmation | `components/quotation/QuotationView.tsx` |
| Audit | `proposal.*`, `quotation.published`, `quotation.accepted` / `quotation.declined`, `quotation.withdrawn` in the audit log, with the lead as the entity | `app/audit.py` |

## Linking accepted work to a customer project

Not in this phase. Customer projects do not exist yet: the commercial project object and the customer portal are
Phase 09 and sit on the customer-account system, which stays off in production. Phase 07 records the answer on the
quotation (who, when, which approved version) and does nothing else: it does not move the lead, create a project,
send a message or take a payment. Phase 09 will link an accepted quotation to a project through that record
(decision D-19).

## Flag and gate

`QUOTATIONS_ENABLED=false` by default. While off, **every** quotation route answers 404, staff routes included, so
no link can be handed out that leads nowhere, and the page `/bg/oferta` ↔ `/en/quotation` is a 404.

**BLOCKER-COM-ACCEPT-01** (`app/release_gates.py`, `QUOTATION_ACCEPTANCE_WORDING_APPROVED = False`): the API refuses a
production start with the flag on until the owner and a lawyer approve what a client's answer means and the wording
next to the button (decision D-06). Until then the page says: the answer states the company's intention and does not
replace a written agreement. The system never describes an answer as a contract.

## Database

Migration `0027` adds one table, `quotations` (additive; single Alembic head):

| Column | |
| --- | --- |
| `lead_id`, `proposal_id`, `version_number` | the immutable approved version shown |
| `token_hash` | SHA-256 of the client's secret, unique |
| `locale`, `status` | `published`, `accepted`, `declined`, `withdrawn` (`expired` is derived from `valid_until`) |
| `valid_until` | only when staff set one |
| `published_by_id`, `published_at`, `first_viewed_at`, `last_viewed_at`, `view_count` | |
| `decided_at`, `decision_name`, `decision_note`, `decision_ip_hash` | the client's answer; a CHECK ties status, time and name together |
| `withdrawn_at`, `withdrawn_by_id`, `withdrawal_note` | |
| `revision` | counter for concurrent staff changes |

A partial unique index allows **one live link per proposal**. The API role may read, add and change rows; it cannot
delete them (they go with their lead); the runtime role has no access. Rollback: `alembic downgrade 0026`.

## Security

* **The link is the credential.** 43 URL-safe characters from `secrets.token_urlsafe(32)`. It lives in the URL
  *fragment* (`/bg/oferta#t=<secret>`), which browsers never send to a server, so it reaches no access log, and the
  page sets `Referrer-Policy: no-referrer`. The page sends it to the API in a request body. There is no route that
  takes it in a URL. Nothing is written to browser storage. An unknown link is a plain 404.
* **Only an approved version.** `publish` refuses anything but a proposal in status `approved`; the client sees
  that version (versions are append-only; an approved proposal accepts no new version).
* **Staff authorization.** Publishing and withdrawing need an administrator; editors and viewers get 403; no session
  gets 401. A proposal of another lead is a 404.
* **One answer.** The row lock makes simultaneous answers wait; the same answer again is a no-op (200), a different
  one is refused (409 `quotation_closed`). A withdrawn or expired quotation cannot be answered.
* **Stale staff views.** Publishing and withdrawing name the revision they saw (409 `opportunity_stale`).
* **Customer isolation.** One link opens one quotation; the view carries no id, no staff name, no e-mail and no
  internal note; a decision is recorded with the hash of the IP address, not the address.
* **No amounts in requests**, no unknown fields (`extra="forbid"`). Staff-written commercial text is shown as
  approved; nothing is computed.
* **Rate limits:** `QUOTATION_VIEW_RATE_LIMIT`, `QUOTATION_DECISION_RATE_LIMIT` per address and
  `QUOTATION_GLOBAL_RATE_LIMIT` per `QUOTATION_RATE_WINDOW_SECONDS`.

## Files

`apps/api/app/configurator/labels.json` is a byte-for-byte copy of `apps/web/src/lib/configurator-labels.json`
(generated from the site content by `lib/configurator.test.ts` with `UPDATE_CONFIGURATOR_LABELS=1`; `scripts/test.ps1`
compares them). It carries labels only, no amount.

## Tests

| Suite | What |
| --- | --- |
| `apps/api/tests/test_quotations.py` | the labels file; drafts from a configured lead and from a basket; nothing commercial in a draft; opportunity pre-fill without saving; flag off = 404; only approved proposals publish; the link shown once and stored as a hash; revision and validity checks; staff roles (editor, viewer, no session) and cross-lead access; the client view (no internal data, view marks); unknown and malformed links; rate limits; accept once, repeated and simultaneous answers; a different answer refused; input validation; withdrawal and republishing; expiry; accepted quotations; isolation between two clients; the audit trail; table constraints and grants; the production blocker |
| `apps/web/src/components/quotation/quotation.test.tsx` | the fragment parser; the secret in the body and never in a URL; empty sections left out; not found; following a new link in the same tab; validation; one answer; decline; withdrawn and expired states; texts complete in both languages |
| `apps/web/e2e/tests/quotation.spec.ts` | default stack: nothing reachable. Commercial stack: configurator → lead → approved proposal → publish → client reads and accepts once (second visitor cannot change it, staff see the answer, the lead is not moved); the admin panel (link once, validity shown to the client, withdrawal kills the link); decline in English and "not found" links; axe and keyboard; 360–1440 px; the API |
