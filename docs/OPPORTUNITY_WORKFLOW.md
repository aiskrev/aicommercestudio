# Engineering opportunity workflow: opportunity record, proposal and SOW drafts

Status: implemented on 2026-11-03 (migration `0014`, `app/opportunities/`, routes under
`/api/admin/leads/{id}/…`, two panels on the admin lead page). Admins only.

The workflow turns an enquiry into a qualified engineering opportunity and, when it makes sense, into
a proposal or a statement of work (SOW) **draft**. It is a record-keeping tool:

* it never sends an e-mail, never synchronises a CRM and never changes the lead's consents;
* it stores no price, staffing level, guarantee or signature that a person did not write;
* an approved draft is **not** a signed agreement, and the platform records no signatures.

## 1. Opportunity record (`lead_opportunities`, one per lead)

| Field | Rule |
| --- | --- |
| Source and linkage | Read-only, from the lead: `source`, inquiry type, submitted service, `workshop_key` (the catalogue workshop the enquiry was sent from) and the linked records (advisor assessment, saved assessment results, AI team configuration, readiness, Solution Builder or AI Managed details) |
| `service_domain` | One of the ten domains of SERVICE_TAXONOMY |
| `problem_summary`, `scope_summary`, `technical_constraints`, `notes` | Plain text ≤ 4000, no markup, nothing that looks like a secret |
| `discovery_status` | `not_started`, `scheduled`, `in_progress`, `completed`, `not_needed` |
| `qualification_status` + `qualification_rationale` | `unassessed`, `qualified`, `not_qualified`, `on_hold`; a decision (`qualified` / `not_qualified`) requires the rationale |
| `stakeholders` | At most 12 `{name, role, provided_in}`, where `provided_in` is `enquiry`, `call`, `email` or `meeting`. Saving a list requires `stakeholders_confirmed: true`: only people the client named explicitly. Nothing is looked up or inferred |
| `next_action`, `next_action_due` | Free text ≤ 300 and a date. No reminder is sent |
| `recommended_workshop`, `recommended_assessment`, `recommendation_rationale` | A catalogue workshop key and/or a self-service tool key; any recommendation requires the rationale. The workshop the enquiry was sent from is pre-filled until the record is saved |

Every save names `expected_revision` (0 creates). A concurrent save gets 409 `opportunity_stale`.

## 2. Proposals and SOW drafts (`lead_proposals`, `lead_proposal_versions`)

Each draft has a kind (`proposal` or `sow`), a title, a status and append-only versions. A version
holds these sections:

* scope;
* deliverables;
* assumptions;
* exclusions;
* dependencies;
* responsibilities (client, provider, shared);
* acceptance criteria;
* indicative milestones (title, description, indicative timing — an estimate, never a commitment);
* risks with mitigations;
* commercial terms: pricing basis, payment terms, validity, notes.

### Generated first drafts

`generate: true` assembles version 1 (`origin: generated_draft`) **deterministically** from the
opportunity record:

* The scope comes from the scope summary, the problem and the constraints.
* The recommended workshop or assessment is added as an assumption.
* Standard assumptions and exclusions are added (no promised outcome; nothing outside the scope).
* Every other section gets a bracketed placeholder for a person to replace.
* **All commercial fields** get the placeholder `[ПОПЪЛВА СЕ ОТ ЧОВЕК]` / `[TO BE COMPLETED BY A PERSON]`.
* The draft follows the lead's language.

It does not call a language model. A future LLM drafter would plug into the same function and inherit
the same rules: drafts only, commercial fields left to a person, the same review checks.

### Review checks (on every version)

| Finding | Blocks approval |
| --- | --- |
| A commercial field still holds a placeholder, or the pricing basis is empty | yes |
| Another section still holds a bracketed template placeholder | yes |
| Guarantee wording ("guarantee", „гаранти…“) | no — the reviewer must acknowledge it |
| Signature wording ("signed", „подпис…“) | no — the reviewer must acknowledge it |
| A price outside the commercial section | no — the reviewer must acknowledge it |
| A staffing number ("3 engineers", „2 разработчици“) | no — the reviewer must acknowledge it |
| An empty section | no — the reviewer must acknowledge it |

### Status and decisions

```
draft → in_review → approved           (closed)
          │  └→ rejected → (new version) → draft
          └→ draft (reopen)
draft / in_review / rejected → withdrawn (closed)
```

* A new version is accepted only in `draft` or `rejected` (a rejected proposal returns to `draft`).
* `approve` applies to the latest version and records `approved_version`, the approver and the time.
  It is refused while a blocking finding remains (422 `proposal_incomplete`) and, with other findings,
  unless `acknowledge_warnings: true` is sent (422 `warnings_unacknowledged`).
* `reject` and `withdraw` need a note.
* Every action names `expected_revision`; a stale one gets 409.
* Versions are append-only in the database: a trigger refuses any UPDATE except the `SET NULL` of a
  deleted author. History is shown with the author, origin, change note and the changed sections.

**Single administrator.** A second-person approval is not required, because the business currently
has one administrator. The approval is always an explicit, audited human action. When more staff join,
a four-eyes rule (approver ≠ author of the latest version) can be added in `service.transition`.

## 3. Access, audit, personal data

* **Access.** Every route depends on `require_admin`. Editors and viewers get 403, anonymous users
  401, and writes without the CSRF header 403.
* **Audit.** Entries are attached to the lead's history (`entity_type = lead`): `opportunity.saved`
  (the changed field *names*, the statuses, the number of stakeholders), `proposal.created`,
  `proposal.version_added` and `proposal.submit|approve|reject|reopen|withdraw`. No free text and no
  stakeholder names enter the audit log.
* **Retention and erasure.** All rows cascade from `leads`. The lead retention job
  (`LEAD_RETENTION_DAYS`) and an erasure request (`DELETE /api/admin/leads/{id}`) remove the
  opportunity, its stakeholders and every proposal version with the lead. Nothing outlives the
  enquiry.
* **Separate consent purposes.** The workflow reads no marketing consent and changes none. The
  privacy acknowledgement covers handling the enquiry; marketing stays a separate, optional consent.
* **Least privilege.** Migration 0014 revokes every privilege of the Ops runtime role
  (`acs_app_runtime`) on all lead tables (leads, notes, opportunity, proposals, versions, linked
  assessments). Tenant-scoped Ops transactions therefore cannot read enquiry data, even through a bug.

## 4. Tests

`apps/api/tests/test_opportunities.py` covers:

* the shared workshop keys;
* the public enquiry's `workshop` field;
* defaults pre-filled from the enquiry;
* save, update and the stale revision;
* validation (rationales, stakeholder confirmation, enums, markup, secrets, limits, unknown fields);
* consents and lead status left untouched;
* linked assessment records;
* admin-only access (editor and viewer 403, anonymous 401, CSRF 403);
* cross-lead 404;
* generated drafts (the record's content, placeholders, the lead's language, no prices, staffing,
  guarantees or signatures);
* the review checks;
* bounded content;
* the full flow to approval with the audit trail;
* acknowledgement of warnings and the reject note;
* stale revisions and disallowed transitions;
* append-only versions in the database;
* erasure through retention;
* no runtime-role access to the lead tables.

The UI tests are `apps/web/src/components/admin/opportunity.test.tsx`. The lead regression suite
(`test_admin_leads.py`, `test_public_leads.py`) is unchanged and passing.
