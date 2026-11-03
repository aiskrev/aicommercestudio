# AI observability: bounded data model and the future ingestion contract

Status: implemented on 2026-11-03 (migration `0013`, `app/ops/observability.py`, staff UI tab
"Observability"). Part of the staff-only Ops platform ([AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md)).

## Boundary

The bounded version contains:

* an execution metadata schema;
* versioned rate cards;
* aggregations, budgets and threshold rules;
* a retention policy;
* source and freshness indicators.

It has no:

* telemetry gateway;
* message broker;
* OpenTelemetry collector;
* client integration;
* live dashboard.

Records come only from two places:

* a **manual import** (`POST …/observability/import`: JSON, at most 200 records per request, which fits
  the API's 64 KB request limit);
* **synthetic** sample records (`POST …/observability/synthetic`), allowed only for organisations
  flagged `is_demo`.

Every record carries its `source`. Every response carries `freshness`:

* `live: false`;
* the count per source;
* the time of the newest record;
* a note.

The UI shows a "Not live" badge with the sources. No prompt, input or output content is accepted:
`ops_runs` has no column for it, and the import schema rejects unknown fields (`prompt`,
`output_text`, …).

## Data model (all organisation-scoped, row-level security)

| Table | Content |
| --- | --- |
| `ops_runs` | `agent_id` and an optional `agent_version_id`, both composite foreign keys with `organization_id`; `external_id` (unique per organisation, the idempotency key); `started_at`; `duration_ms`; `status` (`succeeded`, `failed`, `timeout`, `cancelled`); `error_category` (`provider_error`, `rate_limit`, `timeout`, `tool_error`, `validation`, `policy_block`, `other`; required unless succeeded); `provider`; `model`; `input_tokens`; `output_tokens`; `source` (`synthetic`, `manual_import`); `batch_id` |
| `ops_rate_cards` | `provider`, `model`, `version` (unique per organisation), `currency` (ISO 4217 code), `input_per_million`, `output_per_million` (Numeric 14,6), `effective_from`, `source_note` (where the price came from) |
| `ops_budgets` | name; an optional agent; `amount` (Numeric 14,2); `currency`; `warn_percent` |
| `ops_threshold_rules` | an optional agent; `metric` (`error_rate_percent`, `avg_duration_ms`, `tokens`, `estimated_cost`); `threshold`; `window_days` (1–90); `enabled` |
| `ops_retention_policies` | `runs_days` (7–730, default 90); `eval_results_days` (30–1095, default 365) |

## Calculations

**Estimated cost of a run.** The cost is `input_tokens × input_per_million / 10^6 + output_tokens ×
output_per_million / 10^6`.

* It uses the rate card for the run's provider and model with the latest `effective_from` that is not
  after `started_at`.
* It is computed in Decimal and rounded half-up to 4 decimal places per run.
* Runs are summed per currency. Currencies are never converted or mixed.

**Missing rate.** A run with no applicable card is counted in `missing_rate_runs` and excluded from
the cost. It is never priced at zero.

**Aggregations.** They are grouped by agent or by workspace over `days` (1–365):

* runs, succeeded and failed;
* error rate (2 decimal places);
* average duration;
* error categories;
* input and output tokens;
* estimated cost per currency.

**Budgets.** Month-to-date spend in the budget's currency gives one of four states:

* `ok`;
* `warning` (at or above `warn_percent`);
* `exceeded` (at or above 100 %);
* `no_cost_data` (spend in another currency or no price for some runs).

**Threshold rules.** Each rule is evaluated on request over its window. With no data the value is
`null`. An estimated-cost rule is only evaluated when every run is priced and there is a single
currency. Nothing is sent and nothing notifies anyone.

## Retention

`python -m app.cli ops-retention` runs as the schema owner. For each organisation it deletes:

* execution records older than `runs_days`;
* evaluation results whose run finished more than `eval_results_days` ago.

Organisations without a policy use the defaults. Deleting an organisation cascades to all of its
rows.

## Ingestion contract for future OpenTelemetry adapters (design only — not built)

A future collector or gateway must satisfy all of the following before any client system is
connected. It needs its own approved phase.

| Requirement | Design |
| --- | --- |
| Tenant authentication | One ingestion credential per organisation and workspace, stored hashed and revocable. The organisation is derived from the credential, never from the payload. The gateway binds the transaction to it exactly like `require()` does (RLS). |
| Transport | OTLP/HTTP over TLS. Requests without a valid credential get 401 and are not stored. |
| Schema | OTel spans with `gen_ai.*` semantic attributes mapped onto `ops_runs`: status, duration, error type, `gen_ai.request.model`, `gen_ai.usage.input_tokens` and `gen_ai.usage.output_tokens`, the agent key, the version number. Unknown attributes are dropped. |
| No silent content ingestion | Attributes that carry prompt or completion text (`gen_ai.prompt*`, `gen_ai.completion*`, events with message bodies) are **dropped at the edge** by default. Content capture would need a separate, written opt-in per organisation, a retention limit and its own table. |
| PII redaction | E-mail addresses, phone numbers, card-like numbers and secret patterns are redacted in the remaining attributes (the same detector as `looks_like_secret`, plus PII rules). Redaction counts are recorded. |
| Size limits | At most 1 MB per request, 1000 spans per request and 64 attributes per span. Longer attribute values are truncated to 256 characters. |
| Idempotency | `external_id` = trace id + span id. A repeated span is a duplicate, not a second record. |
| Quotas | Spans per minute and records per day per organisation. Over the quota: 429 with `Retry-After`, counted, never queued silently. |
| Freshness | A record is visible once it is written. `freshness.live` becomes true only while records arrived within the last 5 minutes from an authenticated source. |
| Audit | Credential creation, revocation and quota changes are audited per organisation. |

## Tests

`apps/api/tests/test_ops_observability_workflows.py` covers:

* the import: idempotency, refused content fields, the record limit, another tenant's agent;
* synthetic records for demo organisations only;
* aggregation and cost with two rate card versions: Decimal rounding, a missing rate, grouping by
  workspace;
* budgets: one with a currency mismatch, one in warning;
* a breached rule;
* retention validation and purge;
* tenant isolation and permissions.

The UI test is `apps/web/src/components/admin/ops-platform.test.tsx` (the not-live banner, sources,
no import form for viewers). The e2e test is `ops-platform.spec.ts` (synthetic records on the demo
organisation shown as not live).
