# Admin CRM (Phase 12)

Commercial expansion, Phase 12. This is **not** a second CRM. It extends the existing admin (leads, opportunities,
proposals, quotations, commercial projects, the audit log) with what a sales pipeline was missing: an owner on every
enquiry, follow-up tasks, an overview of real counts, one timeline per enquiry, links from an enquiry to its customer and
projects, and a safe export. Staff roles are the existing ones: **every CRM route needs the `admin` role** (editors and
viewers reach only the catalogue), exactly like leads. Customer accounts stay a separate identity; nothing here is
reachable with a customer session. No flag is needed: it adds no customer-facing surface.

## What exists and what was added

| Area | Where it already was | Added in Phase 12 |
| --- | --- | --- |
| Unified enquiry list | `/admin/leads` with filters for status, service, type, language, date, search | filter by **owner** (mine, unassigned, one person) and by the qualification of the opportunity; owner on every row |
| Detailed configuration view | lead page with the configurator, basket, readiness, team and solution panels | – |
| Quote preparation, scope editing, revisions, human approval | opportunity and proposal panels (versions, review, approve), quotations | – (unchanged) |
| Sales status | `LeadStatus` (new, contacted, qualified, proposal, won, lost) and the qualification of the opportunity | – |
| Project after confirmed acceptance | create-project panel under the quotation (Phase 09) | link from the enquiry to its projects and quotations |
| Internal notes | lead notes | shown in the timeline |
| Follow-up tasks | one "next action" per opportunity | **many tasks per enquiry**: text, date, assignee, state, revision |
| Activity timeline | raw audit list per lead | **one timeline** joining audit, notes, proposals, quotations, projects and tasks |
| Customer and project navigation | project → lead | lead → customer account (exists, verified), projects, quotations |
| Reporting | dashboard counts | **overview** of real counts and workload per owner |
| Safe export | – | pipeline CSV without personal data |

## Owner and follow-ups

* `leads.owner_id` (an active administrator, or none). `PUT /api/admin/leads/{id}/owner` sets or clears it; the same value
  again changes nothing; only an active administrator can be chosen (422 `assignee_invalid`), because only administrators
  can see enquiries. Every change is audited (`lead.owner_set`).
* A task has a short plain-text title, an optional date, an assignee (default: the owner of the enquiry, else the person who
  adds it), a state (`open`, `done`, `cancelled`) and a revision. Changes name the revision they saw (409 `task_stale`); a
  repeat changes nothing, not even the revision. A new date cannot be in the past. At most 50 open tasks per enquiry. A
  task is cancelled, never deleted; the API role cannot delete rows. Tasks go with their lead (erasure, retention).
* The list (`GET /api/admin/crm/tasks`) shows open work first, the oldest date first, tasks without a date last, and
  filters by assignee (me, none, a person), state and date (overdue, this week, none). It shows the enquiry's reference and
  service, never the customer's name or contact details.

## Overview

`GET /api/admin/crm/overview?days=` counts real records only: enquiries (total, in the period, by status), open enquiries
without an owner, open opportunities, approved proposals, quotations waiting and accepted, active projects and projects
by status (drafts are not counted), open, overdue and this-week follow-ups, and the open work per owner. **There is no
revenue, no forecast and no conversion rate**, on purpose: the answer has no such field and a test fails if one appears.

## Timeline and customer links

`GET /api/admin/leads/{id}/timeline` joins what was already recorded about the enquiry, newest first: audit entries (views
of the lead are left out), notes, proposals, quotations (published, opened, accepted or declined, withdrawn), projects
(created, status changes) and tasks (created, finished). Notes and task titles are staff's own text; no customer contact
detail is added. `GET /api/admin/leads/{id}/customer` says whether a customer account exists behind the enquiry (by its
e-mail, or as the owner of a project's workspace) and whether it is verified, and lists the enquiry's projects and
quotations.

## Export

`GET /api/admin/crm/leads.csv` takes the lead filters (status, service, type, language, dates, owner, qualification) and
returns a CSV with a **whitelist of 13 columns**: reference, date, service, type, source, language, status, owner,
qualification, proposal, quotation, project and the number of open follow-ups. **No name, e-mail, phone, company or
message ever leaves through it.** Cells that start with `=`, `+`, `-`, `@`, a tab or a return get a leading quote so a
spreadsheet never runs them as a formula. At most 5000 rows. It is sent as an attachment, `no-store`, `nosniff`, and every
export is audited with the number of rows and the filters' effect, never any personal data (`crm.export`).

## Separation and safety

Admin identities (`acs_session`) and customer identities (`acs_account_*`) stay apart: a customer session opens no CRM
route and a staff session opens no customer route. All changes use row locks or revisions and write an audit record with
ids. Rows are removed with their lead by the database (`ON DELETE CASCADE`); the retention and erasure paths need no change.

## Tests

`apps/api/tests/test_crm.py` (18 tests): roles (editor and viewer 403 everywhere, no session 401), owner (set, repeat,
clear, filter, invalid owners, audit), task life cycle with revisions and audit, defaults and validation, list filters
and paging, the open-task limit, constraints and grants and cascading delete, the overview numbers and its exact set of
fields, quotations and projects in the overview, timeline contents and order, the customer view, the export (whitelist,
no personal data, formula safety, filters, audit). `apps/web/src/components/admin/crm.test.tsx` and
`apps/web/e2e/tests/crm.spec.ts` (owner, follow-up, list, overview, export, owner filter, 360 px, axe).

## Not here

Revenue, forecasts and conversion statistics (there is no real data behind them), a shared inbox, e-mail from the CRM,
reminders by e-mail (Phase 11 covers customer e-mail only), companies and contacts as separate records (an enquiry still
carries its own contact details), and bulk edits. See D-40 and D-41 in
[COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md).
