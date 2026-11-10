# Published prices

Decided by the owner on 2026-11-10. Until then the site showed "after an assessment and an individual
quote" everywhere.

## The rule

* The baseline is the recommendation of the owner's pricing report of 2026-11-10 (kept outside this
  public repository): for each offer, the lowest sensible scope ("from") and the typical range.
* **Bulgarian pages** (`/bg`, clients in Bulgaria): the baseline **10 % lower** (`BG_FACTOR = 0.9`).
* **English pages** (`/en`, clients in the EU and elsewhere): the report's EU uplift of +20 % (the middle of
  its 15–25 %), then the same 10 % lower (`EU_FACTOR = 1.08`).
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

Everything comes from `apps/web/src/lib/prices.ts`. To change a price, change its baseline row or a factor
there; `lib/prices.test.ts` checks coverage, ordering, rounding and the rule. Included hours and response
times of the care plans are still not published (`lib/care-plans.ts`). No price is put in structured data
(JSON-LD `offers`). The AI Advisor Workspace plans are priced separately (`plan_prices`, docs/ADVISOR_WORKSPACE.md),
once billing is released.

Rows without a direct baseline in the report: website and security care follow store maintenance, cloud and
platform care follows the Essential level.

## Open checks

* **Accountant:** VAT registration may be required before the turnover threshold, for services bought from
  abroad (Art. 97b ЗДДС) or sold to businesses in other EU countries (Art. 97a). Prices would then change.
* **Lawyer:** a consumer may open either language version; check that showing different prices per language
  (market) is acceptable under the EU geo-blocking rules for the B2C cases.
* Review the prices after the first 5–10 quotes (won against lost).
