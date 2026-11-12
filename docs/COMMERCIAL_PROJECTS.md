# Commercial customer projects (Phase 09)

Commercial expansion, Phase 09. The customer workspace gets a **delivery** side: the projects the team builds for a
customer, from a draft to maintenance. It is a separate area next to the AI Operations portal and the Advisor Workspace
and does not replace or merge either of them. Everything is behind `COMMERCIAL_PROJECTS_ENABLED=false`; the customer side
also needs `CUSTOMER_ACCOUNTS_ENABLED`, and production refuses the first flag without the second. While off, every route
and page answers 404.

## What a customer sees

The page `/bg/konto/izrabotka` ↔ `/en/account/delivery` (a project is opened with `?p=<id>`):

* a list of the workspace's projects (never drafts);
* one project: status and what it means, the summary, the **approved scope** (an immutable copy of the accepted
  quotation's approved version), the milestones, contract and invoice **numbers**, the maintenance plan, the history
  (status changes, updates, deliveries, the customer's own requests and the team's replies);
* the actions the server allows right now: approve the scope, accept the result, ask for changes;
* change requests and support requests (open to every member of the workspace).

Staff names and e-mail addresses are never sent to a customer: history entries say "The team". Internal notes are never
sent. The pages are `noindex`, every API answer is `Cache-Control: no-store`, and the pages hold no data of their own:
the browser asks the API with the customer session.

## Lifecycle

```
draft ──staff──▶ quotation ──staff──▶ awaiting_approval ──client──▶ approved ──staff──▶ in_progress
                                                                                         │   ▲
                                                                   staff ────────────────┘   │
                                                                   ▼                         │
                                                              client_review ──client/staff───┘  (changes, note required)
                                                                   │
                                                                   └──client/staff──▶ completed ──staff──▶ maintenance ──staff──▶ in_progress
```

| From | To | Who | Condition |
| --- | --- | --- | --- |
| draft | quotation | staff | the customer sees the project from here on |
| quotation | awaiting_approval | staff | an accepted quotation of the same inquiry is linked |
| awaiting_approval | approved | **customer only** (owner or `billing`) | the customer saw the current revision (the page asks for the statement first) |
| approved | in_progress | staff | |
| in_progress | client_review | staff | note required |
| client_review | in_progress | customer or staff | note required (what should change) |
| client_review | completed | customer, or staff with a note saying how the customer accepted | |
| completed | maintenance | staff | |
| maintenance | in_progress | staff | |

Any other move answers 409 `project_transition`. Staff cannot approve a scope on the customer's behalf (the schema has no
such move). A repeated customer decision answers with the recorded result and writes nothing twice; two simultaneous
decisions wait on a row lock, so one is recorded and the other repeats it. A decision made on an old revision answers
409 `project_stale`.

## Who may do what

| Action | Owner | `billing` | `member` | Staff administrator | Other staff |
| --- | --- | --- | --- | --- | --- |
| Read the workspace's projects | yes | yes | yes | – | – |
| Approve the scope, accept the result, ask for changes | yes | yes | no (403) | – | – |
| Send a change or support request | yes | yes | yes | – | – |
| Create a project, edit it, move it, post updates, reply | – | – | – | yes | no (403) |
| Read every project, with internal notes | – | – | – | yes | no (403) |

The workspace is the caller's own, or one they belong to (`X-Workspace`, checked by the same function the zone uses). A
project is looked up inside that workspace only, so a project of another workspace answers exactly like one that does not
exist (404 `project_not_found`). Staff choose the customer by the **e-mail of a verified, non-erased account**; no route
accepts a workspace id, an owner id or an amount.

## Data

Tables `commercial_projects`, `project_milestones`, `project_events` (migration `0028`, local only like 0026/0027 until
the owner approves a release). They are separate from `workspace_projects` (the AI Operations portal). A project keeps:
the workspace, the inquiry, the accepted quotation and the scope snapshot with its version, contract and invoice
**references** (strings), a maintenance plan key and note, a revision for optimistic concurrency, who approved and when.
There is no price, no amount and no document in this phase (documents and uploads: Phase 10, uploads stay disabled).

Constraints in the database: valid status, revision ≥ 1, valid milestone state, valid event kind and author, and a request
(`change_request`, `support`) always has a state while nothing else has one. One project per accepted quotation (unique
index), and one per inquiry and title otherwise. Runtime roles are granted what they need and nothing more.

## Audit and privacy

Every change writes an audit record (`project.created`, `project.transition`, `project.approve_scope`,
`project.accept_completion`, `project.request_changes`, `project.change_request`, `project.support`, `project.response`,
`project.updated`, `project.milestones`, `project.update`, `project.delivery`) with ids and states, never message text.

Customer export (`GET /api/accounts/data/export`) now contains the account's projects (reference, title, status, dates and
the customer's own messages). Erasure: an account that owns commercial projects is **anonymised, not deleted**, like one
that owns accounting data; the customer's own messages are replaced with "[erased]" and lose their author.

## Staff screens

`/admin/projects` (list with a status filter, and the management view of one project with `?id=`), and a panel on the
inquiry page, under the quotation, that creates a draft for a verified account and lists the inquiry's projects. Editors and
viewers reach only the catalogue: every project route answers 403 to them, like the leads.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `COMMERCIAL_PROJECTS_ENABLED` | `false` | routes and pages of this phase (API and web) |
| `PROJECT_READ_RATE_LIMIT` / `PROJECT_ACTION_RATE_LIMIT` / `PROJECT_RATE_WINDOW_SECONDS` | 120 / 30 / 600 | per customer account |

## Tests

* `apps/api/tests/test_projects.py` (about 40 tests): flags, creation and idempotency, draft invisible, the whole
  lifecycle, every invalid move, notes and revisions, simultaneous approvals, workspace roles, cross-tenant access, requests,
  milestones and references, staff authorization, audit, erasure and export, database constraints and grants.
* `apps/api/tests/test_accounts_hardening.py` now includes `/api/projects` in the route check (401 without a session, 403
  without CSRF, a staff cookie opens nothing).
* `apps/web/src/components/account/deliveryProjects.test.tsx`, `apps/web/e2e/tests/delivery-projects.spec.ts` (legal
  stack: sign-in required, own and foreign project, role-based actions, 360–1440 px, axe).

## What is not here

Documents and uploads (Phase 10), e-mail to the customer (Phase 11: the pages say plainly that the system sends none),
invoices and amounts (Phase 13), customer MFA (D-22), a notification when the team replies. The wording next to "approve
the scope" is not lawyer-approved (D-25) and says it does not replace a written agreement.
