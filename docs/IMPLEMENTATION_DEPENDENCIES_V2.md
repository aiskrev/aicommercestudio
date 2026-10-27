# Implementation dependencies: next generation (V2)

**Baseline:** `main` @ `565d0b1`, Alembic head `0008`. All suites green (see
[PLATFORM_BASELINE_AUDIT.md](PLATFORM_BASELINE_AUDIT.md) §1).

This document orders the next-generation work by **hard dependencies**. Each phase lists what it
needs, what it must not break, and the acceptance criteria to check before the next phase starts.
The target design for the portal is [AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md).

## 1. Dependency graph

```
P0 Baseline hygiene (docs sync, branch cleanup, owner decisions)
 │
 ├─► P1 Data-platform hardening ──────────────┐
 │     restricted DB role + RLS, manual        │
 │     migration gate, Redis (limiter), queue  │
 │                                             ▼
 ├─► P2 Identity: staff roles + MFA ──► P3 Client identity (accounts, invitations, MFA,
 │                                          principal type in memberships)
 │                                             │
 │                                             ▼
 │                                       P4 Client portal MVP (read-only, manual data:
 │                                          registry, versions, incidents, reports)
 │                                             │
 │            P1 (queue, Redis) ─────────────► P5 Telemetry ingestion (keys, gateway,
 │                                          runs/spans, cost computation, usage aggregates)
 │                                             │
 │                                             ├─► P6 Quality: evaluations, regression, review queues, feedback
 │                                             └─► P7 Alerts, budgets, incidents automation, scheduled reports
 │
 └─► Parallel, independent tracks (no portal dependency):
       T1 Production deployment (hosting, SITE_URL, secrets, backups, monitoring)
       T2 Legal texts and company details (owner)
       T3 AI action executor (approval queue → audited execution)
       T4 Integrations (Shopify, WooCommerce, CRM) behind the approval policy
       T5 Performance: admin bundle split, mobile homepage TBT
```

Hard rules:

* No client login (P3) before P1 RLS and P2 MFA are in place.
* No telemetry (P5) before P1 queue and limiter, and before a signed DPA.
* No alert may change client systems; changes go through T3 with human approval.

## 2. Branch integration rules

* **Start every phase from fresh `origin/main`**, with one branch per phase or track. The audit
  found no unmerged work. Do **not** base work on `design/premium-editorial-redesign`,
  `ci/phase-0-foundations` or `fix/restore-v1-logo`: they are superseded and conflict with `main`.
  Delete them after the owner confirms.
* **Migrations are numbered sequentially from `0009`,** one revision per branch.
  * If two branches add migrations in parallel, the second must be rebased and renumbered before
    merge, so there is one head.
  * CI enforces this: `alembic check` plus the round-trip test.
* **Shared files** often conflict between parallel branches:
  * `app/models.py`, `app/i18n.py`, `app/main.py`
  * `src/content/index.ts`, `src/lib/routes.ts`, `src/i18n/config.ts`, `src/lib/tools.ts`
  * `apps/api/tests/conftest.py` (`TABLES`)

  Keep edits to them minimal and additive. Merge `main` into long-lived branches daily.
* **Squash merges create new hashes.** After a squash merge, merge `main` back into any branch that
  continues, or the next PR will conflict on identical content. This is what happened in #13–#16.
* **Golden vectors** (`readiness.vectors.json`, `team.vectors.json`, `team-texts.json`) must change
  in both apps in the same PR.

## 3. Recommended order and acceptance criteria

### P0: Baseline hygiene (docs only, no behaviour change)

Scope:

* Sync the documents listed in the audit §6: `README`, `ARCHITECTURE`, `INFORMATION_ARCHITECTURE`,
  `IMPLEMENTATION_STATUS`, `ROADMAP`, `SECURITY`, `TESTING`, `API_REFERENCE` (`/api/ops`),
  `DATABASE_SCHEMA` (`ops_*`), `PLATFORM_EXPANSION_PLAN` checkboxes, and the status lines in the
  UI and visual-direction reports.
