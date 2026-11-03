# AI Managed Services v2 — service levels, qualification and admin categorisation

Status: implemented on 2026-11-03 (branch `feature/solution-builder-managed-v2`).

This version builds on [AI_MANAGED_SERVICES.md](AI_MANAGED_SERVICES.md): the page, the intake form,
lead storage and the admin view. It adds:

* three **proposed service levels**, each described on 13 dimensions, with a comparison;
* a clear split between **current** and **planned** capability;
* optional **qualification questions** in the intake form;
* a deterministic **admin categorisation**: suggested level and onboarding readiness.

The existing lead flow and its validation are unchanged. Every new field is optional, and inquiries
without the new fields are accepted exactly as before.

## Ground rules (enforced by content and tests)

The site does not invent or publish:

* prices or currency amounts;
* 24/7 staffing;
* SLAs, uptime or availability guarantees;
* response times as figures;
* supported integrations by vendor name;
* live monitoring.

The level names are **working proposals, not a commercial commitment**. The page says so twice: in
`packages.proposedNote` and in `levels.proposedNote`.

Response targets are listed only as "agreed per contract", and only when they match real staffing.
The portal and telemetry are shown as **Planned**, without data.

Checks: `content.test.ts` (no forbidden terms or numbers in the packages, levels and availability;
no vendor names), `e2e/tests/managed-services-v2.spec.ts` and `i18n.spec.ts`.

## Service levels (proposed labels)

| Key | Name | For |
| --- | --- | --- |
| `essential` | Essential Monitoring & Advisory | one AI assistant or process that already runs and has an owner; reviews and recommendations, no changes made by us |
| `managed` | Managed AI Operations | AI in daily operations with several agents or processes; monitoring of agreed signals, scheduled evaluations, configuration maintenance, incident triage |
| `advanced` | Advanced AI Reliability & Optimization | business-critical processes with many integrations or sensitive data; custom evaluations, managed changes with rollback, integration health checks, improvement plan |

The keys replace the earlier package keys `monitor`, `care` and `optimize`. The homepage card, the
comparison table, the legal note and the service catalogue texts use the new names.

### Dimensions

Every level is described on the same 13 dimensions (`LEVEL_DIMENSIONS` in
`content/bg/ai-managed.ts`, texts in `aiManaged.levels.items[level][dimension]`, BG and EN):

