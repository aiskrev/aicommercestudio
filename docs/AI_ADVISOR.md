# AI Business Automation Advisor

Public page: **`/ai-automation-advisor`**. A small-business visitor describes one repetitive or
expensive manual process and receives a structured, indicative automation assessment. No account and
no personal data are required. A consultation request is optional.

> **Demo mode is the default.** Without `ANTHROPIC_API_KEY` the advisor runs on a local, deterministic
> template engine. The page, the API response (`mode: "demo"`) and every stored row say so: the output
> is *"съставен от предварително написани шаблони и прости правила … не е анализ, генериран от
> изкуствен интелект"*. Only with `AI_PROVIDER=anthropic` and a key does the response say `mode: "ai"`.

## User flow

| # | Step | Where |
| --- | --- | --- |
| 1 | Select business type | form (`business_type`, 10 options) |
| 2 | Describe the process | textarea, 40–2000 characters, PII warning, optional example |
| 3 | Volume, team size, current tools | ranges (`monthly_volume`, `team_size`), 16 tool checkboxes + free text |
| 4 | Validation | client (`lib/advisor.ts`) and server (Pydantic, `extra="forbid"`) |
| 5 | Assessment | `POST /api/public/advisor/assessments` |
| 6 | Result | 11 sections (below), mode badge, disclaimer, processing notices, reference, print |
| 7 | Optional consultation | inline contact form, assessment linked to the lead (`advisor_assessment_id`) |

### Output structure (`AutomationAssessment`)

| Section | Field | Shape |
| --- | --- | --- |
| Current problem summary | `problem_summary` | text |
| Automation opportunities | `opportunities` | 1–6 × title, description, approach (`rules` / `ai_assisted` / `integration` / `reporting`), qualitative priority |
| Proposed workflow | `proposed_workflow` | 2–10 × title, description, actor (`system` / `ai` / `human`), `requires_human_approval` |
| Systems to integrate | `integrations` | 0–8 × system, purpose, access (`read` / `write` / `read_write`) |
| Human approval requirements | `human_approvals` | 1–6 × decision, reason |
| Data protection | `data_protection` | 1–6 × text |
| Risks | `risks` | 1–6 × risk, mitigation |
| Complexity | `complexity` | level (`low` / `medium` / `high`), rationale |
| Indicative phases | `phases` | 1–5 × name, description, deliverables, indicative duration (range, labelled indicative) |
| Clarification questions | `clarification_questions` | 2–8 × text |
| Next steps | `next_steps` | 1–5 × text |

There are deliberately **no** fields for savings, ROI, prices or percentages.

## Architecture

```
browser ── /api/public/advisor/* ──► Next.js proxy (100 s timeout for this path)
                                       │
                                       ▼
FastAPI  routers/advisor.py   rate limit (per client + global) → form token → AdvisorRequest (Pydantic)
         advisor/service.py   screen input → provider.assess_automation() → validate → sanitise → store?
         advisor/safety.py    PII/link removal, injection detection, delimiter neutralising,
                              claim & link scrubbing of output, approval enforcement
         advisor/prompt.py    system prompt, <visitor_input> rendering, JSON schema from the output model
         ai/base.py           AIProvider protocol: triage_lead(), assess_automation() → AssessmentDraft
         ai/mock.py + ai/advisor_mock.py      deterministic demo engine (keyword patterns + templates)
         ai/anthropic_provider.py             Claude adapter (structured JSON output, no tools)
         models.AdvisorAssessment             PostgreSQL table advisor_assessments (migration 0003)
```

* **Provider-agnostic interface** — `AIProvider.assess_automation(AdvisorPromptInput) -> AssessmentDraft`.
  The service validates `AssessmentDraft.data` the same way for every provider.
* **Anthropic adapter** — `client.beta.messages.create(model=ANTHROPIC_MODEL, output_config={"effort":
  "medium", "format": {"type": "json_schema", ...}}, fallbacks="default")` with the
  `server-side-fallback-2026-07-01` beta (on a policy refusal, the API retries on a fallback model in the
  same call). No `tools` are sent. Handles `refusal`, `max_tokens`, empty/invalid JSON, timeouts,
  rate limits, API and connection errors.
* **Mock adapter** — `build_demo_assessment()`: matches keywords against 8 process patterns (invoices,
  orders, customer inquiries, reporting, catalogue, bookings, documents, sales) plus a general fallback,
  maps the selected tools to integration candidates and derives complexity from area count, systems,
  volume and team size. Same input → same output.

### Output validation

1. The JSON schema sent to the model is generated from the Pydantic output model with unsupported
   keywords (length, item counts, numeric bounds) stripped; every object has `additionalProperties:
   false` and all properties required (`test_output_schema_only_uses_structured_output_features`).
2. The response is validated with the same Pydantic model: wrong types, unknown fields, invalid enum
   values, missing sections or too few items → **502 `advisor_invalid_output`**, nothing stored.
   Over-long strings and lists are truncated instead of rejected.
3. `sanitize_assessment()` then
   * removes links (`[връзка премахната]`),
   * removes every sentence that promises money, savings, ROI, payback or percentages
     (`[Премахнато: прогнози за спестявания …]`),
   * sets `requires_human_approval = true` on any non-human step that sends, pays, refunds, deletes,
     publishes, cancels, changes prices/orders/stock/products or writes to ERP, accounting or the store,
   * adds a human-approval item when an integration writes to an external system.
   Each change adds a visitor-facing notice.

### Prompt injection defences