* Delete the superseded branches.
* Record the owner decisions (§4).

Acceptance criteria:

- [x] Every contradiction in audit §6 is resolved, or marked as historical with a date (2026-10-27).
      The privacy-policy gap is tracked as a content and legal task (T2).
- [x] `README` links every document in `docs/`. This is enforced by `docs_sync.py`.
- [x] `API_REFERENCE` lists every route in `app/routers/*`. `apps/api/scripts/docs_sync.py` compares
      the FastAPI routes and `openapi.json` with the documents, and runs in `scripts/test.ps1 -Suite api`.
- [ ] Remote branches: `main` plus active work only. Deleting the superseded branches waits for the
      owner's go-ahead.

### P1: Data-platform hardening

Scope:

* Separate the migration role (owner) from the runtime role (no `BYPASSRLS`, DML only).
* Add RLS policies on all `ops_*` tables, using `SET LOCAL app.org_id` per transaction from
  `require()`.
* Add a manual migration gate: `RUN_MIGRATIONS_ON_START=false` in production plus a documented
  `alembic upgrade` step.
* Move the rate limiter to Redis.
* Add a job queue (Redis Streams) with one worker container.

Depends on: P0.

Acceptance criteria:

- [ ] A test connects as the runtime role and proves that reading or writing another
      organisation's rows returns 0 rows or fails, **even with a query that omits the
      `organization_id` filter**.
- [ ] A test asserts that the runtime role has neither `rolbypassrls` nor table ownership.
- [ ] Every existing suite passes with the runtime role (369 / 461 / 84 or more).
- [ ] Production compose does not run migrations on start. `DEPLOYMENT.md` has the manual step and
      the rollback.
- [ ] The rate limit holds across 2 API replicas (a test with two app instances sharing Redis).
- [ ] The queue survives a worker restart without losing jobs (an integration test).

### P2: Staff roles and MFA

Scope:

* `admin_users` gains a role (`staff_admin`, `staff`) and TOTP MFA (secret encrypted with a key
  outside the database).
* Add recovery codes.
* Audit every MFA event.

Depends on: P0.

Acceptance criteria:

- [ ] A login without the second factor cannot reach any `/api/admin/*` or `/api/ops/*` route.
- [ ] Lockout, idle timeout and CSRF behaviour still pass the existing tests.
- [ ] MFA reset is possible only through the CLI, and it is audited.
- [ ] The secret is never returned by the API after enrolment, and is never logged.

### P3: Client identity

Scope:

* Add a `portal_users` table, separate from staff, with invitation-only sign-up, MFA,
  password reset and session management (the same model as admin).
* `ops_memberships` gains `principal_type` / `principal_id`, with a CHECK that exactly one is set,
  and data migrated from `user_id`.

Depends on: P1 (RLS), P2 (MFA patterns), a DPA template.

Acceptance criteria:

- [ ] Invitation tokens are stored hashed, expire, are single-use and audited.
- [ ] A client principal can never call `/api/admin/*` (a test for every admin route).
- [ ] The cross-tenant tests from `test_ops_portal.py` are repeated for client principals and pass.
- [ ] The migration upgrades and downgrades with existing staff memberships preserved.

### P4: Client portal MVP (read-only, manual data)

Scope:

* Add `/portal` (separate layout, `noindex`, BG/EN): overview, agent registry with
  versions/deployments, incidents with a timeline (staff-entered), and reports (PDF upload to
  object storage).
* Add support-access grants for staff, time-boxed and audited.

Depends on: P3.

Acceptance criteria:

- [ ] Every page shows only the caller's organisations. An e2e test with two client users from
      different organisations proves this.
- [ ] Empty states say "not connected" and no number is shown without a data source. A content
      test enforces this.
- [ ] A support-access grant expires automatically, and every use is audited with
      `organization_id`.
- [ ] WCAG 2.2 AA checks pass (keyboard, focus, contrast, 24 px targets). There is no horizontal
      overflow at 360/390/768/1024/1440.