| Dimension | What it states |
| --- | --- |
| `ideal` | ideal customer |
| `entry` | entry requirements: technical owner, written system description, read access, non-production environment, evaluation cases, incident channel, approvers |
| `included` / `excluded` | included and excluded responsibilities (e.g. no unlimited changes, no guarantee of model correctness, no work without a contract) |
| `monitoring` | monitoring and evaluation activities, always with the customer's own tools |
| `change` | change management and human approvals (recommendation only → approval before release → managed changes with rollback; model output never bypasses deterministic checks) |
| `incidents` | incident triage and escalation (reporting → triage and escalation → agreed procedure and post-incident review) |
| `cost` | cost and usage reviews, measured against a baseline, no promised savings |
| `security` | security and privacy boundaries (read-only or least-privilege accounts, keys in the customer's secrets store, DPA before production data) |
| `onboarding` / `offboarding` | onboarding and offboarding, including handover and removal of access |
| `dependencies` | dependencies on customer access and integrations |
| `configurable` | commercially configurable scope and response targets (volume, hours, channels; targets only per contract) |

The page shows each level as an expandable section (`#ams-levels`, `data-testid="level-<key>"`). The
comparison table compares the levels on ten rows. One row is "Response targets: agreed per contract".

### Current and planned capability

`aiManaged.availability` (`#ams-availability`):

* **Available today**: technical assessment, reviews from the customer's logs and dashboards with
  read-only access, evaluation sets and regression reviews, configuration maintenance within the
  agreed volume, monthly reports, and incident triage during business hours.
* **Planned (not available yet)**: the AI Operations Portal with data from connected systems,
  automatic telemetry collection, deviation alerts, and self-service reports and approvals
  ([AI_OPERATIONS_PORTAL.md](AI_OPERATIONS_PORTAL.md)).

The note says the site shows no live data, monitors nothing and promises no specific integrations.

## Qualification form

The AI Managed section of the inquiry form (`components/contact/AiManagedFields.tsx`) has a new fieldset,
"Qualification (optional)" (`data-testid="ai-qualification"`). It holds eight native selects, each
labelled optional:

| Form field | API field (`ai_managed.*`) | Values |
| --- | --- | --- |
| `ai_desired_level` | `desired_level` | `essential, managed, advanced, unsure` |
| `ai_production_status` | `production_status` | `production, pilot, development` |
| `ai_technical_owner` | `technical_owner` | `yes, no` |
| `ai_access_readiness` | `access_readiness` | `read_access, needs_approval, not_possible, unknown` |
| `ai_test_environment` | `test_environment` | `yes, no, unknown` |
| `ai_data_sensitivity` | `data_sensitivity` | `public_internal, personal, special` |
| `ai_change_frequency` | `change_frequency` | `rarely, monthly, weekly, unknown` |
| `ai_response_needs` | `response_needs` | `business_hours, faster, unsure` |

* **Optional.** An empty answer is sent as `null`. The client (`AI_QUALIFICATION` in
  `lib/contact-validation.ts`) and the API (`AiManagedDetails` enums) reject unknown values. All
  existing rules are unchanged: required fields, credential detection, no links, flat field names in
  errors.
* **No secrets.** The questions are all choices, with no free text, so they add no place to enter a
  credential.

## Admin categorisation

`apps/api/app/services/ai_managed_qualification.py` (`QUALIFICATION_VERSION = "2026-11.1"`) computes
a triage from the validated answers when the lead is created. It is stored as
`service_details.qualification`. It is **for the team only**: no public response carries it, and it is
never a commitment. The level is agreed after the technical assessment.

### Suggested level

Additive points, each with a reason key:

* agents: 2–5 → 1, 6–20 → 2, over 20 → 3;
* workflow automation or a custom LLM application → 1;
* personal data → 1, special data → 2;
* monthly changes → 1, weekly → 2;
* shorter response targets needed → 2;
* full managed service or incident support requested → 1;
* in production → 1.

Bands: **essential** < 3, **managed** 3–5, **advanced** ≥ 6.

### Readiness

* `not_ready` when the system is still in development or no access is possible.
* `unknown` when production status, technical owner or access is not answered. This also covers
  every inquiry made before v2.
* Otherwise `needs_preparation` when any of these holds:
  * there is no technical owner;
  * access is not confirmed;
  * there is no test environment for a level above essential.
* Otherwise `ready`.

The result also records `desired_level` and `matches_desired` (null when unsure or unanswered).

### Admin view

* **Lead detail.** The "Preliminary categorisation" panel shows the suggested level with its points,
  the readiness, the desired level and whether it matches, the reasons and what is missing. The AI
  system panel adds the qualification answers. Leads stored before the triage get one computed on read.
* **Leads list.** It shows the level and readiness under the service, and two filters:
  `ams_level` and `ams_readiness` (`GET /api/admin/leads`, [API_REFERENCE.md](API_REFERENCE.md)). The
  filters use the stored triage.
* **Recategorising.** It works as before: `PATCH` the lead's service. The triage stays with the stored
  answers.

## Tests

| Kind | File |
| --- | --- |
| Content: three levels × 13 dimensions in BG and EN, proposed-label notes, current and planned lists, no prices / 24/7 / SLA / uptime / time figures / vendor names | `apps/web/src/content/content.test.ts` |
| Form: questions optional, values validated, mapped to the API fields (null when empty), labels for every option in both languages | `apps/web/src/lib/i18n.test.ts` |
| API: the existing flow without the new fields, answers stored and triaged, readiness rules, test environment only above essential, level bands, invalid values rejected, admin filters and detail, triage computed on read for older leads, never public | `apps/api/tests/test_ai_managed_qualification.py` (plus the unchanged `test_ai_managed_and_locale.py`) |
| e2e: BG/EN pages with every level on every dimension, current and planned, no forbidden terms, phone width; API validation of the new fields; a qualified inquiry categorised and filtered in the admin (with admin credentials) | `apps/web/e2e/tests/managed-services-v2.spec.ts`, updated `i18n.spec.ts`, `public.spec.ts` |

## Not implemented

* No monitoring, telemetry, alerting or portal data. These stay planned.
* No contracts, prices or response targets on the site.
* The triage is a rule-based aid. It does not assign the lead, change its status or contact the
  customer.
