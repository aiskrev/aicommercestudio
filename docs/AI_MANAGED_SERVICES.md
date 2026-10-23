# AI Managed Services

**BG:** AI Managed Services — Управление и поддръжка на AI агенти
**EN:** AI Managed Services — AI Agent Operations & Optimization

The seventh primary service. It covers the *operation* of AI systems that already exist (built by
us, by the client or by another team): monitoring, maintenance, quality evaluation, cost control,
security and governance, continuous improvement and incident handling.

> Status: the public service page, the intake form, lead storage and admin display are implemented.
> No monitoring, evaluation or alerting runs against client systems yet — that is the future
> AI Operations Console ([AI_OPERATIONS_ARCHITECTURE.md](AI_OPERATIONS_ARCHITECTURE.md)).

## Where it lives

| What | Bulgarian | English |
| --- | --- | --- |
| Service page | `/bg/uslugi/ai-managed-services` | `/en/services/ai-managed-services` |
| Inquiry form | `#ams-inquiry` on the service page; also `/bg/kontakti?usluga=ai_managed` | `/en/contact?service=ai_managed` |
| Content | `apps/web/src/content/bg/ai-managed.ts` | `apps/web/src/content/en/ai-managed.ts` |
| Page | `apps/web/src/app/[locale]/uslugi/ai-managed-services/page.tsx` (one page, both locales) | |
| Form section | `apps/web/src/components/contact/AiManagedFields.tsx` | |
| Diagram | `apps/web/src/components/sections/AiOpsDiagram.tsx` (conceptual, labelled as such) | |
| API | `POST /api/public/leads` with `service = "ai_managed"` and an `ai_managed` object | |
| Storage | `leads.service = 'ai_managed'`, details in `leads.service_details` (JSONB) | |
| Admin | lead detail panel “Client's AI system”, filter by service and language | |

Service key: `ai_managed` (frontend `ServiceKey`, backend `ServiceKey.AI_MANAGED`, Alembic migration
`0004`). The service card is the 7th card on the home page and the services page (full-width card
so the grid stays balanced); it is linked from the AI solutions page, the AI tools and automation
service pages (related services), the industries page, the home FAQ and the footer.

## Page structure (13 sections)

1. Hero — BG H1 “AI агентите ви заслужават професионална поддръжка.”, EN H1 “Keep your AI agents
   running at their best.”, CTAs *Заяви AI оценка / Request an AI Assessment* and
   *Разгледай услугите / Explore Our Services*.
2. Positioning and differentiation (operation, not a one-off build).
3. Who it is for (7 segments).
4. Why AI systems fail in production — the site can be up while the agent is broken (13 causes).
5. Conceptual diagram: AI Application → Monitoring & Evaluation → Incident Management →
   Optimization → Reliable Business Operations.
6. Monitoring — what can be observed now vs what requires integration with the client's system.
7. Maintenance — with an explicit boundary: no unlimited new development.
8. Quality evaluation — criteria and four **illustrative** examples (support bot, knowledge
   assistant, workflow automation, document processing). No quality guarantee.
9. Cost optimization — levers, no guaranteed savings.
10. Security & governance — including the principle *model output must not bypass deterministic
    authorization or business rules*.
11. Continuous improvement and incident response (8 steps, no published response times).
12. Packages (AI Monitor / AI Care / AI Optimize), comparison table, included / not included,
    third-party costs, “no SLA” note, onboarding (5 steps), scope and exclusions.
13. FAQ (7), final CTA and the intake form.

## Packages

| Package | For | Highlights |
| --- | --- | --- |
| AI Monitor | one relatively simple assistant | assessment, basic health monitoring where supported, usage/cost visibility, monthly summary |
| AI Care | AI used in daily operations | + detailed monitoring, scheduled evaluation, prompt/config maintenance, incident triage |
| AI Optimize | business-critical AI workflows | + comprehensive observability, custom evaluations, change management, integration health checks |

Every package shows **“По индивидуална оферта” / “Custom quote”** and the CTAs
**“Заяви оценка” / “Request an assessment”** and **“Свържи се с нас” / “Contact us”**.

Rules enforced by content and tests (`content.test.ts`, `e2e/tests/i18n.spec.ts`):

