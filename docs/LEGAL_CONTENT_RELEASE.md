# Releasing legal content: draft, approved, published, accepted

The legal texts (privacy policy, cookie policy, terms, subscription terms, withdrawal page) and the consent wordings
(marketing, order acceptance, early start) are versioned in `apps/web/src/lib/legal-versions.json`, mirrored in
`apps/api/app/legal_versions.json` (`scripts/test.ps1` fails if they differ). Four words are used, and they mean different things:

| Word | Meaning | Where it shows |
| --- | --- | --- |
| **draft** revision | A working text. It may change under the same version id; its hashes follow it. It says `pending_lawyer_review` and **can never back a live contractual acceptance**. | registry `status: "draft"`, `review: "pending_lawyer_review"` |
| **approved** revision | A lawyer signed off this exact Bulgarian and English text. `approved_content_sha256` stores its hash and the tests freeze it: any change needs a new version id and a new review. | `status: "approved"`, `review: "reviewed"`, `approved_content_sha256` |
| **published** revision | Approved and live under that id. | `status: "published"` |
| **accepted** revision | What a person agreed to or acknowledged: the version id stored in `legal_events` with the time, the language shown and the context. It is a historical fact and is never rewritten when a new version is published. | `legal_events.version` |

## What the system enforces

* **Hashes follow the text.** `legal-versions.test.ts` hashes the Bulgarian text, the English text and both together for
  every document. A change to either language changes a hash and fails the test until it is refreshed (draft) or the
  version id is bumped (approved).
* **Language pairing is explicit.** Every document lists `languages: ["bg", "en"]`; the two share one version id and
  are approved together; the per-language hashes can never be equal; `legal_events.locale` records which language was shown.
* **A draft cannot back a live acceptance.** In production, with accounts or billing on, the API refuses to start while
  any text is not `reviewed` (app/config.py), and the checkout refuses with `legal_text_not_approved` (tests cover both).
* **A stale version is refused.** A checkout carrying an old id returns `terms_version_changed`; the page tells the
  customer to review the order again.
* **Old records stay readable.** Exports and staff views list events with whatever version they carry; nothing joins
  them to the current registry.

## Process for a change

1. Edit the text (both languages). While `status` is `draft`: run
   `UPDATE_LEGAL_VERSIONS=1 npx vitest run src/lib/legal-versions.test.ts`, copy the JSON to the API, run the tests.
2. Send the exact BG and EN text, with the hashes from the registry, to the lawyer (docs/LEGAL_SOURCES.md lists the questions).
3. When the lawyer approves **that exact text** in writing: set `review: "reviewed"`, `status: "approved"` and
   `approved_content_sha256` to the current `content_sha256`; keep the date id. If the lawyer changes a word, change the
   text, use a NEW id (add `-2` for a second revision on the same day) and approve again.
4. Deploy; when live set `status: "published"`.
5. Never edit an approved or published text under its id. To change it, create a new id; old acceptances keep the old id.

Today every document is `draft` / `pending_lawyer_review`. Nothing has been approved.
