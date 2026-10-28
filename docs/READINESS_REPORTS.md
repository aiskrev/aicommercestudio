# AI readiness: PDF reports and submissions

The AI Readiness Assessment (`/bg/instrumenti/ai-gotovnost`, `/en/tools/ai-readiness`) shows its
result without asking for anything. Two optional follow-ups build on it:

| Action | What leaves the browser | Stored | Endpoint |
| --- | --- | --- | --- |
| See the result | nothing | nothing | — |
| Download the PDF report | answer levels (0–4), locale, model version, optional company name for the cover | nothing | `POST /api/public/readiness/report` |
| Send the result to the team | the above plus name, work e-mail, company, role, optional message, consultation flag, consents | an inquiry (lead), see [Retention](#retention) | `POST /api/public/readiness/submissions` |

## Design

* **The server scores again.** Both endpoints recompute the result from the answers with
  `apps/api/app/readiness/scoring.py`, a port of `apps/web/src/lib/readiness.ts`. The browser's own
  score is sent only as `client_overall` and never trusted; a difference is logged as
  `readiness_score_mismatch` (both numbers and the model version, nothing else).
* **One model version.** Requests carry `model_version`; the API rejects any other version (422,
  `readiness_model`) so a stale browser bundle cannot submit answers to a changed model. The web UI
  asks the visitor to reload; the answers survive in the share link.
* **Parity is tested, not assumed.** 61 golden vectors (`apps/api/tests/fixtures/readiness_vectors.json`,
  copied to `apps/web/src/lib/readiness.vectors.json`) are checked by pytest and by vitest, and
  `scripts/test.ps1` fails when the two copies differ. To change the model: change both
  implementations, bump `MODEL_VERSION` / `READINESS_MODEL_VERSION`, regenerate the vectors from
  Python and copy the file.
* **Server-owned report text.** The PDF (reportlab, `app/readiness/report.py`) prints only texts
  from `app/readiness/texts.py` and computed values. The one free-text input, the optional company
  name on the cover, is validated (no links or HTML, ≤ 120 characters) and XML-escaped.
* **No separate table.** A submission is an inquiry like any other — `leads` row with
  `source = readiness_assessment`, `service = audit` and `service_details.kind = "readiness"` — so it
  inherits admin-only access, the audit trail, deletion, triage and retention.

### Report contents (BG / EN)

Cover with brand, title, optional company, date and model version; summary (overall score and
stage); weighted dimension table with bars; strengths and gaps; blockers; three priority actions
with the related service; suitable use cases; 30/60/90-day plan; methodology and limitations
("an indicative self-assessment, not a certification or an audit"). Branded header and
"page n of N" footer on every page. Fonts: DejaVu Sans (Latin and Cyrillic), installed in the API
image (`fonts-dejavu-core`); without them the endpoint answers 503 `report_unavailable`.

## API

All responses use the standard error envelope ([API_REFERENCE.md](API_REFERENCE.md#error-envelope));
messages follow `Accept-Language: bg|en`.

### Common request fields

| Field | Type | Rules |
| --- | --- | --- |
| `schema_version` | `"1"` | required; version of this request shape |
| `model_version` | string | must equal the server's scoring model (`2026-11.1`), else 422 `readiness_model` |
| `locale` | `bg` \| `en` | default `bg`; language of the PDF and messages |
| `answers` | object | exactly the 12 question ids, each an integer 0–4 (booleans and strings rejected), else 422 `readiness_answers` |
| `client_overall` | int 0–100 | optional; the browser's score, compared and logged on mismatch |
| `form_token` | string | from `GET /api/public/form-token`, at least 3 s old; else 400 `form_token_invalid` |

Unknown fields are rejected (422).

### `GET /api/public/readiness/meta`

```json
{
  "schema_version": "1",
  "model_version": "2026-11.1",
  "privacy_notice_version": "2026-10-draft",
  "marketing_consent_version": "2026-10-v1",
  "retention_days": 365,
  "email_delivery": false
}
```

`retention_days` is the effective retention of submissions (the shorter of
`READINESS_RETENTION_DAYS` and `LEAD_RETENTION_DAYS`). `email_delivery` is `false`: the API sends
no e-mail to visitors, and the UI promises none. `Cache-Control: no-store`.

### `POST /api/public/readiness/report` → 200 `application/pdf`

Common fields plus `company` (optional, ≤ 120 characters, no links or HTML). Response headers:
`Content-Disposition: attachment; filename="ai-gotovnost-otchet.pdf"` (BG) /
`"ai-readiness-report.pdf"` (EN), `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`.
Nothing is written to the database or the audit log.

Errors: 400 `form_token_invalid`, 422 validation, 429 rate limit
(`READINESS_REPORT_RATE_LIMIT` per client and `READINESS_REPORT_GLOBAL_RATE_LIMIT` overall per
`READINESS_REPORT_RATE_WINDOW_SECONDS`; counted before validation because rendering is the
expensive part), 503 `report_unavailable`.

### `POST /api/public/readiness/submissions` → 201

Common fields plus:

| Field | Rules |
| --- | --- |
| `name` | 2–120 characters, no links |
| `email` | valid e-mail, stored lower-case |
| `company` | 2–160 characters, no links |
| `role` | 2–80 characters, no links |
| `message` | optional, ≤ 1000 characters, no secrets (keys/passwords are rejected), ≤ 3 links |
| `consultation_requested` | boolean, default `false` |
| `privacy_acknowledged` | must be `true` |
| `marketing_consent` | boolean, default `false`; independent of everything else |
| `website` | honeypot; must stay empty |

```json
{ "reference": "1A2B3C4D", "message": "Thank you! We have received your results…", "overall": 50, "band": "pilot_ready" }
```

Shares the contact form's rate limit (`CONTACT_RATE_LIMIT` per client, `CONTACT_GLOBAL_RATE_LIMIT`
overall). A filled honeypot gets a normal-looking 201 with a random reference and stores nothing.
Messages with more than three links get 422 `too_many_links`; the shared link-spam heuristic can
also answer 400 `spam_suspected`. The team is notified like for any inquiry
(if SMTP is configured — that is an internal notification, never a message to the visitor).

### `GET /api/admin/leads/{id}/readiness-report` (admin session) → 200 `application/pdf`

Rebuilds the PDF from the stored result (so it matches what the visitor saw even after a model
change) in the lead's language with the lead's company on the cover. 401 without a session, 404
`readiness_not_found` for other leads, 503 `report_unavailable`. Each download is audited as
`lead.readiness_report_downloaded`.

`GET /api/admin/leads/{id}` now also returns `marketing_consent_version` and `readiness`
(`model_version`, `role`, `consultation_requested`, `overall`, `band`, `dimensions`, `blockers`,
`actions`) for readiness submissions; the admin lead page shows them with a download link.

## Consent

* **Privacy acknowledgement** is required for a submission; `privacy_acknowledged_at` and
  `privacy_notice_version` are stored as for the contact form.
* **Marketing consent** is a separate, unticked checkbox. When given, `marketing_consent_at` and the
  new `marketing_consent_version` (`MARKETING_CONSENT_VERSION`) are stored; when not given all three
  stay empty. The contact form now records the version too.
* **Downloading a report needs no consent** — no personal data is processed beyond the request
  itself, and nothing is kept.
* Consultation is a plain request flag, not a consent.

## Retention

`python -m app.cli maintenance` (and *Admin → Retention*) deletes leads not updated for
`LEAD_RETENTION_DAYS`, and readiness submissions not updated for `READINESS_RETENTION_DAYS`
(default 365, allowed 30–3650) — whichever comes first. Deletions are audited as `lead.deleted`
with actor `retention-job`. Admins can delete a submission at any time (erasure requests).

## Logging

Logs carry only event names and enumerations: `readiness_report_generated` (band, locale),
`readiness_submission_created` (lead reference, band, model version, consultation flag),
`readiness_score_mismatch` (two numbers, model version), `readiness_spam_rejected` (hashed IP).
Never answers, names, e-mails, company names or messages; the audit entry `lead.created` for a
submission has the same restriction. Tests assert this
(`test_client_score_mismatch_is_logged_without_answers`, `test_submission_logs_carry_no_personal_data`).

## Migration notes

* `apps/api/alembic/versions/20261027_0006_marketing_consent_version.py` (revision `0006`,
  down-revision `0005`) adds one nullable column `leads.marketing_consent_version VARCHAR(32)`.
  Backward compatible: no existing row changes, no default, no lock-heavy rewrite. Downgrade drops
  the column (consent flag and timestamp remain). Existing consents keep `NULL` (version unknown).
* Covered by `test_models_match_migrations` (`alembic check`) and the upgrade/downgrade round trip.
* **Not applied to production.** Apply with the usual deployment step
  (`alembic upgrade head`, see [DEPLOYMENT.md](DEPLOYMENT.md)) after a backup.
* The API image now installs `fonts-dejavu-core` and the Python dependency `reportlab`; rebuild it.
* New optional settings (defaults are safe): `MARKETING_CONSENT_VERSION`,
  `READINESS_RETENTION_DAYS`, `READINESS_REPORT_RATE_LIMIT`, `READINESS_REPORT_GLOBAL_RATE_LIMIT`,
  `READINESS_REPORT_RATE_WINDOW_SECONDS`.

## Privacy assumptions (to confirm with the privacy owner)

1. The legal basis for a submission is the visitor's request (pre-contractual steps); the privacy
   acknowledgement records that the notice was shown. The privacy policy should mention the
   assessment and that answer levels are stored with the inquiry.
2. Answer levels (0–4) about a company's practices are not personal data on their own; combined
   with contact details they are treated as part of the inquiry and deleted with it.
3. 365 days is a default for submissions that did not turn into a project; adjust
   `READINESS_RETENTION_DAYS` to the documented retention schedule.
4. The marketing wording version `2026-10-v1` identifies the current checkbox text. Bump it when the
   text changes so earlier consents stay attributable to the wording they agreed to.
5. A share link (`?r=`) contains only the answer code. If a visitor shares it, anyone with the link
   sees the same result — which the UI already states by calling it a link "to the result".
6. No e-mail is sent to visitors (`email_delivery: false`). If e-mail delivery is added later, the UI
   copy and this document must change with it.
