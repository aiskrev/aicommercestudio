# AI Operations Portal: architecture and implementation plan

This document describes the target design of the authenticated, multi-tenant portal for AI Managed
Services clients, and the scaffold that exists today. It builds on
[AI_OPERATIONS_ARCHITECTURE.md](AI_OPERATIONS_ARCHITECTURE.md), which covers the console concept.
That document is now superseded by this one for data model, API and phasing.

> **Status, 2026-10-27.**
>
> * **What exists:** a staff-only **scaffold**: organisations, workspaces, memberships with roles, an
>   agent registry (metadata only), and organisation-scoped APIs with authorization and
>   tenant-isolation tests. A read-only admin page shows it.
> * **What is not collected:** no telemetry is collected or displayed. The overview API reports
>   `telemetry.connected = false`, and the public page presents the portal as *planned*.
> * **What does not exist yet:** client logins and real customer integrations.

## 1. Findings from the existing system

| Area | Today | Consequence for the portal |
| --- | --- | --- |
| Authentication | Staff only (`admin_users`): Argon2id passwords, opaque session token (SHA-256 stored), HttpOnly SameSite cookie, CSRF header on writes, idle timeout, persistent lockout, audit of auth events (`app/deps.py`, `app/routers/admin_auth.py`) | Reusable for staff. **Clients cannot log in.** Client access needs separate client accounts, invitations, MFA and password reset (MVP). |
| Authorization | Any active admin can do everything; no roles | The scaffold adds organisation-scoped roles (`ops_memberships`) and a permission matrix (`app/ops/rbac.py`). |
| Data | One PostgreSQL database, Alembic migrations checked by `alembic check`, JSONB, retention CLI (`python -m app.cli maintenance`) | Tenant tables live here. High-volume spans need a separate store (V2). |
| Audit | Append-only `audit_logs` with actor, action, entity and details; purged by retention | Reused. Ops entries carry `details.organization_id`, so each tenant's audit view is filtered. |
| Rate limiting | In-memory (single API process) | Not enough for ingestion. A shared limiter (Redis) is required before telemetry. |
| Background work | None (CLI and cron only) | A queue and workers are required for ingestion and alerting (V2). |
| Deployment | Docker Compose: Next.js web with a same-origin `/api` proxy, FastAPI API, PostgreSQL, Caddy | The portal UI can live in the same Next.js app. The ingestion gateway should be a separate service and hostname. |
| Secrets | `.env` on the host; the site never accepts credentials (forms reject key-like text) | Customer credentials need a secrets manager. Only references are stored in the database. |

## 2. Target architecture

```
 Client AI systems (agents, RAG apps, workflows)
   │  OpenTelemetry SDK / Collector (redaction processor ON, content capture OFF by default)
   │  OTLP/HTTP + ingestion key (per tenant × workspace, hashed at rest)
   ▼
 Ingestion gateway (separate service, own hostname)
   • key → organization_id/workspace_id (never trusted from payload)
   • size/schema limits, per-tenant rate limit (Redis), idempotency on event_id
   • second-pass redaction (PII, secrets patterns)
   ▼
 Queue (Redis Streams in MVP-2 → NATS/Kafka if volume demands)
   ▼
 Processors: run assembly · cost calculation (versioned price table) · aggregation ·
             evaluation runner · alert rules → incidents
   ▼                                   ▼
 PostgreSQL (tenancy, registry, runs index,    Columnar/time-series store (spans, tool calls,
 aggregates, evals, reviews, incidents, audit) metrics) — ClickHouse or TimescaleDB, tenant column
   ▼
 Portal API (FastAPI, /api/ops/...) ── Portal UI (Next.js, same-origin proxy)
   ▼
 Notifications (e-mail, chat webhook) · scheduled reports (PDF)
```

Principles:

* **Push over pull.** The client exports redacted telemetry, so we hold as few client credentials as
  possible.
* **The tenant is never taken from the payload.** It comes from the authenticated principal: the
  session membership or the ingestion key.
* **Model output never triggers actions.** Remediation that changes client systems requires a recorded
  human approval, as in the existing `ai_action_requests` flow.
