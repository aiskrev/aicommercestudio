# AI Business Automation Advisor — V2

V2 extends the existing advisor ([AI_ADVISOR.md](AI_ADVISOR.md)) without changing V1. A versioned
request contract adds an enumerated business and integration context. The server then computes
deterministic, explainable **insights** on top of the validated V1 assessment.

## 1. What was preserved (inspected before the change)

| Area | V1 behaviour | In V2 |
| --- | --- | --- |
| API | `POST /api/public/advisor/assessments`, strict `AdvisorRequest` (`extra="forbid"`) | same endpoint; `contract_version` "1" is the default and returns the identical response |
| Schemas | `AutomationAssessment` (Pydantic) is both the model's JSON schema and the validator | unchanged; the model never sees or writes the V2 insights |
| Demo provider | offline, deterministic template engine (`ai/advisor_mock.py`); the safe default | unchanged and still the default; V2 insights are the same for demo and AI |
| Anthropic adapter | structured output, no tools, refusal/timeout/invalid-JSON handling | unchanged; for V2 the enumerated context is added to the `<visitor_input>` data block |
| Validation and safety | screening (PII, links, injection), output validation, claim and link scrubbing, approval enforcement | unchanged; insights are built only *after* the output is validated and sanitised |
| Storage and privacy | opt-in `save_assessment`, screened text only, `ADVISOR_RETENTION_DAYS`, lead link with `ON DELETE CASCADE` | unchanged; V2 adds `contract_version` and `insights` columns (migration `0012`) |
| Rate limits | per client and global, counted before validation | V1 and V2 share the same limits |
| Approval policy | side-effect steps always require human approval | unchanged; V2 adds approval checkpoints derived from the context |

## 2. Contract versioning

| `contract_version` | Request | Response |
| --- | --- | --- |
| omitted or `"1"` | V1 fields only; `context` or `include_roadmap` → **422** | exactly the V1 response, without `contract_version` or `insights` (tested key by key) |
| `"2"` | V1 fields + required `context` + optional `include_roadmap` | the V1 fields + `contract_version: "2"` + `insights` |

`context` is enumerated only (no free text, no personal data); unknown fields and values are rejected:

| Field | Values |
| --- | --- |
| `goal` | `save_time`, `reduce_errors`, `faster_response`, `handle_growth`, `better_visibility` |
| `data_sensitivity` | `none`, `business`, `personal`, `financial`, `special_category` |
| `customer_facing` | boolean |
| `system_access` | `api`, `exports`, `manual_only`, `unknown` |
| `change_capacity` | `no_it`, `external_it`, `internal_it` |

**The prompt.** `PROMPT_VERSION` (`advisor-2026-10-26`) stays the V1 prompt, byte for byte. V2 requests
are stored with `PROMPT_VERSION_V2` (`advisor-2026-10-29-v2`). The only difference is a `context`
object with localized labels inside the JSON `<visitor_input>` block, so it remains untrusted data.

**Existing assessments.** Migration `0012` adds `advisor_assessments.contract_version` (server
default `"1"`) and `insights` (nullable JSONB). Existing rows read as V1 with no insights. The admin
lead view (`AdvisorAssessmentSummary`) now also returns `contract_version` and `insights`; both are
additive fields.

## 3. Insights (`app/advisor/insights.py`, engine `advisor-insights/1`)

Fixed rules compute the insights from the context and the validated, sanitised assessment. They
are validated with Pydantic (`AdvisorInsights`, `extra="forbid"`). Their texts are server-owned and
localized (`app/advisor/insight_texts.py`, BG/EN). They contain no numbers about money, savings or
percentages.

