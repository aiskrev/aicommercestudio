# Billing: the sandbox matrix and the four kinds of sale (Phase 13)

Commercial expansion, Phase 13 is a **validation and a hardening of the existing billing**, not a new payment system. There
is one Stripe integration ([STRIPE_BILLING.md](STRIPE_BILLING.md)) and one invoicing module ([INVOICING.md](INVOICING.md));
this phase adds no second gateway, no second webhook and no live key. `BILLING_PROVIDER=stripe` stays refused in production
and a live key is refused everywhere.

## What could and could not be verified

| Layer | State |
| --- | --- |
| Every case below, against the **fake gateway** of `apps/api/tests/test_billing.py` (signatures use the real Stripe library; no network) | **MOCKED TESTED** |
| The same cases against a **real Stripe sandbox** (test card numbers, test clocks, Workbench, Customer Portal, PayPal) | **REAL SANDBOX BLOCKED**: the project has no Stripe test keys. Nothing was called, nothing was created in Stripe |
| Accounting, VAT treatment, refund rules, withdrawal wording and every legal text | Owner, accountant and lawyer ([STRIPE_BILLING.md](STRIPE_BILLING.md) "Live activation", D-04, D-11, D-12) |

Unblocking the real sandbox needs only the owner's test keys and webhook secret in a **local, uncommitted** environment
(`STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`) and the checks in
[STRIPE_BILLING.md](STRIPE_BILLING.md) "Sandbox checks". Nothing here changes that procedure.

## The matrix

`test_billing.py` is the existing suite; `test_billing_matrix.py` holds what this phase added.

| Case | Mocked test | Real sandbox |
| --- | --- | --- |
| Successful payment | `test_an_active_subscription_activates_the_plan`, `test_purchase_keeps_payment_and_onboarding_apart`, `test_session_completed_alone_does_not_activate`, `test_returning_from_checkout_grants_nothing` | BLOCKED |
| Declined payment | `test_a_declined_first_payment_changes_no_plan_and_leaves_no_purchase`, `test_a_payment_that_failed_asynchronously_gives_no_access`, `test_a_delayed_payment_gives_no_access_until_it_succeeds` (matrix) | BLOCKED |
| Additional authentication | `test_additional_authentication_is_reported_and_gives_no_access` | BLOCKED |
| Duplicate webhook | `test_a_repeated_event_is_stored_once`, `test_parallel_deliveries_of_one_event_are_stored_once` | BLOCKED |
| Out-of-order webhook | `test_events_out_of_order_end_on_the_true_state` | BLOCKED |
| Missed webhook | `test_reconciliation_recovers_a_missed_webhook`, `test_reconciliation_corrects_drift`, `test_a_failed_processing_retries_and_then_succeeds` | BLOCKED |
| Renewal | `test_renewal_keeps_access_and_moves_the_period` | BLOCKED (needs a test clock) |
| Failed renewal | `test_a_failed_payment_keeps_access_through_the_grace_period_only`, `test_payment_after_past_due_restores_access`, `test_reconciliation_ends_an_expired_grace_period`, `test_unpaid_removes_access_and_keeps_projects` | BLOCKED (needs a test clock) |
| Cancellation | `test_cancel_at_period_end_keeps_access_until_it_ends` | BLOCKED |
| Refund | `test_a_full_refund_ends_access_and_deletes_no_data`, `test_a_partial_refund_keeps_access`, `test_a_refund_on_a_subscription_is_recorded_and_access_follows_stripe` | BLOCKED |
| Dispute | `test_a_dispute_changes_access_only_when_lost` | BLOCKED |
| Incorrect price | `test_a_price_changed_in_stripe_stops_the_sale`, `test_a_price_that_differs_from_stripe_stops_the_sale_and_the_browser_cannot_name_one` (matrix), `test_the_browser_chooses_an_offer_and_nothing_else` | BLOCKED |
| Unauthorized workspace access | `test_another_account_cannot_reach_a_workspace_it_does_not_belong_to` (matrix), `test_portal_opens_only_for_the_billing_owner`, `test_a_subscription_with_a_foreign_owner_is_never_attached` | BLOCKED |

## The requirements of the master list, one by one

| Requirement | Where it is met |
| --- | --- |
| Server-authoritative prices | `billing_offers` and the price check against Stripe before every checkout; the request refuses unknown fields (`price`, `amount`) |
| Verified offer ids | an offer is sold only when `approved_at` is set; unknown or unapproved keys answer `offer_unavailable` |
| Hosted checkout | Stripe Checkout; no card data in this system (`test_events_keep_no_payload_and_the_tables_hold_no_card_data`) |
| Webhook signature validation | `test_a_bad_signature_is_refused_and_stored_nowhere`, `test_an_old_signature_is_refused`, `test_a_live_event_is_refused_in_test_mode` |
| Idempotent events, delayed and reordered events | the table above |
| Reconciliation | `billing-reconcile` and its tests |
| Subscription state, cancellation, refund review, disputes, failed payments | the access policy table in STRIPE_BILLING.md and the tests above; incidents are recorded for staff review |
| Invoice visibility | the client zone's invoices page and `accounting_documents` ([INVOICING.md](INVOICING.md)); the demonstration issuer only |
| Legal acceptance versioning | the `acceptance` block of the checkout; a stale version is refused (`terms_version_changed`), once per checkout in `legal_events` |
| Customer and workspace ownership checks | one Stripe customer per workspace linked by metadata, never by e-mail; the billing owner only for the portal |

## The four kinds of sale stay apart

`billing_offers.category` (migration `0032`):

| Category | Meaning | Today |
| --- | --- | --- |
| `saas_subscription` | a software plan that renews | derived for a subscription with no scope step |
| `managed_service` | a recurring managed service | derived for a subscription whose payment waits for a confirmed scope |
| `one_time_service` | an approved one-time purchase | derived for a one-time offer |
| `project_deposit` | an advance on a project | **can never be approved.** A database CHECK (`deposit_never_approved`) refuses an approved offer of this category, checkout refuses it again (`category_not_released`) and the CLI refuses `--approve`. It needs a business and legal design first (D-08, D-42) |

The category is derived from the shape when the CLI does not say (`billing-offer --category …`), is shown with each approved
offer, and changes no price, no webhook and no access rule.

## An indicative quote never becomes a price

Quotation, basket, configurator and project totals are indicative and human-reviewed; the sale reads only
`billing_offers`. `test_billing_never_imports_a_quotation_a_basket_a_configurator_or_a_price_schedule` fails if any module of
`app/billing` or the billing router imports `app.quotations`, `app.quotes`, `app.configurator`, `app.pricing`,
`app.projects`, `app.opportunities` or `app.crm`, and
`test_the_sale_has_no_route_that_takes_an_amount_a_basket_or_a_quotation` fails if a billing route names one. A project is
never billed automatically from an accepted quotation: that would be a final contractual price issued from an indicative one.

## Not done, on purpose

Live keys or live calls; removing any production refusal in `app/config.py`; a billing screen for staff; billing a project
or a quotation; a deposit; automatic tax. The accountant and the lawyer decide VAT, refunds and wording (D-04, D-11, D-12,
D-42).