* **No invented data.** Empty states say "not connected". Sample data exists only in organisations
  flagged `is_demo`, which are refused in production.

## 3. Tenant isolation strategy

Defence in depth. Each layer is independently tested:

| # | Layer | Status |
| --- | --- | --- |
| 1 | **Context resolution.** Every route names `organization_id`. `require(permission)` loads the caller's membership. With no membership the answer is **404** (`ops_not_found`), the same as a missing organisation, so tenants cannot be enumerated. With no permission the answer is **403**. Writes to a suspended organisation return 403 `ops_suspended`. | Implemented (`app/ops/tenancy.py`) |
| 2 | **Scoped queries only.** Routes read through `scoped(ctx, Model)` / `get_scoped(...)`, which always add `organization_id = ctx.organization_id`. A foreign id passed through the caller's own organisation path is "not found". | Implemented |
| 3 | **Referential integrity across tenants.** Composite foreign key `(workspace_id, organization_id) → ops_workspaces(id, organization_id)`, so the database rejects an agent placed in another tenant's workspace. The same pattern applies to every future child table. | Implemented (migration `0008`) |
| 4 | **PostgreSQL row-level security.** Policies `USING (organization_id = current_setting('app.org_id')::uuid)` on tenant tables, set per transaction with `SET LOCAL`. It requires the API to connect as a **non-owner, non-superuser role**: today the Compose database user owns the schema and would bypass RLS. | MVP, before any client login |
| 5 | **Ingestion keys bound to one workspace.** The gateway derives tenant and workspace from the key. Payload fields `organization_id` and `workspace_id` are ignored or rejected. | V2 |
| 6 | **Per-tenant limits and quotas** (requests, payload size, storage) so one tenant cannot degrade others. | V2 |
| 7 | **Tests** for every route and every new table: cross-tenant read, write, list and audit, the database-level constraint, and RLS with the restricted role. | Implemented for the scaffold (`tests/test_ops_portal.py`) |

Staff access to client data: today a staff user sees only organisations they are a member of. The
target design is **just-in-time support access**: a time-boxed membership granted by an owner (or a
break-glass procedure) and audited, never a silent global role.

## 4. Data model

### Implemented (migration `0008_ops_tenancy`)

| Table | Columns | Notes |
| --- | --- | --- |
| `ops_organizations` | `id`, `slug` (unique), `name`, `status` (active / suspended), `data_region` (default `eu`), `is_demo`, `created_at` | `is_demo` marks sample data |
| `ops_workspaces` | `id`, `organization_id` → org (cascade), `slug`, `name`, `environment` (production / staging / development), `created_at` | unique `(organization_id, slug)` and `(id, organization_id)` |
| `ops_memberships` | `id`, `organization_id`, `user_id` → `admin_users`, `role` (owner, admin, operator, reviewer, viewer), `created_at` | unique `(organization_id, user_id)` |
| `ops_agents` | `id`, `organization_id`, `workspace_id`, `key`, `name`, `status` (planned / active / paused / retired), `provider`, `model`, `version`, `purpose`, `created_at`, `updated_at` | composite FK to the workspace. The validators reject secret-like text and unknown fields. |

### Planned

All planned tables carry `organization_id` (and `workspace_id` where relevant). Each has a composite
FK to its parent and RLS.

