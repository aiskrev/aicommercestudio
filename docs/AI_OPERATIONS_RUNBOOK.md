# AI operations runbook: incidents and controlled changes

Status: implemented on 2026-11-03 (`app/ops/workflows.py`, staff UI tabs "Incidents" and "Changes").

This is a **record-management module**:

* it never changes a client system;
* it sends no notifications;
* it does not imply round-the-clock cover;
* response times exist only where a signed contract defines them.

It records who decided what, when and why.

## Roles

These come from the permission matrix ([AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md)).

| Action | Permission | Roles |
| --- | --- | --- |
| Record an incident, move it until resolved, add notes and evidence | `incidents.write` | owner, admin, operator |
| Review a resolved incident | `incidents.review` | owner, admin, reviewer |
| Propose a change and move it through risk review, evaluation and release | `changes.write` | owner, admin, operator |
| Approve, reject or review a change | `changes.approve`, never the change's author | owner, admin, reviewer |

## Incident workflow

```
detected → triaged → investigating → mitigated → resolved → reviewed
                              ↑______________|   (mitigated → investigating re-opens)
```

1. **Detected.** Record the title, severity (SEV1–SEV4) and impact (customer-facing, internal, cost,
   security, data quality). Optionally add the agent, an owner (must be a member) and a client summary.
   The client summary is the only text the client portal shows.
2. **Triaged.** Confirm the severity and the owner.
3. **Investigating.** Add evidence: log excerpts and screenshots described in text. Never add
   passwords, keys, tokens or customer records: the API refuses secret-like text and any markup.
4. **Mitigated.** The impact is contained, for example by rolling back to an earlier registry version.
   Record it as the incident's `rollback_version_id`.
5. **Resolved.** A note is required: what fixed it.
6. **Reviewed.** Someone with `incidents.review` holds the post-incident review. A note is required:
   causes, actions and owners.

Rules that hold for every step:

* Each transition names `expected_version`. A concurrent change gets 409 `ops_stale`: reload and
  repeat.
* Each step appends an entry to the immutable timeline and to the audit log, with the person.
* A suspended organisation is read-only.

## Change workflow

```
draft → risk_review → evaluation → human_approval → approved → released → reviewed
                                        └→ rejected → draft
```

1. **Draft.** Choose the agent version from the registry and a risk level. Optionally add a rollback
   version of the same agent.
2. **Risk review.** Record the risk notes: what could go wrong, who is affected and how to roll back.
3. **Evaluation.** Run the evaluation suite on the change's version and link the run. A run of another
   version is refused. Simulated runs are labelled as such in the change.
4. **Human approval.** A person other than the author, with `changes.approve`, approves or rejects. A
   rejection needs a note. Approval needs the registry version to be **approved**, which is itself a
   separate four-eyes decision for sensitive versions. Evaluation output never approves anything.
5. **Released (recorded).** Record the release note: what was deployed, where and by whom. **The
   platform deploys nothing**; the release happens in the client's own process.
6. **Reviewed.** After the release, a reviewer records the outcome.

## What to check in an incident involving an AI system

* **Which version was live?** Check the approved version in the registry, its diff to the previous
  version and its last evaluation.
* **What changed recently?** Check recorded releases and their approvals.
* **Do the records show an anomaly?** Check usage and cost in the Observability tab, remembering that
  it shows imports or synthetic records, not live telemetry.
* **Is a rollback needed?** If so, create a rollback draft from the last good version, evaluate it and
  take it through a change.

## Tests

* `apps/api/tests/test_ops_observability_workflows.py` covers:
  * every allowed and forbidden transition;
  * permissions per step;
  * stale versions;
  * required notes;
  * sanitisation (markup, secrets, control characters);
  * owners outside the organisation;
  * cross-tenant access;
  * the full change flow with the evaluation requirement, the second person and the approved registry
    version;
  * the rejection path.
* `apps/api/tests/test_ops_security.py` shows that the database refuses to rewrite the timelines.
* The UI tests are in `ops-platform.test.tsx`; the e2e test is `ops-platform.spec.ts`.
