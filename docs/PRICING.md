# Published prices

Decided by the owner on 2026-11-10. Until then the site showed "after an assessment and an individual
quote" everywhere.

## The rule

* The baseline is the recommendation of the owner's pricing report of 2026-11-10 (kept outside this
  public repository): for each offer, the lowest sensible scope ("from") and the typical range.
* Two schedules exist in `lib/prices.ts`: **`bg`**, the baseline **10 % lower** (`BG_FACTOR = 0.9`), and **`eu`**,
  the report's EU uplift of +20 % (the middle of its 15–25 %) and then the same 10 % lower (`EU_FACTOR = 1.08`).
* **The language of a page does not choose the price** (changed 2026-11-10, legal-compliance remediation).
  `ACTIVE_PRICE_SCHEDULE = "bg"` is shown in every language, so `/bg/…` and `/en/…` display the same amounts in
  euro. `marketFor(locale)` ignores the locale; `lib/prices.test.ts` fails if the two languages ever show different
  amounts. The `eu` schedule is kept but shown nowhere.
* Rounded to 5 below 100 €, 10 below 1 000 € and 50 above.
* The prices are **indicative and final**: the company is not VAT registered, so nothing is added and the
  site never says "+ VAT". Hosting, licences and AI model usage are not included. The exact price is always
  set in a written quote. The terms of use already say that published prices are not binding offers.

## Where they appear

| Page | What | Source |
| --- | --- | --- |
| `/bg/uslugi/<service>` · `/en/services/<service>` | "from" price, typical range and the note | `SERVICE_PRICES` |
| `/bg/rabotni-sreshti` and each workshop | "from" on every card; "from" and typical range on the page | `WORKSHOP_PRICES` |
| `/bg/paketi` · `/en/care-plans` | per plan, per month and per system | `CARE_PLAN_PRICES` |
| `/bg/uslugi/ai-managed-services` and the home page | per level, per month and per system | `AI_MANAGED_PRICES` |
| The home page, section "What do you want to build?" | "from" and typical range of five services, labelled "indicative, not a quote" | `SERVICE_PRICES` |
| `/bg/proektni-paketi` · `/en/project-packages` | the band of the package's service for three packages; "price in a written quote" for the landing page and the starter store, which have no separately approved price (`lib/project-packages.ts`); the two care plans | `SERVICE_PRICES`, `CARE_PLAN_PRICES` |
| `/bg/tseni` · `/en/pricing` | every band, grouped by one-time and monthly | all four tables |

Everything comes from `apps/web/src/lib/prices.ts`. To change a price, change its baseline row or a factor
there; `lib/prices.test.ts` checks coverage, ordering, rounding and the rule. Included hours and response
times of the care plans are still not published (`lib/care-plans.ts`). No price is put in structured data
(JSON-LD `offers`). The AI Advisor Workspace plans are priced separately (`plan_prices`, docs/ADVISOR_WORKSPACE.md),
once billing is released.

Rows without a direct baseline in the report: website and security care follow store maintenance, cloud and
platform care follows the Essential level.

## Language no longer sets the price (2026-11-10)

Before: `marketFor("en")` returned the `eu` schedule, so an English page showed 20 % more than the Bulgarian
page for the same service (for example store development: from 1 100 € on `/bg` and 1 300 € on `/en`). A
visitor could open either language from anywhere, so the price depended on the language they happened to read.
That is a risk under Regulation (EU) 2018/302 on unjustified geo-blocking (it is aimed at differences by
nationality, residence or place of establishment; whether a language-based difference falls under it needs a
lawyer) and under general consumer-law rules on price information.

After: one schedule, the Bulgarian one, in every language (store development from 1 100 € on both). This is the
conservative default and it **lowers** the English prices; nobody is charged more than before.

