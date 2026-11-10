# Maintenance and Managed Services Agreement — structure template

> **DRAFT STRUCTURE. NOT REVIEWED BY A LAWYER.** This is a checklist of what an individual contract for
> maintenance (care plans) or AI Managed Services should contain. It is not an offer, is not shown on the
> website, and must be reviewed by a Bulgarian lawyer before first use. Every `[…]` is filled in for a named
> customer; nothing in square brackets is a default. Do not copy numbers from other contracts or from marketing
> text: the website promises no response time, availability or credit (`lib/sla.ts` keeps every value empty).

Where the schedule below says "agreed in the individual contract", the contract itself must contain the value,
or the commitment does not exist.

## 1. Parties and documents

1.1 Provider: Iskrev Consulting Ltd. ("ИСКРЕВ КОНСУЛТИНГ" ЕООД), UIC 207509557, `[registered office]`,
`[representative]`. Customer: `[legal name, UIC / tax number, address, representative]`. Customer type:
business / consumer `[delete one]`. A consumer contract needs additional pre-contract information and a
withdrawal clause; do not use this template for consumers without a lawyer.

1.2 The contract consists of: this agreement; Schedule A (scope and systems); Schedule B (service levels);
Schedule C (fees and payment); Schedule D (data protection, only if the Provider processes personal data for the
Customer — see `DPA_ART28_TEMPLATE.md`); the Provider's Terms of Use of the version `[version id]` only where
this agreement refers to them. If documents conflict, this agreement prevails.

## 2. Scope (Schedule A)

* The systems and environments covered, by name and address: `[…]`.
* The services: monitoring / updates and backups / small fixes / reporting / AI model and prompt operations /
  evaluation / incident handling `[keep only what is sold]`.
* What is expressly **not** covered: new features, redesign, third-party failures (hosting, platforms, payment
  and courier systems, AI model providers), data the Customer has not provided, systems without access.
* What the Customer must provide: access, a named contact, approvals, backups of data the Customer owns.
* Included hours or units per month, if any: `[agreed in the individual contract]`. Extra work: by written
  change request at the rates in Schedule C.

## 3. Service levels (Schedule B)

Use the fields of `lib/sla.ts`. A field that is not filled in with a value does not exist.

| Item | Value |
| --- | --- |
| Hours when the service is staffed | `[agreed in the individual contract]` |
| Channels for each severity | `[…]` |
| Severity P1 (critical) — first response / resolution target | `[…]` / `[…]` |
| Severity P2 (high) — first response / resolution target | `[…]` / `[…]` |
| Severity P3 (medium) — first response / resolution target | `[…]` / `[…]` |
| Severity P4 (low) — first response / resolution target | `[…]` / `[…]` |
| Availability target of the maintained system, if any | `[…]` |
| Maintenance windows | `[…]` |
| Escalation path when a target is missed | `[…]` |
| Remedy when a target is missed (credit or other) | `[none, unless written here]` |
| Exclusions | the list in `lib/sla.ts` plus `[…]` |

Definitions of P1–P4 are the wording in `lib/sla.ts` (the same in Bulgarian and English). State whether times
run in calendar or business hours and when the clock starts (when the Customer's request is received through the
agreed channel) and stops (first human response; resolution accepted or a workaround delivered).

AI-specific items, only if the service includes AI features: what "incident" means for a model (wrong or unsafe
output, data exposure, cost spike, provider outage); that outputs are probabilistic and no accuracy is promised
unless an evaluation threshold is written here; who approves a prompt, model or tool change; what is logged and
for how long (no more personal data than needed).

## 4. Fees and payment (Schedule C)

* Fee, currency (EUR), billing period, due date, how invoices are issued and sent. Prices on the website are
  indicative; the contract price is the one written here.
* VAT: `[state the treatment your accountant has confirmed; do not copy "not VAT registered" without checking]`.
* Late payment, suspension for non-payment after written notice `[…]`.
* Indexation or price change: only with written notice `[period]`; the Customer may terminate instead.

## 5. Term, termination and exit

* Start date, minimum term `[…]`, renewal `[automatic / by agreement]`, notice to end `[…]`.
* Termination for material breach after a written cure period `[…]`.
* On exit: return of Customer data and credentials, handover of documentation `[…]`, deletion of copies
  held by the Provider after `[period]`, except what the law requires the Provider to keep (accounting records).

## 6. Liability, intellectual property, confidentiality

* Limits and exclusions of liability — **for the lawyer to draft**. Do not limit liability for intent or gross
  negligence beyond what Bulgarian law allows, and do not limit liability to a consumer.
* Ownership: what the Customer owns (its data, content, configuration made for it) and what the Provider keeps
  (tools, know-how, general components); licence for anything the Customer receives.
* Confidentiality both ways, duration `[…]`.

## 7. Data protection

If the Provider can access personal data in the Customer's systems, the Provider is a processor and Schedule D
(Article 28 GDPR) is required. If it can access none, say so. See `DPA_ART28_TEMPLATE.md`.

## 8. General

Notices (addresses and e-mail), changes only in writing, assignment, force majeure `[…]`, governing law
(Bulgarian) and venue `[…]`, languages (Bulgarian prevails / both equal `[choose]`), signature by authorised
representatives.

## Pre-signature checklist (internal)

- [ ] A lawyer has reviewed this contract for this customer type.
- [ ] Every Schedule B value is written down or deliberately left out.
- [ ] Customer type is correct (business vs consumer).
- [ ] Schedule D attached if personal data is processed; sub-processors listed.
- [ ] The accountant has confirmed the invoice and VAT treatment.
- [ ] Nothing in the contract is more generous than the Provider can actually staff.
