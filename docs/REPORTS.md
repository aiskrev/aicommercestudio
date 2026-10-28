# Reports: HTML views and PDF generation

A reusable report capability for the assessment and planning tools. A tool builds one typed,
renderer-neutral **document**. The API renders it as a PDF. The web renders the same document as an
accessible HTML view, so both always show the same content.

## 1. What existed (inspected)

| Utility | Where | Kept |
| --- | --- | --- |
| Readiness PDF | `app/readiness/report.py` (reportlab, DejaVu fonts, branded page frame, score bars) | unchanged; its frame, fonts and bars are reused by the new renderer |
| AI team PDF plan | `app/team/report.py` (reportlab, architecture drawing) | unchanged |
| Assessment storage | `assessment_results` (migration `0011`): hashed secret token, expiry, re-score on lookup | reused as the access right for reports |
| Retention | `python -m app.cli maintenance`, *Admin → Retention* | extended: results linked to a consultation follow the lead |
| Lead consent | privacy acknowledgement (versioned), separate unticked marketing consent (versioned), form token, honeypot, link-spam check, contact rate limit | reused for the optional consultation |

## 2. Architecture

```
saved result (token) ── rescore_saved() ── present_result(definition, result, locale, answers)
                                              │
                         app/assessments/report.py: build_document(view, …) → ReportDocument
                                              │
                ┌─────────────────────────────┴──────────────────────────────┐
     app/reports/pdf.py: render_pdf()                          document.to_dict() (JSON)
     application/pdf (reportlab, DejaVu)                       web: components/tools/assessment/ReportView.tsx
```

* **`app/reports/document.py`**: frozen dataclasses: `ReportDocument` (locale, brand, title,
  subtitle, meta, sections, footer), `Section`, and the blocks `Paragraph` (normal, muted, notice),
  `Bullets`, `Table`, `Scores` (label, score, level) and `Findings` (title, description, label, "why").
  `clean()` removes control and bidi-override characters, collapses whitespace and caps each string.
  `check_limits()` bounds sections (20), blocks (16 per section), items (80 per block) and total
  text (80 000 characters).
* **`app/reports/pdf.py`**: one renderer for every block type. All text is XML-escaped before it
  reaches reportlab's paragraph markup. It reuses the readiness frame (navy header with the
  monogram, "page n of total"), the styles and the score bars. Bullets use the same font. The result
  is capped at `MAX_PDF_BYTES` (2 MB).
* **`app/assessments/report.py`**: the document for an engine assessment, with these sections:
  * **About this assessment**: deterministic scoring, self-reported practices, metrics entered by
    the visitor, nothing verified by us.
  * **Your answers and assumptions**: context, practices and metrics in separate tables.
  * **Results**: the overall score and band, plus the breakdown by area with maturity levels.
  * **Findings**: risks, quick wins, recommendations, target state, patterns and context notes, each
    with "Why".
  * **Indicative roadmap**: 30/60/90 days, labelled a sequence and not a quote.
  * **Related services**: names of the catalogue domains.
  * **Limitations and disclaimer**: self-assessment, no access and no scanning, not a certification,
    calculations not independently verified.

  The meta block carries the brand, the creation date, the methodology version with its algorithm,
  the reference and the expiry. BG and EN frame texts are server-owned.

**Cyrillic.** Text is rendered with embedded DejaVu Sans TrueType subsets (installed in the API image
as `fonts-dejavu-core`). Tests check for `+DejaVuSans` and `/FontFile2` in the PDF. Missing fonts
raise `ReportUnavailable` and return **503 `report_unavailable`**, and the result stays on the page.

## 3. Access and ownership

`POST /api/public/assessments/results/report` with `{token, format: "pdf" | "json"}` and `?locale=`.

* The token is the access right: a 256-bit secret returned once when the visitor saves the result.
  Only its SHA-256 is stored. The report is generated **only** from the row whose hash matches, so a
  token can never render another assessment (`test_report_is_only_for_the_result_the_token_opens`).
* Unknown, expired, deleted or tampered results return 404 `assessment_result_not_found`. The saved
  result is re-scored with its own definition version before rendering, and a mismatch is never
  served.
* The token travels in the POST body, never in a URL, and is never logged. Logs carry the
  assessment key, version, locale and size only.
* `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. File names are generic
  (`doklad-ocenka.pdf`, `assessment-report.pdf`): no reference, token, company or name.
* Rate limited per client (`ASSESSMENT_REPORT_RATE_LIMIT`, default 10 per window) and globally.

## 4. Content safety

* Engine assessments contain no free text from the visitor: answers are option keys, booleans and
  numbers, rendered through definition labels.
* Every string still passes through `clean()`, is escaped by the PDF renderer, and is rendered as
  React text in the HTML view. A hostile title such as `<script>…</script>` stays visible text in
  both (tested with long and malicious content).
* `ReportView` uses semantic headings, a description list for the meta, tables with `th scope`,
  `<meter>` bars with labels, and `lang` on the article.

## 5. Basic results are never gated

Scoring returns the full result immediately, with no account, e-mail or form. Saving (for the
report and the PDF) is a separate, explicit button. The consultation is a third, optional step.

## 6. Optional lead conversion

`POST /api/public/assessments/results/consultation` (after saving) with name, work e-mail,
company, optional message, `privacy_acknowledged: true` and `marketing_consent` (default false,
unticked in the UI, a separate checkbox):

* creates a lead (`source = engineering_assessment`, service `audit`) whose `service_details` hold the
  result summary (assessment, version, algorithm, overall, band, dimension scores, finding keys,
  reference), with the privacy and marketing consent versions;
* links the saved result (`assessment_results.lead_id`, migration `0012`, `ON DELETE CASCADE`).
  Linked results are excluded from the expiry purge and follow the lead's retention and erasure;
* one consultation per result (409 `assessment_consultation_exists`), the contact-form rate limit,
  a form token, a honeypot (fake success, nothing stored) and a link-spam check; an audit entry
  `lead.created`.

## 7. Reusing it for another tool

1. Build a `ReportDocument` from the tool's server-side result and server-owned texts, never from
   client-supplied text.
2. Serve it behind the tool's own access right: an unguessable, expiring token or an admin session.
3. Return `render_pdf(document)` with a generic file name, and `document.to_dict()` for the HTML view.
4. Test ownership, both locales, long and malicious text, and the failure paths.

The readiness and team PDFs keep their dedicated layouts; they can move to the document model later
without changing their access rules.

## 8. Tests

`apps/api/tests/test_assessments_v2.py`:

* PDF and JSON in both locales;
* headers and file names;
* ownership across two saved results;
* expired and deleted results;
* unknown fields and formats;
* font and size failures (503, 413), with the result still available;
* the rate limit and logs without the token;
* `clean()`, malicious and long text, and the generation limits;
* every shipped assessment rendering in both locales;
* the consultation (separate marketing consent, validation, spam controls, conflict, retention
  and erasure through the lead).

`apps/web/src/components/tools/assessment/engine.test.tsx`: the saved-report flow (escaped content,
the token only in POST bodies, PDF download, deletion). `e2e/tests/engineering-assessments.spec.ts`:
report view, PDF download (`%PDF-`, DejaVu font) and the consultation in Bulgarian.
