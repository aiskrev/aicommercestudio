# E-mail about a customer's project (Phase 11)

Commercial expansion, Phase 11. When something happens in a customer's own project, the owner and the members of their
workspace get a short service message with a reference and a link. It reuses the existing transactional outbox
([CUSTOMER_ACCOUNTS.md](CUSTOMER_ACCOUNTS.md), `app/accounts/mail.py`): no second mail system, no new provider. It is behind
`PROJECT_NOTIFICATIONS_ENABLED=false`, and **no real e-mail is ever sent by the tests or by this phase**: nothing leaves
the system unless an operator runs `outbox-run` with a configured provider, and production still refuses accounts (so
these messages) until `EMAIL_DELIVERY_VERIFIED` is set ([DNS_MAILBOX_VERIFICATION.md](DNS_MAILBOX_VERIFICATION.md)).

## Events

| Event | Kind | Who gets it |
| --- | --- | --- |
| Staff move a draft to "Quotation": the customer sees the project | `project_available` | owner and every member |
| Staff post a client-visible update or delivery | `project_update` | owner and every member |
| Staff change the delivery plan (a real change; the same plan again sends nothing) | `project_update` | owner and every member |
| Staff move the project on (approved → in progress, completed, maintenance) | `project_update` | owner and every member |
| The scope is awaiting approval | `approval_requested` | owner and `billing` members |
| Staff ask for a decision on a document version | `approval_requested` | owner and `billing` members |
| The result is ready for the customer's review | `review_requested` | owner and `billing` members |
| Staff publish a document version | `document_published` | owner and every member |
| Staff answer a change or support request | `support_reply` | owner and every member |

Internal notes, drafts (a draft project, a draft document), the customer's own actions and everything the customer
writes send nothing to the customer. A message goes only to the verified address of an account that was not erased.

What is **not** here, on purpose:

* *New enquiry* and the internal notice to the team already exist (`app/notifications.py`, `LEAD_NOTIFICATION_EMAIL`); the
  acknowledgement to the visitor is still prepared only, not sent.
* *Quote available / quote approved*: a quotation is shown through a secret link that is displayed to staff once and
  that they send themselves (D-38). The outbox stores no address and no token by design, so it cannot send that link.
* *Internal lead assignment* and staff notices when a customer decides or writes: Phase 12 (admin CRM, tasks).
* *Billing notices*: Phase 13.
* Real delivery: the provider, the domain and the mailbox are not verified (D-05).

## What a message holds

A subject and a body that name the project reference and title, say that something happened, and give the link
`<SITE_URL>/bg/konto/izrabotka?p=<project id>` (or `/en/account/delivery`) for the signed-in page. The origin comes from
`SITE_URL`, never from a request. **Never** in a message: a note, a message text, a file name or a document title, a token,
an amount, a promise or a deadline. The link holds no secret: the page needs the customer's own session, and the API checks
the workspace. The wording is not lawyer-approved (D-37).

## Transactional, not marketing

These are messages about a contract in progress. They do not use or need the marketing consent, contain no promotion
and are not affected by withdrawing it (tested). There is no unsubscribe link because there is nothing to unsubscribe
from: a customer who does not want them can ask the team to stop the project's messages (D-36).

## Reliability

* **Once per account and event.** The outbox row is created in the same transaction as the event and has a unique index
  on (account, kind, event): a retry, a repeated click or a second worker cannot queue it twice.
* **Retry.** A provider outage (`SMTPException`, `OSError`) is retried with growing delays (1, 5, 15, 60, 240 minutes) up
  to six attempts, then the row is `failed`. A permanent refusal (an unknown recipient, any 5xx answer) fails at once.
* **Failure tracking.** Every row keeps its state (`pending`, `sent`, `failed`, `blocked`), attempts, an error code
  (never a message) and times. A row whose project no longer qualifies (`source_missing`) or whose account was erased
  (`recipient_invalid`) is failed, not crashed. Without a provider a row is `blocked` instead of pretending to work.
* **Staff view.** `GET /api/admin/projects/{id}/notifications` and the project screen list kind, state, attempts and
  error code; never an address or a text.
* **Logs** carry the outbox id, kind and attempts, never an address or a body (tested).
* **Provider independence.** `EmailSender` has an SMTP adapter and a development adapter that writes `.eml` files; tests
  pass their own sender. Run `python -m app.cli outbox-run` (a scheduled job) to send what is due.

## Tests

`apps/api/tests/test_project_notifications.py` (16 tests): the flag and the production rule, each event and kind, recipients
by role, unverified and erased accounts, once per event (repeated events, a repeated plan, repeated publication and
requests), the content (reference, title, link, nothing sensitive, no marketing words), Bulgarian and English, provider
outage and retry, a refused recipient, a vanished project, no provider, log redaction, the staff view. The legal e2e stack
runs with the flag on and a development provider and checks the staff table.

## Decisions

D-36 (no per-message opt-out; the team stops them on request), D-37 (wording not lawyer-approved), D-38 (the quotation link
is not e-mailed by the system) in [COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md).
