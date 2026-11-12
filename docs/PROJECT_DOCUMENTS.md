# Project documents, uploads and approvals (Phase 10)

Commercial expansion, Phase 10. A commercial project ([COMMERCIAL_PROJECTS.md](COMMERCIAL_PROJECTS.md)) can hold private
documents: files the team prepares for the customer to review, and material the customer sends. The customer reviews,
approves or rejects a version and leaves feedback. Everything is behind flags that are **off**, and **uploads stay out of
production until the security review in this document is recorded** (release gate `BLOCKER-COM-UPLOAD-01`).

| Flag | Default | What it opens |
| --- | --- | --- |
| `PROJECT_DOCUMENTS_ENABLED` | off | listing, downloads, approvals, feedback (needs `COMMERCIAL_PROJECTS_ENABLED`) |
| `PROJECT_UPLOADS_ENABLED` | off | the team uploading files (needs documents) |
| `PROJECT_CLIENT_UPLOADS_ENABLED` | off | a customer uploading files (needs team uploads) |

While a flag is off its routes answer 404 and the pages hide the matching section. Production refuses a flag whose
prerequisite is off, and refuses `PROJECT_UPLOADS_ENABLED` while `release_gates.PROJECT_UPLOAD_REVIEW_APPROVED` is `False`.

## Model

* **Document**: belongs to one project (so to one workspace); title, category (`brief`, `design`, `deliverable`,
  `contract`, `report`, `feedback`, `other`), origin (`staff` or `client`), retention date, archive mark.