| Layer | Control |
| --- | --- |
| Input | e-mails, phone numbers and links removed before storage and before the provider sees the text; `<`, `>` and ``` replaced, so the visitor cannot close `<visitor_input>`; English and Bulgarian injection phrasing detected → `injection_suspected` (stored, logged as a flag, visitor notice, extra note in the prompt) |
| Prompt | instructions only in the system prompt; visitor data JSON-encoded inside `<visitor_input>`, declared untrusted; the model is told it has no tools and must not claim actions |
| Capability | no tools, no credentials, no network access for the model; the output is data rendered as text (React escapes it) |
| Output | schema validation + sanitising (above); nothing in the output is ever executed |

**No autonomous access to third-party systems:** the advisor has no integration code path at all. It
cannot send e-mails, payments or API calls; the "integrations" section is a recommendation list.

## Persistence, retention and notice

* Table `advisor_assessments` (see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md#advisor_assessments)): selections,
  the **screened** description, the validated result, mode/provider/model/prompt version, injection flag,
  `expires_at`, optional `lead_id`.
* Stored only when `save_assessment` is true (checkbox, on by default, explained next to it). Unchecked →
  the result is shown once and nothing is written.
* Unlinked rows expire after `ADVISOR_RETENTION_DAYS` (default **30**) and are deleted by
  `python -m app.cli maintenance` or the admin retention panel. A row linked to a lead is deleted
  together with that lead (FK `ON DELETE CASCADE`) and therefore follows lead retention and erasure.
* The page explains what is stored, for how long, and that in AI mode the description is sent to an AI
  provider. Before enabling `AI_PROVIDER=anthropic` in production: sign a DPA, name the provider in the
  privacy policy and check data transfers.

## Rate limiting, timeouts, errors

| Setting | Default | Meaning |
| --- | --- | --- |
| `ADVISOR_RATE_LIMIT` / `ADVISOR_RATE_WINDOW_SECONDS` | 5 / 3600 | per client; counted before validation (invalid requests count) |
| `ADVISOR_GLOBAL_RATE_LIMIT` | 120 per window | backstop against spoofed client addresses; protects provider spend |
| `ADVISOR_TIMEOUT_SECONDS` | 45 | per provider attempt; max one retry → ≈ 90 s worst case. The Next.js proxy waits 100 s for this path |
| `ADVISOR_RETENTION_DAYS` | 30 | expiry of unlinked assessments |

The form token (signed, ≥ 3 s old) is required, as for the contact form.

| Situation | Status | `code` |
| --- | --- | --- |
| invalid input | 422 | `validation_error` |
| missing/forged/too fast token | 400 | `form_token_invalid` |
| too many requests | 429 | `rate_limited` (+ `Retry-After`) |
| provider timeout | 504 | `advisor_timeout` |
| provider rate-limited | 503 | `advisor_busy` |
| provider down / API error | 503 | `advisor_unavailable` |
| model refused | 422 | `advisor_declined` |
| invalid / truncated model output | 502 | `advisor_invalid_output` |

Every error carries a Bulgarian `detail` and the `request_id`; provider error text is never exposed.

## Logging

`advisor_assessment_created`, `advisor_provider_error`, `advisor_output_invalid` contain only categorical
metadata: mode, provider, model, business type, volume, team size, tool count, description length,
injection flag, counts of removed claims/links/enforced approvals, stored flag, duration. **Never** the
description, the prompt or generated text (`test_logs_never_contain_the_description_or_generated_text`;
step 10 of the demo script greps the container logs).

## Enabling Claude

```env
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=<server-side secret, never in the web container or browser>
ANTHROPIC_MODEL=claude-opus-5-5
ADVISOR_AI_DAILY_LIMIT=20   # spending guard; 0 = no cap
```

**Cost and the spending guard.** With Claude Opus 5.5 ($4 input / $20 output per million tokens), one
assessment uses roughly 3–4k input tokens and a few thousand output tokens including thinking (`effort:
medium`, `max_tokens` 16 000), so about $0.10–0.20 each and at most about $0.35. `ADVISOR_AI_DAILY_LIMIT`
caps AI calls per UTC day. Beyond it, the advisor answers with the demo engine, labelled as demo, with a
notice; the provider is not called. The counter is in memory, per API instance, like the rate limits.
Also set a spend limit in the Anthropic Console: it is the hard limit.

The key is read only by the API container; the browser talks to the same-origin proxy and never sees it.
The Anthropic path is tested with a fake SDK client (request shape, no tools, timeouts, refusals, invalid
JSON). **It has not been called against the real API in this repository** (no key available).

## Demonstration

```powershell
.\scripts\demo-advisor.ps1
```

Synthetic data only. Steps: status (demo) → invalid input 422 → assessment → injection + PII handling →
assessment without storage → PostgreSQL rows → consultation linked to the lead → admin view → retention
preview → logs without content. A recorded run is in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Known limitations

* Demo output is template-based: it recognises keywords, not meaning. It is labelled accordingly.
* Injection detection is pattern-based and cannot catch everything; the structural controls (no tools,
  untrusted-data framing, output validation and sanitising) are the real defence.
* The claim filter removes sentences with money/percentage figures; it can occasionally remove a
  harmless sentence (for example a percentage the visitor wrote and the model repeated).
* Rate limits are in memory (single API instance), like the rest of V1.
* Option keys are duplicated in `apps/web/src/content/bg/advisor.ts` and `apps/api/app/advisor/schemas.py`;
  a mismatch shows up as a 422 in the e2e journey, not in a dedicated cross-package test.
