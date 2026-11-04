# Advisor Workspace

Status: first version, behind `ADVISOR_WORKSPACE_ENABLED=false`. Production refuses to start with it on,
so releasing it means changing that rule on purpose. Billing is a sandbox: no real payment exists.

The free Advisor (`/api/public/advisor`) is unchanged and needs no account. Workspace results come from
the same `advisor.create_assessment`, so prompts, sanitising, scoring, human-approval rules and factual
limits are the free Advisor's. This module only decides who may run it, reserves quota and keeps results.

## What a customer gets

| Capability | Free | Pro | Business | Custom |
| --- | --- | --- | --- | --- |
| Saved projects and version history | yes | yes | yes | yes |
| Template assessments | yes | yes | yes | yes |
| Follow-up clarifications, compare variants | | yes | yes | yes |
| Real AI model assessments and their full results | | yes | yes | yes |
| Export to Markdown | | yes | yes | yes |
| Export to JSON | | | yes | yes |

Limits are in migration 0019. **They and the plan contents are internal starting values, not confirmed
offers.** No price exists: `plan_prices` is empty, and only rows with `approved_at` are ever shown.
A change is a new `plan_versions` row, so a grant keeps what was agreed. The API role can only read plans.

## Template or real model

`result_kind` records what actually produced a result, not what was requested:

* `template`: the built-in engine. It costs no AI quota.
* `ai_model`: a real provider, with its model name.

Asking for AI with no real provider connected answers 503 `ai_unavailable`; it is never faked. If the
daily spending guard answers from the template engine instead, the version is labelled `template` and
AI quota is not charged. Exports carry the same label.

## Access control

Every right is checked on the server. `workspace_context` loads the account's workspace and plan;
`gated(feature)` refuses what the plan lacks with 403 `feature_not_in_plan`. A test walks the routes and
fails if one has no such dependency. The page only follows these answers.

* Another account's project answers 404, the same as one that does not exist.
* After a downgrade, `ai_model` results are locked: 160 characters of preview and the complexity level.
  The full text is not in the answer, and compare and export refuse them.
* The pages hold no results in their HTML, and every answer is `Cache-Control: no-store`.

## Quota

`usage_counters` keeps `used` and `reserved` per workspace, metric and month. A reservation is one
conditional `UPDATE ... WHERE used + reserved + amount <= limit`, committed before the provider is
called, so parallel requests cannot pass a limit. A result and its charge are saved in one transaction.
Counters are always locked in one order, so reservation and settlement cannot deadlock.

AI work takes three things: one run, the cost estimate from the plan's monthly cost limit, and the same
estimate from a spending cap across all workspaces (`WORKSPACE_AI_GLOBAL_MONTHLY_MICROS`; 0 means no AI
at all). Reaching any of them stops the request with 403 `quota_exceeded`. Nothing is charged
automatically and there is no overage. Any later overage must need approval in advance.

Providers do not report tokens here, so cost is the fixed upper estimate
`WORKSPACE_AI_CALL_COST_MICROS`, not a measured amount. It protects spending; it is not a price.

| Outcome | Customer's run | Spending cap | Why |
| --- | --- | --- | --- |
| Success | counted | counted | |
| Provider unreachable or rate limited | released | released | the provider did no work |
| Timeout | released | counted | it may have been billed, and the cap must stay safe |
| Invalid output or declined | released | counted | the provider worked; the failure isn't the customer's |
| Saving failed | released | counted | same |
| Worker died (reservation expired) | released | counted | same as a timeout |
| Limit reached, invalid input, no right | nothing reserved | nothing reserved | stopped before the provider |

`Idempotency-Key` is required when running an assessment:

* Same key and same request after success: the stored version, with no provider call and no charge.
* Same key while running: 409 `in_progress`.
* Same key after a released attempt: it runs again and the customer is charged once.
* Same key for a different request: 409 `idempotency_conflict`.

Expired reservations are closed on the next reservation of that workspace and by `maintenance`. A worker
that returns after expiry cannot settle: the result is dropped and the caller gets 409 `reservation_expired`.

Request rate (`limit_requests_per_minute`, shared in PostgreSQL) and input size (`limit_input_chars`,
including a follow-up's added text) are limited per plan. `usage_events` is append-only for the API role.

## Demo and billing

`GET /api/workspace/demo` and `/bg/konto/advisor/demo` show fixed synthetic data from `app/workspace/demo.py`.
It is never written to workspace tables, so it cannot mix with real data.

`BILLING_PROVIDER=sandbox` enables `POST /api/workspace/billing/sandbox/plan`, which changes the plan
with no payment, for testing. Production refuses to start with it.

## Known limits

* Access between accounts is enforced in queries and tests; `customer_workspaces` has no row-level
  security yet. Add it before workspaces get members.
* One personal workspace per account: no members or invitations.
* A follow-up from the page uses a template assessment; the API also accepts `engine: "ai"`.
* Export is Markdown and JSON. No PDF.
* Monthly limits follow calendar months in UTC.