| Section | Rules |
| --- | --- |
| Opportunity classification | approach → category (`rules` → workflow automation, `ai_assisted`, `integration`, `reporting`); fit = the assessment's priority, one step lower for an integration when access is `manual_only` or `unknown` |
| Feasibility | factors: system access (API supports; exports, manual or unknown limits), complexity (low supports, high limits), change capacity (in-house IT supports, no IT limits); level = supports − limits (≥ 2 high, ≥ 0 medium, otherwise low) |
| Risk profile | personal, financial or special-category data; customer-facing; integrations that write. Level **high** for special-category data, or customer-facing with financial data or writes; **medium** when any risk is present; otherwise **low** |
| Service domains (≤ 4, the ten catalogue domains) | candidates in a fixed priority: AI agents & automation (workflow or AI opportunities), advisory (low feasibility or unknown access), data & integration (integrations, exports, manual access), AI governance (sensitive data or customer-facing), managed operations (no IT), AI applications (AI-assisted), commerce engineering (online store or e-commerce tools) |
| Human-approval checkpoints | every workflow step that requires approval; every outgoing customer message during the pilot (customer-facing); payments and accounting entries (financial data or money tools) |
| Integration and security prerequisites | access per integration (service-account API key or export), confirming access when unknown, least-privilege service accounts, data minimisation and processing agreements (sensitive data), a sandbox before writing to a system, an escalation path (customer-facing), a log of automated actions |
| Pilot | scope = the highest-priority opportunity for one team or channel; indicative duration by complexity (low 2–4, medium 4–8, high 6–12 weeks); success criteria are measurements, never promised results |
| Roadmap (only with `include_roadmap`) | 30 days preparation, 60 days pilot, 90 days decision |

**Provenance.** Every opportunity, factor, risk, domain, checkpoint, prerequisite and the pilot carry
`basis[]`. Each basis is `{source: input | assessment | rule, key, label}`, for example
`context.system_access` with the label "Access to the systems: APIs available". The UI shows it as
"Basis: …". `provenance_note` states that the insights are rule-based, not generated by the model.

**Provider neutrality.** The same assessment yields the same insights, whether it comes from the
demo engine or from an AI provider (tested). The AI model stays an optional enhancement of the V1
text only.

## 4. Web

The advisor form keeps V1 as the default. An optional fieldset, "Add context for a more detailed
analysis (version 2)", reveals five required choices and the roadmap option. With it, the client
sends `contract_version: "2"`; without it, the payload is byte-for-byte the V1 payload.
`AdvisorInsights` renders the insights below the V1 result: classification, feasibility, risk,
checkpoints, prerequisites, pilot, the optional roadmap and service domains linked to the published
hubs. Each item shows its basis.

## 5. What V2 does not do

* No autonomous tools, no e-mail sending, no calls to third-party systems and no production
  changes: the advisor still has no integration code path.
* No model-generated financial figures. The V1 claim scrubbing still applies to model text; the
  insights are written by the server and contain no amounts.
* No new personal data: the context is enumerated and stored only when `save_assessment` is true,
  under the same retention.

## 6. Tests and evidence

* `apps/api/tests/test_advisor_v2.py` (16 tests, 19 cases):
  * the old contract (response keys, prompt, stored rows);
  * V2 fields rejected on V1;
  * both locales (no Cyrillic in EN, Bulgarian in BG);
  * rule-driven insights and provenance;
  * provider neutrality, and the V2 context reaching the provider only inside the data block;
  * prompt injection still flagged;
  * malformed model output → 502 with nothing stored, and provider errors keeping the V1 error contract;
  * shared rate limits, retention, and V2 insights surviving the consultation link.
* `apps/api/tests/test_advisor.py` and `test_advisor_english.py`: the existing V1 tests pass unchanged.
* `apps/web/src/components/advisor/advisor-v2.test.tsx`: the V1 payload stays unchanged, context
  validation, option labels in both languages, insights rendering with the basis, and no money
  claims in the texts.
* `apps/web/e2e/tests/engineering-assessments.spec.ts`: an Advisor V2 journey in English (context,
  insights, basis, roadmap); `advisor.spec.ts` keeps the V1 journey.

Recorded results are in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).