| Table (store) | Purpose | Key columns |
| --- | --- | --- |
| `portal_users` (PG) | client principals, separate from staff | email, password hash, MFA secret ref, status, last_login |
| `ops_memberships` change | allow a client principal | `principal_type` (`staff` / `client`) + `principal_id`; CHECK on exactly one |
| `ops_invitations` (PG) | invite by e-mail | token hash, role, expires_at, accepted_at |
| `ops_agent_versions` (PG) | deployment history | agent_id, version, model, prompt_hash, config_hash, deployed_at, deployed_by, change_id |
| `ops_ingestion_keys` (PG) | telemetry credentials | workspace_id, prefix, key hash, scopes, created_by, expires_at, revoked_at, last_used_at |
| `ops_runs` (PG, partitioned by month) | one agent execution | run_id, trace_id, agent_id, agent_version, status, error_class, started_at, duration_ms, input_tokens, output_tokens, cost_micros, currency, sampled |
| `ops_spans` (columnar) | trace spans incl. model and tool calls | trace_id, span_id, parent_id, kind (llm / tool / retrieval / chain), name, start, duration_ms, status, gen_ai.* attributes, redacted attributes |
| `ops_usage_daily` (PG) | aggregates for dashboards and budgets | date, agent_id, model, provider, runs, failures, p50/p95 latency, tokens, cost_micros |
| `ops_price_table` (PG) | versioned model prices used to compute cost | provider, model, valid_from, input/output price per million tokens, currency, source |
| `ops_budgets` (PG) | spend thresholds | scope (org / workspace / agent), period, amount_micros, alert_at percent list |
| `ops_alert_rules`, `ops_alerts` (PG) | reliability and budget rules and their firings | metric, window, threshold, severity, channel; firing state, dedup key, incident_id |
| `ops_incidents`, `ops_incident_events` (PG) | lifecycle | severity, status (detected → triaged → notified → investigating → mitigated → resolved → reviewed), timeline entries with actor |
| `ops_eval_sets`, `ops_eval_cases`, `ops_eval_runs`, `ops_eval_results` (PG) | regression tracking | versioned cases (synthetic or approved), metric definitions, scores per agent_version, baseline links |
| `ops_review_items` (PG) | human review queue | run_id/span ref, reason, assignee, decision, comment, decided_at |
| `ops_feedback` (PG) | end-user feedback linked to runs | run_id, rating, category, comment (redacted) |
| `ops_report_schedules`, `ops_reports` (PG + object store) | scheduled PDF reports | cadence, recipients (members only), generated file ref, period |
| `ops_secret_refs` (PG) | references to vault entries for pull integrations | provider, vault path, scopes, rotated_at; **never the value** |
| `ops_retention_policies` (PG) | per-organisation overrides | data class, days, legal hold |

## 5. API contracts

All routes are under `/api/ops` and require a session. Writes require `X-CSRF-Token`. Errors use the
existing `{detail, code, request_id}` shape, localised in BG and EN. Responses are `no-store`.

### Implemented

| Method and path | Permission | Response |
| --- | --- | --- |
| `GET /organizations` | session | `[{id, slug, name, status, data_region, is_demo, role}]`, own memberships only |
| `GET /organizations/{org}` | `org.read` | `{organization, role, permissions[], workspaces, agents_by_status{}, telemetry:{connected:false, note}}` |
| `GET /organizations/{org}/workspaces` | `workspaces.read` | `[{id, slug, name, environment, created_at}]` |
| `POST /organizations/{org}/workspaces` | `workspaces.write` | 201 workspace; 409 `ops_conflict` |
| `GET /organizations/{org}/agents?workspace_id&status` | `agents.read` | `[{id, workspace_id, key, name, status, provider, model, version, purpose, created_at, updated_at}]` |
| `POST /organizations/{org}/agents` | `agents.write` | 201 agent. Returns 404 if the workspace is not in the organisation, and 422 for secret-like or invalid identifiers. |
| `PATCH /organizations/{org}/agents/{id}` | `agents.write` | agent, audited with the changed field names |
| `GET /organizations/{org}/members` | `members.read` | `[{id, user_id, email, full_name, role, created_at}]` |
| `POST /organizations/{org}/members` | `members.write` + rank rule | 201; 404 `ops_user_unknown`; 409 duplicate |
| `PATCH` / `DELETE /organizations/{org}/members/{id}` | `members.write` + rank rule | 409 `ops_last_owner` when the last owner would be removed or demoted |
| `GET /organizations/{org}/audit?limit` | `audit.read` | this organisation's `ops.*` entries only |

The CLI (`python -m app.cli ...`) provides:

* `ops-create-org --slug --name --owner-email`
* `ops-seed-demo --owner-email`: refused when `APP_ENV=production`
* `ops-purge-demo`

### Planned (MVP → V3)

