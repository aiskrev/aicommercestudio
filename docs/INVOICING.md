# Invoicing

Status: built with a **demonstration issuer only**. No real invoice can be produced: `INVOICING_SOURCE`
is `none` or `demo`, and production refuses `demo`. A real issuer needs the decision below and an adapter.

## Decision to take: who issues accounting documents

**Recommendation: an accounting or invoicing system chosen with the accountant is the only issuer.**
Stripe stays the payment system. Status: **proposed, the owner and accountant decide.**

| | Stripe Invoicing | Accounting or invoicing system |
| --- | --- | --- |
| Fit for Bulgarian accounting rules | Not confirmed; the accountant must say | Chosen for this reason |
| Numbering, tax treatment | Would need checking | Stays with the accountant's system |
| Work needed | Less | One adapter and a provider choice |
| Risk | A Stripe document mistaken for the legal one | Delay if the system is down, handled by the queue |

Whichever is chosen, **only one issues**. All documents pass through `invoicing.issue_pending`, the only
caller of an issuer. Stripe still creates its own invoices for subscriptions and sends receipts: they are
payment records here, stored only as references. If the accountant accepts them as the real documents,
the issuer becomes a thin adapter that records them, and this rule still holds. Stripe's customer e-mails
should be set so that a customer doesn't receive two things that both look like the invoice.

## What each thing is

| Thing | Meaning | Where |
| --- | --- | --- |
| Order | The intent to buy an offer | `billing_checkouts` |
| Subscription | The recurring agreement | `billing_subscriptions` |
| Payment | Money moved, in Stripe | `billing_purchases`, Stripe references on documents |
| Receipt | Stripe's proof of payment | At Stripe. Not an accounting document here |
| Proforma | A request to pay, not a tax document | `accounting_documents`, kind `proforma`. The kind exists; nothing creates one yet |
| Invoice | The accounting document for a sale | `accounting_documents`, kind `invoice` |
| Credit note | Corrects an invoice after a refund | `accounting_documents`, kind `credit_note`, linked by `parent_id` |

## How it works

* **One document per cause.** `source_key` is unique: `stripe_invoice:<id>`, `purchase:<session>`,
  `refund:<charge>:<refunded total>`. A repeated webhook cannot issue twice.
* **Snapshot.** `buyer` and `tax` are copied when the document is created. A profile change affects only
  new documents. A trigger refuses any change to an issued row, and the API role cannot delete rows.
* **Links.** Each document keeps its Stripe payment, invoice and refund references and its `parent_id`.
  Partial refunds make one credit note each, for the newly refunded part.
* **Queue.** A successful payment queues a document. If the issuer is down, it retries after 1, 5, 30,
  120 and 720 minutes, up to 10 attempts, and the customer sees "queued for issue". Run `invoicing-run`.
* **Blocked** means something a person must fix, and the reason is shown: `no_issuer_configured`,
  `billing_profile_missing`, `tax_not_confirmed` or `parent_invoice_unknown`. Nothing is guessed.

Access: `owner` and `billing` roles of that workspace. Others get 403, another workspace gets 404, and
answers are `no-store`. `GET /api/zone/documents/export` gives the workspace's CSV;
`python -m app.cli invoicing-export` gives all of it for the accountant.

## Tax

**This code contains no VAT rate, reverse-charge rule, OSS decision, numbering or fiscal rule.** Numbers
come from the issuer and tax from `tax_scenarios`, which is empty. The scenario key (`domestic`,
`eu_business`, `eu_consumer`, `outside_eu`) only names a question for the accountant, and may need
changing after that conversation; it decides nothing itself.

With `INVOICING_ENFORCE_TAX=true`, the default, Checkout refuses a sale without a billing profile or
with an unconfirmed scenario (`tax_not_confirmed`), logs `tax_scenario_unconfirmed` and writes an audit
entry, so staff can see which scenario is missing.

Questions for the accountant:

1. Which document is legally required for each sale, and who may issue it?
2. What applies to each scenario above while the company is not VAT registered?
3. When would registration be required, including for sales to other EU countries?
4. Which numbering rules apply, and does the issuer handle them?
5. How long must each document be kept?

## Retention

Accounting documents and account deletion are separate. `accounting_documents` keeps its own copy of the
buyer's details and restricts deleting the workspace, so deleting a person's login must not remove what
accounting law requires. `retain_until` is written only when `ACCOUNTING_RETENTION_YEARS` is set from the
accountant's answer; no default is assumed, and nothing purges these rows yet. Account deletion itself
is not built.

## Known limits

* No real issuer and no proforma flow.
* A document is a plain text copy, not a PDF.
* Staff have no screen for blocked documents: use the logs, the audit entries and the CLI.
