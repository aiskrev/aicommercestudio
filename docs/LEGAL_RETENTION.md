# Retention of legal records, deletion rules and Stripe-side data

Status: **configuration and rules are built; no retention PERIOD is approved.** The periods below are deliberately
empty. Nothing in the legal workflows is deleted by a default, and deletion is switched off until three things have
happened: the lawyer and the accountant confirm each period, the owner sets it, and the owner switches cleanup on.

## 1. What is kept, why, and who must approve the period

| Record | Table | Why it exists | Setting (empty = keep) | Must approve |
| --- | --- | --- | --- | --- |
| Withdrawal requests (statement, eligibility reading, decision, refund reference) | `withdrawal_requests` | Proof that and when a consumer withdrew; basis for a refund | `WITHDRAWAL_RETENTION_YEARS` | Lawyer (limitation and proof) and accountant (a refunded request is accounting evidence) |
| Data-subject requests (kind, message, outcome) | `data_requests` | Proof that a request was answered, and when | `DATA_REQUEST_RETENTION_YEARS` | Lawyer |
| Consent, acknowledgement and acceptance history | `legal_events` | Proof of what was shown and accepted (GDPR Art. 7(1)) | none: it is removed with the lead or account it belongs to (leads after `LEAD_RETENTION_DAYS`); an event tied to a checkout or withdrawal stays with it | Lawyer |
| Confirmation e-mail records | `outbox_messages` | Delivery of the acknowledgement; holds no address, body or token | existing 30-day outbox cleanup; a withdrawal request's own message records go with that request | — |
| Accounting documents, billing records | `accounting_documents`, `billing_*` | Statutory accounting | `ACCOUNTING_RETENTION_YEARS` (existing; empty = keep) | Accountant |
| Audit log | `audit_logs` | Security and accountability | `AUDIT_RETENTION_DAYS` (existing, 1 095) | — |
| Operational notes on a request | `withdrawal_requests.outcome_note`, `data_requests.outcome_note` | The decision | follow their request | Lawyer |

A request is **open** until staff close it; open requests are never deleted. A withdrawal that ended in a refund
(`refund_reference` set) is accounting evidence and is kept for the LONGER of the withdrawal period and
`ACCOUNTING_RETENTION_YEARS`; if the accounting period is not set it is kept.

## 2. How cleanup works once approved

`python -m app.cli maintenance` calls `purge_legal_records` only when `LEGAL_CLEANUP_ENABLED=true`. It deletes closed
data requests older than `DATA_REQUEST_RETENTION_YEARS`, and closed withdrawal requests (and their legal events and
message records) older than `WITHDRAWAL_RETENTION_YEARS`. A `--dry-run` deletes nothing. The cleanup runs as the
database owner, so the API role needs no DELETE right on these tables (it has none). It is covered by tests with
test-specific periods; no real period is configured anywhere.

**Production guard.** With `CUSTOMER_ACCOUNTS_ENABLED=true` or any `BILLING_PROVIDER` other than `disabled`, a
production start is REFUSED while either retention setting is empty, and while any legal text is still
`pending_lawyer_review` (app/config.py). So the unapproved state cannot reach customers by accident.

## 3. Deleting or anonymising an account (staff action)

Staff execute a deletion request in the "Legal requests" screen (or `POST /api/admin/compliance/data-requests/{id}/handle`).
The system never executes it on its own. Before it runs, the local billing state is checked and **the check fails closed**.

| Local state | Deletion | Anonymisation | Other |
| --- | --- | --- | --- |
| `canceled`, `incomplete_expired` (final) | allowed | allowed | needs the staff attestation "checked in Stripe" if a Stripe customer exists |
| `active`, `trialing`, `past_due`, `unpaid`, `paused`, `incomplete` | **blocked** | **blocked** | end the subscription in Stripe first; manual staff review |
| `cancel_at_period_end` on a non-final state | **blocked** | **blocked** | service and billing continue until the period ends |
| any other value (unknown) | **blocked** | **blocked** | manual staff review |
| a checkout still `open` and younger than `BILLING_OPEN_CHECKOUT_BLOCK_HOURS` (48) | **blocked** | **blocked** | wait or expire it |
| a completed subscription checkout with no subscription row (webhook not processed yet, stale state) | **blocked** | **blocked** | run the billing reconcile, then retry |
| no billing records at all | allowed (deleted completely) | n/a | — |
| billing or accounting records exist, state final | n/a | allowed (anonymised; records stay) | — |

* The check is **local**: it makes no call to Stripe, so an unreachable Stripe cannot make it unsafe. Because the local
  state can lag behind Stripe, the staff member must also confirm they looked at the customer in Stripe
  (`stripe_checked`) whenever a Stripe customer exists; the confirmation is audited.
* "Only remove the login" (disable sign-in without erasing) is **DEFERRED — OWNER/PRODUCT DECISION**. It is not a
  defect of the implemented workflow: a deletion request is either executed (deletion or anonymisation, which ends
  sign-in) or stays blocked for staff review, and nothing is lost in between. Whether a separate "disable sign-in only"
  state is wanted, and how it interacts with password reset and an active subscription, is for the owner to decide.
* If a subscription event for an erased or anonymised account arrives later, the system writes an audit entry
  `billing.subscription_on_erased_account` and a log error so a person ends the subscription at Stripe.
* Accounting documents, payment records and legal evidence are never deleted by an erasure.

## 4. Stripe-side data: access, correction and erasure (operational note)

The system does **not** erase or correct anything at Stripe, and does not claim to. For a customer's request:

1. **Access:** the account export holds the data in this system. Data held by Stripe (customer, payment methods,
   invoices, receipts) is requested by the customer from Stripe or, on request, exported from the Stripe dashboard by
   the owner.
2. **Correction:** a name or e-mail change in the account does not change the Stripe customer; correct it in the Stripe
   dashboard.
3. **Erasure:** after the local state is final (above), the owner decides in the Stripe dashboard whether the customer
   and its payment records can be deleted or must be kept for the owner's own accounting and legal duties. Stripe's
   own retention terms apply. Record the outcome in the data request's note.
4. **Before any of this**, end the subscription in Stripe; erasing here does not cancel it.

Open for the lawyer and the accountant: what Stripe holds as an independent controller or as the company's processor;
what may be erased and what must be kept.

## 5. Rollback risk of the migrations

Migrations 0023 and 0024 are additive and can be reversed **before any legal evidence exists**
(`tests/test_migration_legal_populated.py` proves it on a populated database). After release, a downgrade drops
`legal_events`, `withdrawal_requests` and `data_requests` — destroying evidence — and must not be run. Roll the
application back instead; the new tables stay and are ignored by older code.

## 6. Working due dates for data-subject requests (2026-11-11)

Every request records `received_at` and a working `base_due_at` (`DATA_REQUEST_DUE_MONTHS` calendar months later,
default 1). Staff see **on track**, **due soon** (within `DATA_REQUEST_DUE_SOON_DAYS`, default 7) or **overdue** in the
"Legal requests" screen. An extension is only ever a recorded staff decision (`POST .../extend` with 1 or 2 months and a
reason; `POST .../extension-notified` when the person was told), each audited (`data_request.extended`,
`data_request.extension_notified`); `completed_at` is set when the request is closed. **Nothing extends automatically,
and these dates are working targets, not a legal decision:** the response period, the grounds for an extension and the
notice to the person are for the lawyer to confirm.
