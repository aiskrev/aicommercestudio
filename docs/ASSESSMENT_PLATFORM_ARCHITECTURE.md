# Assessment platform architecture

One reusable, deterministic engine for questionnaire-based engineering assessments: versioned
definitions, typed answers, weighted dimensions, versioned scoring algorithms, result bands,
rule-based recommendations, localized texts, an opt-in saved result with retention and deletion,
and extension points for assessment-specific logic.

**Status:**

* **Live:** `cloud_platform` 1.0.0 and `devops_delivery` 1.1.0, both with web wizards
  ([ENGINEERING_ASSESSMENTS.md](ENGINEERING_ASSESSMENTS.md)), plus reports and PDF
  ([REPORTS.md](REPORTS.md)) and an optional consultation (migration `0012`).
* **Preview:** `devops_delivery` 1.0.0, kept for saved results, and Observability & Reliability. The
  public API serves preview definitions only when `ASSESSMENTS_PREVIEW_ENABLED=true` (tests,
  staging).

**Additions since the first version** (all optional fields, so existing definitions and saved
results are unchanged):

* question `evidence`: `practice` (scored), `metric` and `context` (never scored);
* rule `kind`: `recommendation`, `risk`, `quick_win`, `target_state`, `pattern`, `context` (only
  `recommendation` counts toward the cap);
* rule `horizon` (30/60/90) and `domains`;
* in the result view: `because` (the inputs or thresholds behind each finding), a level per
  dimension, `roadmap`, `domains` and `inputs`.

## 1. What already existed (inspected)

| Tool | Abstraction | Scoring | Persistence | Lead capture |
| --- | --- | --- | --- | --- |
| AI Business Automation Advisor (`app/advisor`) | free-text process description → AI analysis (or demo) | none: an LLM proposes, a validator constrains the output; no authoritative score | `advisor_assessments`, sanitised description, expires (`ADVISOR_RETENTION_DAYS`), linked to a consultation lead with `ON DELETE CASCADE` | consultation → lead |
| AI readiness (`app/readiness`, `lib/readiness.ts`) | 12 fixed questions, levels 0–4 | pure function ported line by line between web and API; shared golden vectors; `MODEL_VERSION` rejects stale bundles | none (anonymous PDF); a submission stores answers and the server result in `leads.service_details` | explicit submission with consent → lead |
| Build your AI team (`app/team`) | configurator | rules + cost model (assumptions file) | `team_configurations`: enumerated JSONB, SHA-256 token hash, expiry | consultation → lead |
| ROI calculator, Opportunity Finder (web) | calculator / rubric | client-side pure functions, visible formula | none | contact form |

Patterns reused here: server-side recomputation (the client never supplies a score), versions on
every stored result, per-client + global rate limits (`enforce_rate_limit`), the 413 body-size
middleware, secret link tokens stored as SHA-256 hashes, POST lookups (tokens never in URLs),
expiry columns purged by `python -m app.cli maintenance`.

## 2. Scope: questionnaires, not every tool

The engine models **questionnaires**: questions → answers → weighted dimension scores → band →
recommendations. It deliberately does not absorb tools with a different shape:

| Tool kind | Abstraction | Where |
| --- | --- | --- |
| Questionnaire assessment (maturity, readiness, governance …) | this engine | `app/assessments` |
| Calculator (ROI, cost) | formula module with its own typed inputs and a visible formula | `lib/roi.ts`, `app/team/costs.py` |
| Configurator (AI team, solution builder) | domain model + rules + diagram | `app/team`, `lib/solution.ts` |
| AI analysis (Advisor) | LLM proposal constrained by a validator; never an authoritative score | `app/advisor` |

The existing readiness assessment keeps its own model for now (PDF report and web parity depend on
it). `test_engine_reproduces_the_readiness_golden_vectors` proves the engine reproduces its overall,
band and dimension scores for all 61 golden vectors when the readiness model is written as a
definition, so it can migrate onto the engine later without changing any score.

## 3. Package layout (`apps/api/app/assessments`)

| Module | Responsibility |
| --- | --- |
| `definition.py` | Frozen Pydantic models of a definition (unknown fields rejected) and the cross-reference validation |
| `definitions/<key>/<version>.json` | The definitions: data, versioned, reviewed like code |
| `registry.py` | Loads and validates every definition at start-up (`create_app`); `current(key)`, `get(key, version)` |
| `answers.py` | Server-side answer validation and normalisation; per-question error codes and BG/EN messages |
| `scoring.py` | Versioned pure scoring algorithms (`weighted-mean/1`), exact arithmetic, fingerprint |
| `rules.py` | Typed recommendation conditions, evaluated by plain Python |
| `extensions.py` | Assessment-specific hooks registered by name in code |
| `presenter.py` | Localized public definition and result views |
| `service.py` | Use cases: assess, save, find, delete, re-score saved results, purge |
| `api_schemas.py`, `routers/assessments.py` | Public API |