**Owner approval: pending.** `PRICE_SCHEDULE_OWNER_APPROVAL` in `lib/prices.ts` is `"pending"`. The owner decides
one of: (a) keep one price list for everyone (current default); (b) one price list by the *contracting party's
country* (for example EU contract partners other than Bulgaria), stated openly with the criteria, after a lawyer
confirms it is permitted; (c) raise the single list. When decided, record the date and the choice here, set the
constant to `"approved"` and update `lib/prices.test.ts`. The site must not show different amounts by language,
browser, IP address or country until then.

### Exact amounts: the Bulgarian list now shown everywhere, and the English list that was shown before

Generated from `lib/prices.ts` on 2026-11-10 (amounts in euro, rounded as the module rounds). The Bulgarian column is what both languages show now; the English column is what `/en` showed before. No price was changed for Bulgarian pages; every English amount went down.

| Offer | Unit | BG (now shown in BG and EN): from / typical | EN before this change: from / typical | Difference in the typical range upper end |
| --- | --- | --- | --- | --- |
| service: business_websites | project | 810 / 1 350–2 250 € | 970 / 1 600–2 700 € | +450 € (EN was higher) |
| service: store_development | project | 1 100 / 2 250–3 600 € | 1 300 / 2 700–4 300 € | +700 € (EN was higher) |
| service: portals_web_apps | project | 3 600 / 7 200–13 500 € | 4 300 / 8 650–16 200 € | +2 700 € (EN was higher) |
| service: payments_subscriptions | project | 450 / 720–6 300 € | 540 / 860–7 550 € | +1 250 € (EN was higher) |
| service: security_performance | project | 270 / 450–810 € | 320 / 540–970 € | +160 € (EN was higher) |
| service: maintenance | month | 80 / 160–320 € | 95 / 190–380 € | +60 € (EN was higher) |
| service: seo | month | 180 / 270–450 € | 220 / 320–540 € | +90 € (EN was higher) |
| service: analytics | project | 270 / 450–1 350 € | 320 / 540–1 600 € | +250 € (EN was higher) |
| service: integrations | project | 1 350 / 2 700–7 200 € | 1 600 / 3 250–8 650 € | +1 450 € (EN was higher) |
| service: ai_agents | project | 2 250 / 4 500–9 000 € | 2 700 / 5 400–10 800 € | +1 800 € (EN was higher) |
| service: automation | project | 720 / 1 350–3 600 € | 860 / 1 600–4 300 € | +700 € (EN was higher) |
| service: ai_tools | project | 810 / 1 350–10 800 € | 970 / 1 600–12 950 € | +2 150 € (EN was higher) |
| service: audit | project | 810 / 1 800–3 150 € | 970 / 2 150–3 800 € | +650 € (EN was higher) |
| service: ai_managed | month | 230 / 320–2 700 € | 270 / 380–3 250 € | +550 € (EN was higher) |
| service: integration_care | month | 140 / 230–410 € | 160 / 270–490 € | +80 € (EN was higher) |
| workshop: ai_strategy_discovery | project | 720 / 1 100–1 600 € | 860 / 1 300–1 950 € | +350 € (EN was higher) |
| workshop: ai_readiness_mapping | project | 1 600 / 2 250–3 150 € | 1 950 / 2 700–3 800 € | +650 € (EN was higher) |
| workshop: agent_architecture | project | 1 800 / 2 700–3 600 € | 2 150 / 3 250–4 300 € | +700 € (EN was higher) |
| workshop: landing_zone_assessment | project | 1 800 / 2 700–4 050 € | 2 150 / 3 250–4 850 € | +800 € (EN was higher) |
| workshop: kubernetes_review | project | 1 350 / 2 250–3 600 € | 1 600 / 2 700–4 300 € | +700 € (EN was higher) |
| workshop: devops_gitops_assessment | project | 1 350 / 2 250–3 600 € | 1 600 / 2 700–4 300 € | +700 € (EN was higher) |
| workshop: observability_sre | project | 1 600 / 2 250–3 600 € | 1 950 / 2 700–4 300 € | +700 € (EN was higher) |
| workshop: ecommerce_integration_discovery | project | 900 / 1 350–2 700 € | 1 100 / 1 600–3 250 € | +550 € (EN was higher) |
| workshop: rag_data_readiness | project | 1 600 / 2 250–3 150 € | 1 950 / 2 700–3 800 € | +650 € (EN was higher) |
| workshop: responsible_ai_review | project | 810 / 1 350–2 700 € | 970 / 1 600–3 250 € | +550 € (EN was higher) |
| care plan: website | month | 80 / 160–320 € | 95 / 190–380 € | +60 € (EN was higher) |
| care plan: commerce | month | 80 / 160–320 € | 95 / 190–380 € | +60 € (EN was higher) |
| care plan: automation | month | 140 / 230–410 € | 160 / 270–490 € | +80 € (EN was higher) |
| care plan: cloud | month | 230 / 320–450 € | 270 / 380–540 € | +90 € (EN was higher) |
| care plan: security | month | 80 / 160–320 € | 95 / 190–380 € | +60 € (EN was higher) |
| AI managed: essential | month | 230 / 320–450 € | 270 / 380–540 € | +90 € (EN was higher) |
| AI managed: managed | month | 630 / 810–1 250 € | 760 / 970–1 500 € | +250 € (EN was higher) |
| AI managed: advanced | month | 1 600 / 2 000–2 700 € | 1 950 / 2 400–3 250 € | +550 € (EN was higher) |