| Method and path | Permission | Notes |
| --- | --- | --- |
| `POST /api/ingest/v1/traces` (OTLP/HTTP protobuf or JSON) | ingestion key | Separate host. Body ≤ 1 MB. Returns 202 with accepted, rejected and reason counts. |
| `POST /api/ingest/v1/events` | ingestion key | Batch of run, feedback or eval events (schema §7). Idempotent on `event_id`. |
| `GET /organizations/{org}/runs?agent&status&from&to&cursor` | `runs.read` | cursor pagination, max 7-day window per request |
| `GET /organizations/{org}/runs/{run_id}` | `runs.read` | Spans tree. Content attributes only with `traces.content`. |
| `GET /organizations/{org}/usage?from&to&group_by=agent\|model\|day` | `usage.read` | from aggregates; never raw spans |
| `GET/PUT /organizations/{org}/budgets` | `budgets.write` for PUT | |
| `GET/POST /organizations/{org}/alert-rules`, `GET /alerts` | `alerts.write` / `alerts.read` | |
| `GET/POST/PATCH /organizations/{org}/incidents` | `incidents.read` / `incidents.write` | Each transition creates an incident event. |
| `GET /organizations/{org}/evaluations`, `POST /evaluations/{id}/runs` | `evals.read` / `evals.run` | |
| `GET /organizations/{org}/reviews`, `POST /reviews/{id}/decision` | `reviews.read` / `reviews.decide` | |
| `GET/POST /organizations/{org}/ingestion-keys`, `DELETE /{id}` | `keys.manage` | The key is shown **once** at creation and only a prefix afterwards. |
| `GET/POST /organizations/{org}/reports`, `/report-schedules` | `reports.read` / `reports.write` | |

## 6. RBAC matrix

Roles are per organisation. **Bold** permissions are implemented. The others are reserved for the
listed phase.

| Permission | Owner | Admin | Operator | Reviewer | Viewer | Phase |
| --- | :-: | :-: | :-: | :-: | :-: | --- |
| **org.read** | ✓ | ✓ | ✓ | ✓ | ✓ | scaffold |
| **workspaces.read** / **agents.read** | ✓ | ✓ | ✓ | ✓ | ✓ | scaffold |
| **agents.write** | ✓ | ✓ | ✓ | – | – | scaffold |
| **workspaces.write** | ✓ | ✓ | – | – | – | scaffold |
| **members.read** / **members.write** | ✓ | ✓ | – | – | – | scaffold |
| **audit.read** | ✓ | ✓ | – | – | – | scaffold |
| runs.read, usage.read, alerts.read, incidents.read, reports.read | ✓ | ✓ | ✓ | ✓ | ✓ | MVP–V2 |
| traces.content (redacted prompt and response text) | ✓ | ✓ | ✓ | ✓ | – | V2 |
| reviews.read / reviews.decide | ✓ | ✓ | – | ✓ | – | V2 |
| evals.read / evals.run | ✓ | ✓ | ✓ | ✓ / – | ✓ / – | V2 |
| incidents.write | ✓ | ✓ | ✓ | – | – | V2 |
| budgets.write, alerts.write, reports.write | ✓ | ✓ | – | – | – | V2 |
| keys.manage (ingestion keys) | ✓ | ✓ | – | – | – | V2 |
| retention.write, org.settings | ✓ | – | – | – | – | V3 |

Membership rules:

* Only owners grant, change or remove owners. Others may manage roles of equal or lower rank.
* An organisation always keeps at least one owner.
* Every change is audited with `organization_id`.

## 7. Event and trace schema

The design follows the **OpenTelemetry GenAI semantic conventions**:

* model calls: `gen_ai.system`, `gen_ai.operation.name`, `gen_ai.request.model`,
  `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`;
* tools: `gen_ai.tool.name`.

Studio attributes use the `acs.` prefix.