## 4. Definitions

A definition is **data, never code**. It is read only from the repository (never from the database
or from a request) and validated when loaded:

```text
key, version (semver), status (live | preview), scoring {algorithm, max_recommendations},
dimensions [{key, weight 1–100}],
questions [{key, type, dimension, weight 1–10, required, …type fields}],
bands [{key, min}]  — the first starts at 0, minimums strictly increase,
rules [{key, priority, when: Condition, recommendation}],
extension (optional name), texts {bg, en}
```

**Answer types:**

| Type | Answer | Fraction of the question's maximum |
| --- | --- | --- |
| `single_choice` | option key | option points / highest option points |
| `multi_choice` | list of option keys (≤ `max_selections`, no duplicates; may be empty) | min(Σ points, `cap`) / `cap` |
| `scale` | integer in [`min`, `max`] (booleans rejected) | (value − min) / (max − min) |
| `boolean` | true / false | points / max(`points_true`, `points_false`) |
| `number` | number in [`min`, `max`] (integer unless `integer: false`; NaN/∞ rejected) | points of the highest band reached / highest band points |

**Load-time validation** (a broken definition stops the start-up and CI):

* unique keys (dimensions, questions, bands, rules, options);
* every question belongs to a known dimension, and every dimension has a required question;
* weights and points within bounds, and at least one scoring option per question;
* scale and number ranges are valid; number bands start at `min` and increase strictly;
* bands are contiguous from 0;
* rule conditions reference known dimensions, bands, questions and options, and are nested at most
  3 levels deep;
* `answer_missing` only on optional questions;
* texts exist for both `bg` and `en` and cover exactly the dimensions, questions, options, bands and
  recommendations; no Cyrillic in `en`;
* the file path matches `key/version`, and the extension name is registered.

**Versioning:** a published version is immutable. Any change to questions, options, points, weights,
bands, rules or texts that affects meaning is a new version file. The newest version scores new
requests; older versions stay in the repository so saved results re-render with the version they
were scored with. A stale client (different `definition_version`) gets 409
`assessment_version_outdated` with the current version, instead of being scored against questions
it did not show.

## 5. Scoring (`weighted-mean/1`)

```text
question fraction  per answer type (table above)
dimension ratio    Σ (question weight × fraction) / Σ question weight, over the answered questions
dimension score    round-half-up(ratio × 100)
overall            round-half-up(100 × Σ (dimension weight × ratio) / Σ dimension weight)
band               the band with the highest minimum ≤ overall
```

