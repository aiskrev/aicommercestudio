# Stripe billing

Status: built for **test mode only**, behind `BILLING_PROVIDER=stripe`. A live key is refused in every
environment and production refuses to start with it. Nothing is on sale until an offer is added and
approved. **It has not been run against a real Stripe sandbox yet**: there are no test keys in this
project, so the tests use a fake gateway. Signature checks do use the real Stripe library. See
[Sandbox checks](#sandbox-checks).

Iskrev Consulting Ltd sells its own services and tools. This is not a marketplace, so there is no
Connect and no payouts to others. Checked against Stripe's documentation on 2026-11-04.

## Design

Hosted Checkout takes payment, Stripe Billing runs subscriptions, and the hosted Customer Portal manages
them. Card data never reaches this system.

* **The server decides the price.** The browser names an offer key. `billing_offers` maps it to a Stripe
  price, and the amount, currency and interval are checked against Stripe before every Checkout. A
  mismatch stops the sale. Unknown fields are refused.
* **One customer per workspace**, linked by `billing_customers` and by `metadata.workspace_id`, never by
  e-mail. A subscription whose metadata does not match its customer's workspace is not attached.
* **Events do not carry decisions.** An event only says what to read again. Processing fetches the
  object from Stripe, so duplicates, delays and wrong order all end on the true state.
* **No access from a redirect.** The payment page only reports. `checkout.session.completed` alone
  grants nothing: a subscription needs `active` or `trialing`, a purchase needs `payment_status=paid`.

## Payment methods

No method is named in code or on the page. Checkout shows what the Dashboard enables and what the
customer's device, browser and currency support.

| Method | State for a Bulgarian Stripe account |
| --- | --- |
| Card | Available |
| Apple Pay, Google Pay | Shown by Checkout when the device and browser support them; not verified here |
| PayPal, one-time | BG is a supported business location, in EUR among other currencies. Enable it in Dashboard and connect PayPal |
| PayPal, subscriptions | Must be enabled separately and "might require approval". **Treat as unavailable until approved** |

PayPal's own rules also apply: some business categories need PayPal's approval in advance.

## Access policy

| Situation | Plan access | Data |
| --- | --- | --- |
| `active`, `trialing` | Yes | Kept |
| `incomplete` (extra authentication pending) | No; the customer is told to confirm | Kept |
| `past_due` | Yes, for `BILLING_GRACE_DAYS` (7) | Kept |
| `past_due` after the grace period | No | Kept |
| `unpaid`, `paused`, `canceled`, `incomplete_expired` | No | Kept |
| Cancelled at period end | Yes, until `customer.subscription.deleted` | Kept |
| One-time purchase, `paid` | Yes | Kept |
| One-time purchase, delayed payment | Not until paid | Kept |
| Full refund of a purchase | Ended | Kept |
| Partial refund of a purchase | Kept | Kept |
| Refund on a subscription invoice | Follows the subscription; recorded for review | Kept |
| Dispute open | Unchanged, recorded for review | Kept |
| Dispute lost on a purchase | Ended | Kept |
| Dispute won on a purchase | Restored | Kept |

**Billing never deletes customer data.** Losing a plan moves the workspace to Free: projects stay, and
AI results lock as described in [ADVISOR_WORKSPACE.md](ADVISOR_WORKSPACE.md). Deletion is a separate
data-protection decision. Grants made by hand or by contract are not overwritten by Stripe events.

## Individual support

An offer with `requires_scope` cannot be paid until staff record that the technical intake is done and
the scope is agreed (`billing-confirm-scope`). `payment_status` and `onboarding_status` are separate
columns: being paid never means onboarded, and neither changes the other.

## Duplicates

Each workspace has one billing lock. Before Checkout the server asks **Stripe** for the customer's
subscriptions, so a webhook that has not arrived cannot let a second one through. An open Checkout for
the same offer is reused and one for another offer is expired. Session creation has an idempotency key.
`billing-reconcile` reports any duplicate that still appears.

## Webhooks

`POST /api/billing/stripe/webhook` verifies the signature on the raw body with Stripe's 5 minute
tolerance, stores the event id and answers 2xx. `billing_events` is keyed by Stripe's id, keeps no
payload and records attempts. Failures retry after 1, 5, 30, 120 and 720 minutes, up to 8 attempts, then
`failed`. A live-mode event is refused. Use snapshot events: thin events have a different format.

Events: `checkout.session.completed`, `.async_payment_succeeded`, `.async_payment_failed`, `.expired`;
`customer.subscription.created`, `.updated`, `.deleted`, `.paused`, `.resumed`; `invoice.paid`,
`.payment_failed`, `.payment_action_required`; `charge.refunded`; `charge.dispute.created`, `.updated`,
`.closed`.

`billing-run` processes what is due. `billing-reconcile` fetches 72 hours of events (Stripe retries live
deliveries for 3 days, test ones only a few times), re-reads every live subscription and ends expired
grace periods. It exits non-zero on errors or duplicates. Run it hourly; timers are not installed yet.

## Settings

| Setting | Value | Notes |
| --- | --- | --- |
| `BILLING_PROVIDER` | `stripe` | Also needs `ADVISOR_WORKSPACE_ENABLED=true` |
| `STRIPE_SECRET_KEY` | `sk_test_…` or a restricted `rk_test_…` | Secret. Never in the repository |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` | Per endpoint and per mode |
| `STRIPE_AUTOMATIC_TAX` | `false` | See the live steps |
| `BILLING_GRACE_DAYS` | `7` | A business decision |
| `STRIPE_LIVE_ALLOWED` | `false` | Leave off until live activation |

Dashboard, in a sandbox: products and prices, Customer Portal settings (cancel at period end, payment
method update, invoice history), payment methods, failed payment rules (decide `unpaid` or `canceled`),
and a webhook endpoint with the events above.

## Sandbox checks

Not done yet. They need the owner's Stripe sandbox.

```bash
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```

```bash
python -m app.cli billing-offer --key pro_monthly --price price_XXX --plan pro --approve
```

| Case | How | Expected |
| --- | --- | --- |
| Successful subscription | card `4242 4242 4242 4242` | plan becomes Pro |
| Extra authentication | `4000 0000 0000 3220` | `incomplete`, then active after confirming |
| Declined | `4000 0000 0000 0002` | no plan change |
| Renewal | test clock | period moves, plan stays |
| Failed renewal | test clock with a failing card | `past_due`, grace, then Free |
| Cancel at period end | Customer Portal | plan stays until the end |
| Refund | Dashboard | recorded, access per the table |
| Dispute | `4061 2199 4639 3810` | recorded, access per the table |
| Duplicate event | Resend in Workbench | one row, one effect |
| Missed event | Stop the listener, then `billing-reconcile` | state recovered |
| PayPal | Checkout redirect page | success and "Fail test payment" |

## Live activation

Each step needs the owner. None is done.

1. **Business:** finish Stripe account verification for Iskrev Consulting Ltd.
2. **Tax:** ask the accountant. The company is not VAT registered, and selling across the EU can change
   that. Set `STRIPE_AUTOMATIC_TAX` and the price `tax_behavior` only after that advice.
3. **Legal:** terms, withdrawal right for digital services, refund policy and the privacy notice, with
   Stripe added as a processor.
4. **Offers:** confirm products, prices and any yearly plan. Nothing is approved today.
5. **PayPal:** connect it, and request recurring payments if wanted.
6. **Domains:** register the domain for Apple Pay if Stripe asks for it, and check on real devices.
7. **Gates:** customer accounts live, H-1 switched on, a sending e-mail provider, off-site backup and
   alerts. Then remove the production refusals for the workspace and Stripe in `app/config.py`.
8. **Live setup:** create live products and prices, a live webhook and portal settings. Put the live key
   and secret on the server only, set `STRIPE_LIVE_ALLOWED=true`, add offers with live prices, install
   timers for `billing-run` and `billing-reconcile`.
9. **First payment:** make one small real purchase, refund it, and check the records.

## Known limits

* Prices are not shown on public pages, only to signed-in customers.
* A one-time purchase is recorded but does not unlock a product feature yet.
* Staff have no billing screen: incidents and scope confirmation are through the database and CLI.
* A customer who changes plan in the portal needs a Stripe price mapped to an offer; the portal must
  offer only those prices, or the event fails and appears in `billing_events`.

## Order review, acceptance and withdrawal (2026-11-10, technical foundation; legal texts pending review)

* **Before Stripe**: the customer sees an order review (product, price in EUR, interval, renewal, how to cancel, seller identification
  from `lib/company.ts`, links to the terms and the privacy notice), chooses consumer or business, and ticks the terms.
  The browser sends the version ids it showed; `POST /api/billing/checkout` REQUIRES the `acceptance` block and refuses a
  stale version with `terms_version_changed`. With payments on in production, every legal text must be approved
  (`legal_text_not_approved`; docs/LEGAL_CONTENT_RELEASE.md). The acceptance is stored in `legal_events` against the checkout, once.
* **Withdrawal** from the contract ("Откажете се от договора тук") is separate from cancelling in the Stripe portal. The system records
  the statement and sends the acknowledgement; it never refunds. A staff member decides and, if a refund is due, makes it by hand
  in Stripe and records its reference (`refund_reference`, `refund_amount_minor`).
* **Stripe-side data** (customer, payment methods, invoices) is not erased or corrected by this system: see docs/LEGAL_RETENTION.md section 4.
* **Account deletion** is refused while any local subscription or checkout state is not final, and asks the staff member to confirm
  they checked Stripe (docs/LEGAL_RETENTION.md section 3). A late subscription event for an erased account is flagged in the audit log.