```jsonc
// Run event (POST /api/ingest/v1/events) — tenant and workspace come from the ingestion key.
{
  "schema": "acs.run.v1",
  "event_id": "01JB7Z8K3W6Q9V2M4T5R6Y7U8I",       // ULID, idempotency key
  "occurred_at": "2026-11-03T09:14:22.418Z",
  "agent_key": "support-assistant",                // must exist in the workspace registry
  "agent_version": "v1.4",
  "run_id": "run_9f2c…", "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "status": "error",                               // ok | error | timeout | cancelled | escalated
  "error_class": "tool_timeout",                   // enumerated, no free text
  "duration_ms": 8120,
  "usage": [{ "provider": "anthropic", "model": "claude-opus-5-5", "input_tokens": 1830, "output_tokens": 412 }],
  "tool_calls": [{ "name": "crm.lookup", "status": "error", "duration_ms": 5000 }],
  "retrieval": { "documents": 4, "top_score": 0.71 },
  "human_review": { "required": true, "reason": "low_confidence" },
  "attributes": { "channel": "email" }             // ≤ 20 keys, scalar values, allow-listed per workspace
}
```

Span (OTLP) required attributes:

* `acs.agent_key`, `acs.agent_version`, `acs.run_id`;
* `gen_ai.*` on LLM spans;
* `acs.span_kind` (`llm` / `tool` / `retrieval` / `chain` / `guardrail`).

**Content** (`gen_ai.prompt`, `gen_ai.completion`, tool arguments and results) is **dropped by
default**. It is accepted only when the workspace enables content capture, after redaction at the
client's collector *and* at the gateway. It is stored in a separate column with a shorter retention.

Cost is **computed by us** from `ops_price_table` (versioned, with a source and a valid-from date).
Client-sent cost fields are ignored, and each run records the price-table version it used.

Validation:

* unknown `schema` → reject;
* unknown `agent_key` → accept, but flag it as unregistered;
* timestamps outside −24 h … +5 min → reject;
* attribute values longer than 256 characters → truncate;
* secret-pattern hits → drop the attribute and count it.

## 8. Retention and security design

| Data class | Default retention | Store | Notes |
| --- | --- | --- | --- |
| Registry, memberships, settings | life of contract + 30 days | PG | deleted on offboarding |
| Run index and aggregates | 13 months; runs older than 90 days kept only as daily aggregates | PG | partitions dropped monthly |
| Spans (metadata) | 30 days | columnar | TTL per partition |
| Captured content (opt-in) | 7–14 days | columnar, separate column or table | redacted; off by default |
| Evaluations, reviews, incidents, changes | life of contract | PG | evidence for quality and audit |
| Audit log | `AUDIT_RETENTION_DAYS` (existing) | PG | org-scoped view |
| Reports (PDF) | 13 months | object store, encrypted | |
| Ingestion keys | until revoked; hash only | PG | rotation reminders |

The retention CLI (`maintenance`) is extended with per-organisation overrides and legal hold.

Security controls:

* **Secrets.** Client credentials (pull integrations) live only in a secrets manager. The database
  stores a reference. The UI never shows or returns a secret value. Ingestion keys are shown once
  and stored as SHA-256 hashes with a visible prefix. Existing form validators already reject
  key-like text, and the registry uses the same check.
* **Authentication.** For clients:
  * mandatory MFA (TOTP or WebAuthn) and invitation-only accounts;
  * the same session model as staff (opaque token, CSRF, idle timeout) and lockout;
  * optional SSO (OIDC) in V3.
* **Authorization.** Tenant isolation (§3) and the RBAC matrix (§6). All tenant reads go through
  the scoped helpers. RLS is the backstop.
* **Transport and storage.** TLS everywhere. The ingestion host is separate from the website. The
  database and object store are encrypted at rest, in an EU region (`data_region`).
* **Privacy.**
  * A DPA must be signed before any production data is received.
  * Redaction happens at the client collector and again at the gateway.
  * Content capture is opt-in per workspace.
  * Access to content is a separate permission (`traces.content`).
* **Audit.** Every human action, every support-access grant and every key event is audited with
  `organization_id`. Tenants see only their own entries.
* **Abuse and availability.**
  * per-key rate limits and payload caps;
  * the queue absorbs bursts and back-pressures with a 429 plus `Retry-After`;
  * alerts never execute changes in client systems.