* Pure functions on `fractions.Fraction`: no floating-point drift, rounded once per reported
  number (half up, like the web tools; Python's `round` would round 12.5 to 12).
* Unanswered **optional** questions are left out of their dimension's mean, so skipping is neither
  a 0 nor a 100. A dimension always has a required question.
* `fingerprint` = first 16 hex characters of SHA-256 over the key, version, algorithm and the
  canonical answers. It is a stable, non-personal reference to an answer set, used in logs and
  responses.
* A different formula is a **new algorithm id** registered in `ALGORITHMS`. Existing ids never
  change, which is what keeps stored results reproducible.
* No LLM is involved in any score.

## 6. Recommendations

Rules are typed conditions combined with `all` / `any`:

* `dimension_below`, `dimension_at_least`;
* `overall_below`, `overall_at_least`;
* `band_in`;
* `answer_in` (a choice answer is, or contains, one of the options);
* `answer_missing` (optional questions only).

They are evaluated in plain Python. There is no expression language and no `eval`, and nothing
executable comes from data. Rules that hold are ordered by (priority, rule key), each
recommendation appears once, and the list is capped at `max_recommendations`. Recommendation texts
are localized per definition version.

## 7. Extension points

`extensions.py` registers `AssessmentExtension` subclasses by name. A definition opts in with
`"extension": "<name>"`, and the name must be registered. Hooks:

* `validate(definition, answers) -> [AnswerError]`: cross-question consistency, run after the
  per-question validation. Example: an on-call rota without any collected telemetry is
  `inconsistent`.
* `derive(definition, answers, result) -> dict`: extra JSON-safe values (enumerated keys and
  numbers only), returned as `extras` and saved with the result. Example:
  `{"missing_signals": ["traces"]}`.

Extensions cannot change the overall score, the band or the dimension scores.

## 8. Localization

Every visible string lives in the definition's `texts.bg` / `texts.en`: title, intro, disclaimer,
dimension titles and descriptions, question texts, help, units and option labels, band titles and
descriptions, and recommendation titles and descriptions. API error messages for answers are
localized in `answers.ERROR_MESSAGES`. The public definition omits points, weights and caps:
results are computed only on the server.

## 9. API (`/api/public/assessments`)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/public/assessments?locale=` | the definitions that may be served (live; preview only when enabled) |
| GET | `/api/public/assessments/{key}?locale=` | localized questions, options and ranges; no points or weights; 404 `assessment_not_found` |
| POST | `/api/public/assessments/{key}/score` | `{schema_version: "1", definition_version, locale, answers, save}` → localized result; 409 `assessment_version_outdated`, 422 `assessment_invalid_answers` with `errors[{field: "answers.<key>", message, type}]` |
| POST | `/api/public/assessments/results/lookup?locale=` | `{token}` → the saved result, re-scored with its own version; 404 `assessment_result_not_found` (unknown, expired or not reproducible) |
| POST | `/api/public/assessments/results/delete` | `{token}` → 204 (idempotent) |

**Request limits:**

* per client and globally (`ASSESSMENT_RATE_LIMIT`, `ASSESSMENT_LOOKUP_RATE_LIMIT`,
  `ASSESSMENT_GLOBAL_RATE_LIMIT` per `ASSESSMENT_RATE_WINDOW_SECONDS`), with a separate, lower
  `ASSESSMENT_SAVE_RATE_LIMIT`;
* at most 60 answers and 12 selections per answer, and short keys;
* only JSON primitives and lists of strings as answer values;
* unknown top-level fields (for example `weights`) are rejected;
* the global 413 body-size limit applies.

## 10. Persistence, retention and deletion

* **Anonymous by default:** scoring needs no personal data and stores nothing.
* **Opt-in save (`save: true`):** one row in `assessment_results`, migration `0011`. It holds the
  key, definition version, algorithm and locale, the normalised answers (option keys, booleans and
  numbers; no free text, no personal data), the server result (`ScoreResult.summary()`), the
  fingerprint, the SHA-256 hash of a 256-bit secret token (`secrets.token_urlsafe(32)`, returned
  once) and `expires_at = now + ASSESSMENT_RETENTION_DAYS` (default 90, max 365).
* **Reading:** `POST …/results/lookup` with the token. The result is re-scored with the stored
  version, and a mismatch (a version edited in place, or a tampered row) is logged as
  `assessment_rescore_mismatch` and never served.
* **Deletion:** the visitor deletes it with the token (`…/results/delete`, also after expiry).
  Expired rows are purged by `python -m app.cli maintenance` (`assessment_results=` in its output).
* **Lead capture:** none yet. A future consultation hand-off would follow the readiness and team
  pattern: explicit consent, consent versions, the server result copied into
  `leads.service_details`, and a link column with `ON DELETE CASCADE` added in its own migration.
* **Logs:** key, version, band, fingerprint and whether the result was saved; never answers or
  tokens.

## 11. Adding an assessment

1. Write `definitions/<key>/1.0.0.json` with `status: "preview"` (BG and EN texts complete).
2. If needed, add an `AssessmentExtension` and reference it by name.
3. Add tests: boundary answers (all minimum, all maximum, exactly on each band minimum), a rounding
   case, every rule, the extension, and BG/EN texts.
4. Build the web form from `GET /api/public/assessments/{key}` and keep the tool "Coming soon" until
   it is reviewed.
5. Switch `status` to `live` in a new patch version, and flip the tool to `live` in `lib/tools.ts`.

Changing a live definition: copy it to a new version file and edit the copy. Never edit a version
that may have saved results.

## 12. Tests (`tests/test_assessments.py`)

* **Definitions:** shipped definitions load; invalid definitions are rejected (weights ≤ 0, an empty
  dimension, gapped or duplicate bands, an unknown algorithm, unknown references, an `eval`-like
  condition kind, extra fields such as `points` on a scale, missing or Cyrillic EN texts, a wrong
  file location, an unknown extension).
* **Scoring:**
  * boundary scores: 0 and 100, exactly on a band minimum, a 12.5 → 13 half-up case;
  * exact weighted arithmetic;
  * determinism, order independence and the fingerprint;
  * the readiness golden-vector parity.
* **Answers:** missing required, optional skipped (excluded from the mean and triggering
  `answer_missing`), wrong types, booleans as numbers, non-integer numbers, NaN, out of range,
  duplicate and too many selections, unknown keys (`weights` inside answers).
* **Rules and extensions:** priority order, de-duplication, the limit, `all` / `any`; the extension's
  validation and extras; localized views without points or weights, no Cyrillic in EN.
* **API:**
  * listing and definition;
  * preview hidden when disabled;
  * anonymous scoring stores nothing;
  * tampered payloads rejected (extra `weights`, a `score` answer, 61 answers, an object answer);
  * outdated version → 409 with the current version;
  * save → lookup → delete (idempotent);
  * a tampered stored result is not served;
  * saved results re-scored with their own version after a newer version (1.10.0 > 1.0.0) becomes
    current;
  * expiry and purge (dry run and real);
  * rate limits, including the lower save limit.