## Open checks

* **Accountant:** VAT registration may be required before the turnover threshold, for services bought from
  abroad (Art. 97b ЗДДС) or sold to businesses in other EU countries (Art. 97a). Prices would then change.
* **Lawyer:** a consumer may open either language version; check that showing different prices per language
  (market) is acceptable under the EU geo-blocking rules for the B2C cases.
* Review the prices after the first 5–10 quotes (won against lost).

## One schedule for the pages and the API (2026-11-11, commercial expansion Phase 04)

`lib/prices.ts` is still the only place where an amount is written. Added around it:

* **A schedule document.** `lib/price-schedule.ts` renders the active schedule as one JSON document
  (`lib/price-schedule.json`): version, currency, active schedule, owner approval, tax treatment, `binding: false`,
  the excluded third-party costs and every band in four groups (`service`, `workshop`, `care_plan`, `ai_managed`).
  `lib/price-schedule.test.ts` fails when the file and `prices.ts` differ; regenerate with `UPDATE_PRICE_SCHEDULE=1`.
* **The API reads a copy.** `apps/api/app/price_schedule.json` is a byte-for-byte copy, loaded and validated by
  `app/pricing.py` (`schedule()`, `band(group, key)`, `is_owner_approved()`). `scripts/test.ps1` fails when the two
  files differ. No function takes a language, country or address. Nothing here is a checkout amount: Stripe prices
  stay in `billing_offers`. The module has no route yet; the project configurator (Phase 05) is its first user.
* **Version.** `PRICE_SCHEDULE_VERSION` (now `2026-11-10.1`) changes with any amount, factor, active schedule,
  approval or tax treatment, so a stored estimate can name the schedule it came from.
* **Tax treatment is a stated fact, not an assumption.** `PRICE_TAX_TREATMENT = "not_vat_registered"`. On VAT
  registration this value, `dict.prices.note` and the legal texts change together (the test ties the note to the
  value), and the accountant decides whether published amounts become net or gross.
* **A pricing page.** `/bg/tseni` ↔ `/en/pricing` lists every band grouped by how it is charged: one-time projects,
  monthly services, AI Managed Services levels, care plans, workshops. It shows the general note, what is never
  included (hosting and domain, licences, usage-billed services such as AI models, payment and courier fees,
  integrations outside the described scope) and how the exact price is set. It adds no price of its own.

To change a price: edit the baseline in `lib/prices.ts`, bump `PRICE_SCHEDULE_VERSION`, run the web tests with
`UPDATE_PRICE_SCHEDULE=1`, copy `lib/price-schedule.json` to `apps/api/app/price_schedule.json`, and update the
table above. Owner approval of the schedule is still pending (`PRICE_SCHEDULE_OWNER_APPROVAL`).