## 9. Roadmap

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| **Scaffold** (done) | Tenancy tables, RBAC, scoped API, staff UI, demo flag, tests | Authorization and isolation tests pass; no telemetry shown |
| **MVP: client read-only portal (manual data)** | Restricted DB role and RLS on all ops tables. Client accounts with invitations and MFA. Client portal routes (`/portal`, separate layout, `noindex`). Agent versions/deployments. Incidents with manual entry and a timeline. Monthly report upload (PDF). Usage import from provider CSV or usage API via a vault reference. Support-access grants. | Penetration test of auth and isolation; RLS tests with the restricted role; DPA template; one pilot client |
| **V2: telemetry** | Ingestion gateway and keys, Redis rate limits and queue, run/span storage, cost computation, overview and observability dashboards from real data, budgets and alert rules → incidents, e-mail/webhook notifications, evaluations and regression tracking, human review queue, feedback | Load test at the target event rate; end-to-end redaction tests; alert latency within the agreed target; data deletion verified |
| **V3: scale and governance** | Scheduled reports, retention overrides and legal hold, SSO (OIDC), SCIM-style user provisioning, per-tenant quotas, columnar-store tuning, change management linked to evaluations, synthetic probes | Tenant self-service for keys and members; audit export |

## 10. Operational risks and dependencies

| Risk | Mitigation |
| --- | --- |
| Cross-tenant leakage through a missed filter | Scoped helpers as the only access path; RLS with a restricted DB role; per-route isolation tests; code review checklist |
| The DB role bypasses RLS (owner or superuser) | Separate migration role and runtime role; a test that asserts the runtime role has no `BYPASSRLS` |
| Sensitive content in telemetry | Content capture off by default; double redaction; separate permission and short retention; DPA |
| Holding client credentials | Prefer push; vault references only; scoped, read-only keys; rotation |
| Inaccurate cost figures | Computed from a versioned, sourced price table; labelled as estimates; reconciled with provider invoices monthly |
| Alert fatigue or missed incidents | Dedup and grouping; severity routing; quiet hours; regular rule review |
| Volume growth (spans) | Sampling at the collector, aggregation, columnar store, partition TTLs |
| Single-node deployment (Compose) | Managed PostgreSQL with backups; separate ingestion service; health checks; documented recovery |
| Expectation gap (portal ≠ SLA) | The public page shows the portal as planned; contracts define response times; no telemetry claims before connection |

Dependencies:

* a secrets manager;
* Redis (rate limits and queue);
* a columnar or time-series store;
* object storage for reports;
* an e-mail provider (existing SMTP);
* MFA library and WebAuthn;
* a DPA and legal review;
* a penetration test before the MVP;
* client-side OpenTelemetry instrumentation.

## 11. The scaffold in practice

| Area | Files |
| --- | --- |
| API | `app/ops/rbac.py`, `app/ops/tenancy.py`, `app/ops/schemas.py`, `app/ops/service.py`, `app/routers/ops.py`, migration `alembic/versions/20261027_0008_ops_tenancy.py` |
| Tests | `tests/test_ops_portal.py` |
| Staff UI | `/admin/operations` (`components/admin/Operations.tsx`, tests in `components/admin/operations.test.tsx`), which is read-only |
| Public page | `/bg/uslugi/ai-managed-services` ↔ `/en/services/ai-managed-services`, sections "What operating your AI systems covers" (`#ams-operations`) and "AI Operations Portal — in development" (`#ams-portal`) |

The tests in `tests/test_ops_portal.py` cover:

* unauthenticated access and CSRF;
* own organisations only;
* foreign organisation ≡ missing (404);
* foreign ids through the own path;
* the database rejecting a cross-tenant workspace;
* the audit view scoped per organisation;
* the RBAC matrix per role;
* owner and last-owner rules;
* secret and identifier validation;
* suspended organisations being read-only;
* the overview reporting no telemetry;
* demo data refused in production.

Try it locally (development only):

```bash
docker compose exec api python -m app.cli ops-seed-demo --owner-email <your admin e-mail>
```

Then open `/admin/operations`: the demo organisation is labelled "sample data". To remove it:

```bash
docker compose exec api python -m app.cli ops-purge-demo
```