* no public prices, no currency amounts;
* no “unlimited” usage, incidents or development, no 24/7, no SLA, no uptime promise in any package
  or comparison cell — the only mention is the explicit disclaimer `noSlaNote`;
* third-party costs (model provider, hosting, tools) are always separate;
* the illustrative evaluation examples are labelled as examples, not client results.

Internal pricing guidance (hypothetical, not published): [AI_MANAGED_SERVICES_PRICING.md](AI_MANAGED_SERVICES_PRICING.md).

## Intake form

Shown when the selected service is `ai_managed` (on the service page it is pre-selected).

| Field | Required | API field | Values |
| --- | --- | --- | --- |
| Company, contact name, business email, phone (optional), project description | as the standard form | `company`, `name`, `email`, `phone`, `message` | |
| Sector | yes | `ai_managed.sector` | `ecommerce`, `retail`, `professional_services`, `manufacturing`, `logistics`, `healthcare`, `finance`, `software_saas`, `agency`, `other` |
| AI solution type(s) | at least one | `ai_managed.system_types[]` | `customer_support`, `knowledge_assistant`, `workflow_automation`, `sales_assistant`, `document_processing`, `custom_llm_app`, `other` |
| Number of agents / workflows | yes | `ai_managed.agents_count` | `1`, `2_5`, `6_20`, `over_20`, `unknown` |
| Current AI provider | no (≤120 chars, no links) | `ai_managed.ai_provider` | free text, name only |
| Hosting environment | no | `ai_managed.hosting` | `vendor_platform`, `public_cloud`, `private_server`, `on_premise`, `unknown`, `other` |
| Main operational problems | yes (the message field is relabelled) | `message` | 20–5000 chars |
| Support interests | at least one | `ai_managed.support_interests[]` | `monitoring`, `maintenance`, `security`, `cost_optimization`, `quality_evaluation`, `incident_support`, `full_managed` |
| Preferred communication language | yes (defaults to the page language) | `ai_managed.communication_language` | `bg`, `en` |
| Additional notes | no (≤2000 chars) | `ai_managed.additional_notes` | free text |
| Privacy acknowledgement | yes | `privacy_acknowledged` | |

### What the form never collects

The form shows a warning and both client and server reject text that looks like a credential
(`looksLikeSecret` in `apps/web/src/lib/contact-validation.ts`, `looks_like_secret` in
`apps/api/app/schemas.py`): API keys (`sk-…`, `AKIA…`, `ghp_…`, `xox…`, `AIza…`), JWTs, private
keys and `password: …` / `token = …` patterns. The message, the provider field and the notes are
checked. Customers are asked **not** to send API keys, passwords, access tokens, private customer
records, production database credentials or sensitive internal documents. Access to a client
system is agreed separately, after the assessment, through the client's own access management.

The public intake flow **never connects to the client's AI agent** — it only stores the
descriptive answers.

## Storage, admin and audit

* `leads.service = 'ai_managed'`; `leads.locale` = page language; `leads.service_details` =
  `{"kind": "ai_managed", ...validated fields}`. The JSONB is written only from the validated
  `AiManagedDetails` model and re-validated when the admin API reads it (invalid rows are shown
  without the panel instead of failing).
* Admin: lead detail panel with translated option labels, language field, filter
  `?locale=bg|en` and `?service=ai_managed`, dashboard counts by language.
* Audit: `lead.created` includes `service` and `locale`; viewing, status changes, notes and deletion
  are audited exactly like other leads. Retention and GDPR deletion apply unchanged.
* The details are never returned by public endpoints (the public response is only
  `status`, `reference`, `message`, `inquiry_type`).
* Lead notification e-mail (only when SMTP is configured) contains the service and the customer's
  language, never the details.
* Mock lead triage recognises AI-operations wording in Bulgarian and English and suggests
  `ai_managed` with a next step (technical assessment of the AI system).

## Not implemented (by design, V1)

* No monitoring, evaluation, alerting, cost tracking or incident tooling runs for clients.
* No dashboard pretending to show live telemetry. Any future demo must use clearly marked synthetic
  data.
* No contracts, SLAs or prices are published. Commercial terms are agreed per client in writing.