* **Version**: numbered, immutable. A new file is a new version, never an overwrite. It records the display name, the
  content type found by the check, the size, the SHA-256, the storage key, the scan result and its state: `draft`
  (the team's upload, invisible to the customer), `published`, `withdrawn`.
* **Approval request**: asks the customer to decide on one *published, latest* version. States: `pending`, `approved`,
  `rejected`, `withdrawn`, `superseded`. One open request per version.
* **Comment**: feedback on a published version, from the customer or the team.

Tables `project_documents`, `project_document_versions`, `document_approvals`, `document_comments` (migration `0029`,
local only until a release is approved). The API role can read, add and update; it cannot delete. The runtime role has no
access.

## Who can do what

| Action | Customer owner / billing | Customer member | Staff administrator | Other staff |
| --- | --- | --- | --- | --- |
| See published documents of their own project | yes | yes | – | – |
| Download a published version | yes | yes | – | – |
| Approve or reject a version (once) | yes | no (403) | – | – |
| Comment on a published version | yes | yes | yes | no |
| Upload (brief, feedback, other), when enabled | yes | yes | – | – |
| Upload, publish, withdraw, scan, ask for a decision, archive | – | – | yes | no (403) |
| See drafts, scan results, the whole list, download any file | – | – | yes | no (403) |

The team's upload is a draft until an administrator **publishes** it (staff publication approval). A customer's own
upload is visible to their workspace and to staff at once, but is downloadable only after a clean scan when scanning is
required. A document of the team cannot get a new version from the customer, and the reverse (409 `document_origin`).

## Approvals

A decision records who (the customer's account), which project, which version, the decision, the note and the time. It
is made once: the same decision again returns the recorded result and writes nothing; the opposite one is refused (409
`approval_closed`); a decision on a version that was replaced (409 `approval_superseded`) or that is not the one the
person saw (409 `version_conflict`) is refused; a rejection needs a reason (422 `note_required`). Publishing a newer
version supersedes an open request; withdrawing a version, archiving the document or an infected scan closes it. Two
simultaneous decisions wait on a row lock and one is recorded. The decision and the request appear in the project history
(`approval` and `delivery` events), without any staff name.

## File security

* **Allowlist by name and by content**: `.pdf`, `.png`, `.jpg/.jpeg`, `.webp`, `.txt`, `.md`, `.csv`, `.docx`, `.xlsx`,
  `.pptx`. The extension must match the first bytes (PDF `%PDF-`, PNG, JPEG, WebP `RIFF…WEBP`), text must be UTF-8 without
  NUL, an Office file must be a ZIP with `[Content_Types].xml` and its own part folder, without `vbaProject`, `.bin`
  parts, parent-folder paths, too many parts or more than 100 MB uncompressed. Refused on purpose: SVG, HTML, scripts,
  executables, archives, macro-enabled Office files, double extensions such as `a.pdf.exe`, empty files.
* **The stored content type comes from this check, never from the request.** Files are only ever sent as attachments,
  with `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` and the API-wide `default-src 'none'` policy.
* **Size**: `PROJECT_UPLOAD_MAX_BYTES` (10 MB by default, 50 MB at most), refused from `Content-Length` and again while the
  body streams; nothing is left on disk. Limits per project (100 documents) and per document (20 versions).
* **Safe names and keys**: a file name is cleaned (no path, no control characters or separators, at most 120 characters)
  for display only. The storage key is made by the server (`<project>/<document>/<random>`, hex), must match a strict
  pattern, and its resolved path must stay inside the root; tests try traversal keys.
* **Private storage**: `app/projects/storage.py` is an interface (`put`, `open`, `delete`, `exists`) with a local
  implementation under `PROJECT_STORAGE_DIR` (a Docker volume owned by the API user, mode 0700/0600, written through a
  temporary name and renamed). It is not under any web root and no URL points at it; a private object store can
  implement the same four methods later.
* **Authorized download**: the API checks the session, the workspace, the project, the document and the version, then
  streams the file. There is no signed or public URL. Every download, upload, publication, scan, decision and comment
  writes an audit record with ids only, never a file name.
* **Tenant isolation**: a document is looked up inside the caller's own project, which is looked up inside their own
  workspace; another workspace's or another project's document answers exactly like a missing one. A document the
  customer cannot see (a draft, archived) answers 404, not 409.
* **Malware scanning readiness**: each version has `scan_status` (`not_scanned`, `clean`, `infected`, `failed`).
  `PROJECT_UPLOAD_REQUIRE_SCAN` (default true) blocks publication and customer downloads until a result of `clean` is
  recorded (`POST …/scan`); an infected result withdraws the version and closes its approval request, and a file found
  infected can never be marked clean. **No scanner is bundled**: the result is recorded by an external check or a person.
  Nothing in the product claims an accepted file is safe to open.
* **Retention**: `retain_until` is set when a document is created (`PROJECT_DOCUMENT_RETENTION_DAYS`, 730 by default).
  `python -m app.cli project-documents-purge` deletes the stored bytes of expired documents, keeps every record, skips a
  document with an open approval request and audits what it removed. A purged version answers 410.
* **Privacy**: the customer's export lists their own uploads, decisions and comments; erasure replaces their comments
  and decision notes with "[erased]". The files themselves belong to the project and stay with it (an account that owns
  projects is anonymised, not deleted: D-28).

## Security review (to be recorded by the owner)

`PROJECT_UPLOAD_REVIEW_APPROVED` is `False`. The code covers the technical checks above; what remains is a decision, not
code: the upload policy (types, size, retention), a connected scanner or an accepted decision to run without one, the
backup and restore of the storage volume, and a lawyer's view on holding customers' documents. Until then uploads stay
off in production, and the test stacks turn them on only with synthetic data.

## Tests

* `apps/api/tests/test_project_documents.py` (62 tests): flags and the gate, draft visibility, publication, tenants,
  roles, sessions, oversized and invalid files (by name and by content), file names and storage keys, versions,
  duplicates and conflicts, scanning, approvals (record, repeat, contradiction, superseded, withdrawn), simultaneous
  decisions, feedback, the access log, retention, export and erasure, database rules and grants.
* `apps/web/src/components/account/documentsPanel.test.tsx`; `apps/web/e2e/tests/project-documents.spec.ts` on the legal
  stack (draft invisible, download bytes and headers, approval, upload refusals, staff screen, another customer,
  360 px, axe, English).

## Not here

E-mail when a document is published or a decision is needed (Phase 11), a scanner, a private object store, previews or
in-browser viewing of files, e-signature. The wording next to the approval is not lawyer-approved (D-25 applies).
