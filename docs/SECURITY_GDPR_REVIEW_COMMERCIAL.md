# Security and GDPR review of the commercial expansion (Phase 16)

Commercial expansion, Phase 16. A review of what Phases 06 to 15 added: quote baskets, quotations, customer projects, project
documents and uploads, project e-mail, the admin CRM, billing categories and the demonstrations. It is a **technical** review done
by reading and testing the code; it is not a legal opinion and not a penetration test, and it records what was *not* checked.
Findings were fixed where the fix was code; what needs a decision is in
[COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md). Related: [SECURITY.md](SECURITY.md), [LEGAL_RETENTION.md](LEGAL_RETENTION.md),
[PROJECT_DOCUMENTS.md](PROJECT_DOCUMENTS.md) (the upload review), [COOKIE_AUDIT.md](COOKIE_AUDIT.md).

## 1. Data map

The map is code: `app/compliance/data_map.py`, with one entry per table created by migrations 0026 to 0032, and
`tests/test_data_map.py` fails when a table has no entry and checks the claims it can (a table that "goes with its lead" has a
cascading foreign key to leads, one that "expires" has an expiry column, the retention job is part of the scheduled command).

| Table | Personal data | Who reads | Erasure | Person gets it back | Retention |
| --- | --- | --- | --- | --- | --- |
| `quote_baskets` | none (a secret token, only its hash) | the visitor; staff via the enquiry | expires | – | 30 days as a draft, 1 day after sending (`maintenance`) |
| `quotations` | indirect (a name and a note of whoever answered) | administrators | goes with its lead | lead data request | with the enquiry; its scope lives on in a project |
| `commercial_projects` | indirect | the workspace's members (not drafts); administrators | account is **anonymised**, the project stays | account export | a contractual record: period undecided (D-28) |
| `project_milestones` | none | as the project | goes with the project | account export | as the project |
| `project_events` | **direct** (the customer's own messages) | members (client-visible), administrators | the customer's text becomes `[erased]` | account export | as the project |
| `project_documents`, `project_document_versions` | indirect (titles, file names, checksums; the bytes are outside the database) | members (published), administrators | go with the project | account export (own uploads) | `retain_until` (730 days); bytes deleted by the job, records stay |
| `document_approvals` | indirect (who decided, which version, when) | members, administrators | go with the project; the decision note becomes `[erased]` | account export | with the project |
| `document_comments` | **direct** | members, administrators | the customer's text becomes `[erased]` | account export | with the document |
| `lead_tasks` | indirect (a short staff-written title) | administrators only | goes with its lead | lead data request | with the enquiry |
| `outbox_messages` (project columns) | none (ids; the address is read at send time) | – | go with the account | – | old rows purged by `maintenance` |
| `billing_offers.category` | none | – | – | – | – |
| demonstrations | **none stored** (stateless, no cookie) | – | – | – | – |

No raw card data, no password, no token and no file content is in any of these tables (checked: tokens are hashed, files are stored
outside the database under random keys).

## 2. Findings, and what was done

| # | Finding | Severity | Fix |
| --- | --- | --- | --- |
| F1 | The first version of the project and document read routes let **any staff role** (editor, viewer) read customer projects and files; the product's model is that editors and viewers reach only the catalogue | high | Fixed in Phase 10: all project, document and notification routes are `admin` only; tests make editor and viewer get 403 on every one (D-39) |
| F2 | Reading a customer's project or documents by staff was **not logged** (opening a lead is) | medium | Fixed: `project.viewed` and `project_document.listed`, once per person, project and 15 minutes, ids only; tests |
| F3 | The retention job for stored project files (`project-documents-purge`) was a separate command nobody schedules | medium | Fixed: the scheduled `maintenance` command now deletes expired files (and `--dry-run` counts them); tests |
| F4 | A table could be added without anyone saying how it is erased or exported | process | Fixed: the data map and its test |
| F5 | A customer upload is published at once to the customer's workspace and to staff; there is no scanner | accepted, gated | scanning is required before a customer can download any file (`PROJECT_UPLOAD_REQUIRE_SCAN`), uploads are behind flags and the open gate BLOCKER-COM-UPLOAD-01 (D-31, D-32) |
| F6 | Backup and restore of the `project_files` volume is not set up | open | in the runbook ([COMMERCIAL_STAGING_RUNBOOK.md](COMMERCIAL_STAGING_RUNBOOK.md)) and D-33; owner and DevOps |
| F7 | A staff-written follow-up title can contain personal data (only secrets and markup are refused) | low | documented; staff are told in the admin text that a task is a short reminder, not a note; the title is removed with the lead |
| F8 | Retention of customer projects is undecided | open | D-28; nothing is deleted automatically |
| F9 | The wording of the customer's approvals, the quotation answer and the project e-mail is not lawyer-approved | open | D-06, D-25, D-37 |

Checked and found sound (with the test that holds it): every customer route needs a session and a CSRF header (`test_accounts_hardening.py`
discovers them); a project, document or approval of another workspace answers 404 like a missing one (`test_projects.py`,
`test_project_documents.py`); the workspace is never taken from the request body; file names are cleaned and storage keys are random
and validated (a traversal test); downloads are attachments with `nosniff` and `no-store`; type and content of every upload are checked
and a file that disagrees is refused and removed; a decision is made once and cannot be changed; staff cannot approve on the customer's
behalf; the API role cannot delete projects, documents, approvals, comments or tasks; no billing code can read a quote or a price schedule;
the CSV export has no personal data and is formula-safe; the demonstrations never obey or echo a note; logs and audit entries carry ids and
counts, never an address, a note or a file name (`test_project_notifications.py`, `test_project_documents.py`).

## 3. Export and erasure

* **Customer export** (`GET /api/accounts/data/export`) now includes the account's projects and messages, its document uploads, decisions
  and comments, never staff internal notes, hashes or tokens. Tests: `test_projects.py`, `test_project_documents.py`.
* **Erasure**: an account that owns projects is anonymised, not deleted (a project is a contractual record); its own project messages,
  comments and decision notes become `[erased]` and lose their author; the project, the approvals as records and the files stay with the
  project until retention (D-28). A member account that owns nothing is deleted and its outbox rows with it.
* **Enquiries** (leads): the existing data-request process covers a lead and everything that hangs off it by cascade: quotations, proposals,
  follow-up tasks. A project created from an enquiry survives the lead's deletion (its link is set to null), as a contract record would.

## 4. Retention jobs

`python -m app.cli maintenance` (`--dry-run` first) now covers leads and audit, baskets, accounts, outbox, legal records **and the stored
project files past `retain_until`**. It is a scheduled job in the runbook; **no timer is installed** by this repository, so until the owner
schedules it nothing expires by itself (D-33, the runbook's Hetzner checklist).

## 5. Dependencies

`scripts/test.ps1 -Suite audit` runs the Python and npm audits; the result of this run is in the progress checkpoint. A new dependency was
added by none of Phases 09 to 16 (uploads use the raw request body, so no multipart library was needed).

## 6. Not checked

A penetration test; a scan of uploaded content (no scanner exists); denial-of-service behaviour of the upload routes under load (the app limits
and Cloudflare rules are in the runbook); the legal basis and notices for holding customers' files and e-mail about their projects; the
processors list in the privacy notice for any new provider (none was added); real e-mail delivery; real Stripe behaviour (D-43).
