# AI Operations Console — target architecture (not implemented)

> This document describes a **future** multi-tenant console for AI Managed Services. Nothing here
> exists in the codebase yet. The public website must not show live telemetry or imply that this
> console runs; any demonstration must use clearly labelled synthetic data.

## Goal

Give the studio (and later each client) one place to see the health, quality, cost and incidents
of the AI systems we operate, without ever weakening the client's own security boundaries.

```
 Client AI systems (agents, RAG apps, workflows)
        │  push: OpenTelemetry traces / structured events (client-controlled exporter)
        │  pull: read-only provider usage APIs (scoped keys stored in a secrets manager)
        ▼
 Ingestion API ──▶ queue ──▶ processors (PII redaction, cost calc, eval scoring)
                                   │
                                   ▼
                    Postgres (tenants, systems, incidents, evaluations)
                    + time-series / columnar store (metrics, traces)
                                   │
                                   ▼
                    Console (Next.js, admin + client roles) ── alerts (e-mail / chat webhook)
```

## Core entities

| Entity | Purpose |
| --- | --- |
| `tenant` | a client organisation; strict row-level isolation |
| `ai_system` | one agent / workflow / app: provider, model, environment, owner |
| `integration` | how data arrives (OTel exporter, provider usage API, log export) and its scope |
| `health_check` | synthetic probes (scheduled test conversations) and their results |
| `evaluation_set`, `evaluation_run` | versioned test cases and scored runs (regression detection) |
| `cost_record` | usage and cost per system/model/day from provider data |
| `incident` | detection → triage → mitigation → resolution → post-incident review |
| `change` | prompt/model/tool/config changes with approval and rollback reference |
| `audit_log` | every human and system action, as in the current admin |

## Security requirements

* **No client secrets in the website or lead database.** Credentials for read-only provider APIs
  live in a secrets manager, scoped per tenant, rotated, never shown in the UI.
* Prefer **push** (the client's exporter sends redacted telemetry) over us holding credentials.
* PII redaction before storage; configurable retention per tenant; EU data residency.
* Tenant isolation enforced in the database (row-level security) and tested.
* Model output never triggers actions directly; remediation steps that change client systems
  require a human approval recorded in the audit log (same principle as the current
  `ai_action_requests` approval flow).
* DPA with each client before any production data is received.

## Phasing (indicative)

1. **Manual operations with templates** — monthly reports, incident procedure and evaluation sets
   kept per client; no console. *(Possible today with existing tools.)*
2. **Internal console** — tenants, systems, incidents, changes; manual data entry plus provider
   usage import. Studio staff only.
3. **Telemetry ingestion** — OTel endpoint, health probes, evaluation runner, alerts.
4. **Client portal** — read-only client view of their systems, reports and incidents.

Dependencies: the existing auth, audit, approval and retention components of `apps/api` can be
reused; the lead pipeline stays separate from operational data.
