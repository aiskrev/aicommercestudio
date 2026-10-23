# AI Managed Services — internal pricing guidance

> **INTERNAL. NOT FOR PUBLICATION.** All numbers below are **hypothetical working assumptions**
> for preparing individual quotes. They are not market data, not current prices and not
> commitments. The website shows only “По индивидуална оферта / Custom quote”. Validate every
> assumption (time actually spent, provider costs, competitor offers, tax treatment) before using
> it in a real offer.

## Principles

1. **Quote per system, not per package name.** The package defines the *type* of work; the price
   depends on the number of agents/workflows, integrations, available instrumentation,
   data sensitivity and change frequency.
2. **Bounded effort.** Every monthly plan has an agreed number of hours or tasks. Work beyond it is
   a change request. Nothing is “unlimited”.
3. **Third-party costs are separate**: model provider usage, hosting, observability tools,
   licences. They are paid by the client directly or re-invoiced at cost (agreed in writing).
4. **No SLA by default.** Response targets are offered only when staffing allows them and are
   written into the contract with remedies; otherwise the plan states “best effort during business
   hours”.
5. **Assessment first.** A paid or free initial technical assessment (decision per client) defines
   the scope and the instrumentation needed before any monthly fee is quoted.

## Cost drivers checklist

* agents / workflows in scope; channels (web chat, e-mail, messaging, internal tools)
* existing logging and tracing; whether we must add instrumentation
* evaluation set: exists / must be built; how often it must be re-run
* integrations touched (CRM, ERP, store, helpdesk) and their change rate
* data sensitivity (personal data, health, finance) → security and DPA work
* client-side change frequency (prompt/model/tool changes per month)
* reporting cadence and meeting time

## Hypothetical scenarios (illustrative only)

The figures are placeholders to make the structure concrete. Replace them with your own estimates.

| Scenario | Scope | Assumed monthly effort | Hypothetical fee range | Separate costs |
| --- | --- | --- | --- | --- |
| A — “AI Monitor”-type | 1 support assistant, vendor platform, logs available | 4–6 h | €400–700 / month | model usage, platform licence |
| B — “AI Care”-type | 2–3 agents, RAG over a knowledge base, CRM read access | 12–20 h | €1,200–2,200 / month | model usage, vector DB, hosting |
| C — “AI Optimize”-type | 5+ workflows, writes to business systems, custom evals | 30–50 h | €3,000–5,500 / month | model usage, observability tool, hosting |
| One-off assessment | architecture review, instrumentation plan, risk list | 8–16 h | €800–1,800 one-off | — |
| Change request | new capability, new integration | estimated per request | hourly rate × estimate | — |

Assumed internal hourly rate for the arithmetic above: **€90–110 (hypothetical)**.

## What must never appear in an offer without a decision

* unlimited incidents, unlimited changes or unlimited usage;
* 24/7 support or guaranteed response/uptime targets;
* guaranteed cost savings or quality levels;
* model-provider costs bundled silently into a fixed fee.

## Review

Revisit this file after the first three real engagements: compare estimated vs actual hours and
update the effort ranges. Record the date and the evidence of every change.