### P5: Telemetry ingestion

Scope:

* Ingestion keys: hashed, shown once, bound to a workspace.
* A separate gateway service accepting OTLP/HTTP and `acs.run.v1` events.
* Redaction, idempotency, per-tenant quotas, runs and spans storage, and cost computation from a
  versioned price table.
* Usage aggregates.

Depends on: P1 (queue, Redis), P4 (where data is shown), a signed DPA and the content-capture
policy.

Acceptance criteria:

- [ ] The gateway never trusts `organization_id` or `workspace_id` from the payload. A test sends a
      foreign id and the event lands in the key's workspace or is rejected.
- [ ] Replaying an `event_id` does not duplicate data.
- [ ] Payloads with secret or PII patterns are stored redacted, and the count is reported.
- [ ] Content capture is off by default. When enabled, it is stored separately with a shorter
      retention.
- [ ] Every cost is computed from the price table and records the price-table version. Cost
      values sent by the client are ignored.
- [ ] A load test at the agreed event rate shows no event loss and that queue lag recovers.

### P6: Quality (evaluations, regression, review)

Depends on: P5.

Acceptance criteria:

- [ ] Evaluation sets and cases are versioned. Every run is linked to `agent_version`.
- [ ] A regression is detected against a stored baseline.
- [ ] Review decisions require `reviews.decide` and are audited.
- [ ] Viewers cannot read captured content (`traces.content`).

### P7: Alerts, budgets, incidents, reports

Depends on: P5 (and P6 for quality alerts).

Acceptance criteria:

- [ ] Alerts are deduplicated and grouped into incidents. Incident transitions are audited.
- [ ] Budget alerts fire on thresholds computed from aggregates.
- [ ] Notifications go only to members of the organisation.
- [ ] No alert or rule can execute a change in a client system. A test asserts that no outbound
      action path exists.
- [ ] Scheduled reports contain only that organisation's data.

### Parallel tracks

| Track | Depends on | Acceptance criteria |
| --- | --- | --- |
| T1 Production deployment | owner (hosting, domain, DPA); P1's migration gate recommended | HTTPS. Correct `SITE_URL` baked at build. Backups and a restore rehearsal. `RELEASE_REPORT.md` post-deploy checks pass. Lighthouse re-run on HTTPS. |
| T2 Legal and company details | owner, legal review | Drafts replaced. `legal.isDraft=false`. Pages indexable. Footer placeholder removed. The privacy policy also covers readiness submissions and saved AI team configurations. |
| T3 AI action executor | P2 (roles) | Only `APPROVED` actions execute, exactly once, with an idempotency key. Rejected or pending actions never execute. Every execution is audited (`EXECUTED`). Critical actions need two approvers. |
| T4 Integrations | T3; vault for credentials | Read-only first. Writes only through T3. Credentials are only in the vault and never returned to the UI. |
| T5 Performance | none | Admin client bundle no longer includes public content. Mobile `/bg` Lighthouse median (3 runs) ≥ 90 on the production host, or a documented cause. |

## 4. Owner decisions that block or shape the work

| Decision | Blocks |
| --- | --- |
| Hosting provider and EU region, managed PostgreSQL, Redis and object storage | T1, P1 (Redis), P4 (reports storage), P5 |
| DPA templates (client ↔ studio, studio ↔ AI provider) | P3, P5 |
| Content-capture policy for telemetry (allowed or not; retention) | P5, P6 |
| MFA method (TOTP only, or also WebAuthn) | P2, P3 |
| Delete the superseded branches | P0 |
| Legal texts and company registration | T2, public launch |

## 5. Blocking issues found by the audit

There is none for continuing development: every suite passes, there is one migration head, and all
branch work is in `main`.

For **client-facing** portal work, these are blockers:

* RLS cannot be enforced while the API connects as the schema owner (P1).
* There are no client principals or MFA (P2, P3).
* There is no DPA.
