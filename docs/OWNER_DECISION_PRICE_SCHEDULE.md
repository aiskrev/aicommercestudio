# OWNER DECISION RECORD — one price list for Bulgarian and English pages

**Decision: NOT TAKEN.** This page records the facts for the owner. Nothing here selects an option.
`PRICE_SCHEDULE_OWNER_APPROVAL = "pending"` in `apps/web/src/lib/prices.ts`; the tests keep it pending until this page records a decision.

## The question

Should the current Bulgarian public price schedule become the single public price schedule shown on both the Bulgarian
and the English pages? **Yes / No** (if No: which alternative, and on what stated basis).

## Effective behaviour after a merge of the compliance branch, as it stands

* Both languages show the **Bulgarian** schedule. The language of a page, the browser, the IP address and the country
  do not change any amount (`ACTIVE_PRICE_SCHEDULE = "bg"`; `marketFor()` ignores the locale; tests enforce it).
* **No Bulgarian price changes.** **Every English amount goes down** to the Bulgarian amount (about 15–17 %).
* The amounts stay indicative; the written quote and the billing offers in the database (`billing_offers`, not the
  public page) are what a customer pays. The billing offers were already one price for every language.
* The previous "EU" schedule (+20 % −10 % = +8 % on the baseline) is kept in the code but shown nowhere.

## Amounts (EUR, generated from `lib/prices.ts`)

| Offer | Unit | Bulgarian price (shown in BG and EN after merge): from / typical | English price before: from / typical | Change for English readers (from; typical upper end) |
| --- | --- | --- | --- | --- |
| Service: business_websites | per project | 810 / 1 350–2 250 € | 970 / 1 600–2 700 € | −160 € (-16.5 %); −450 € (-16.7 %) |
| Service: store_development | per project | 1 100 / 2 250–3 600 € | 1 300 / 2 700–4 300 € | −200 € (-15.4 %); −700 € (-16.3 %) |
| Service: portals_web_apps | per project | 3 600 / 7 200–13 500 € | 4 300 / 8 650–16 200 € | −700 € (-16.3 %); −2 700 € (-16.7 %) |
| Service: payments_subscriptions | per project | 450 / 720–6 300 € | 540 / 860–7 550 € | −90 € (-16.7 %); −1 250 € (-16.6 %) |
| Service: security_performance | per project | 270 / 450–810 € | 320 / 540–970 € | −50 € (-15.6 %); −160 € (-16.5 %) |
| Service: maintenance | per month | 80 / 160–320 € | 95 / 190–380 € | −15 € (-15.8 %); −60 € (-15.8 %) |
| Service: seo | per month | 180 / 270–450 € | 220 / 320–540 € | −40 € (-18.2 %); −90 € (-16.7 %) |
| Service: analytics | per project | 270 / 450–1 350 € | 320 / 540–1 600 € | −50 € (-15.6 %); −250 € (-15.6 %) |
| Service: integrations | per project | 1 350 / 2 700–7 200 € | 1 600 / 3 250–8 650 € | −250 € (-15.6 %); −1 450 € (-16.8 %) |
| Service: ai_agents | per project | 2 250 / 4 500–9 000 € | 2 700 / 5 400–10 800 € | −450 € (-16.7 %); −1 800 € (-16.7 %) |
| Service: automation | per project | 720 / 1 350–3 600 € | 860 / 1 600–4 300 € | −140 € (-16.3 %); −700 € (-16.3 %) |
| Service: ai_tools | per project | 810 / 1 350–10 800 € | 970 / 1 600–12 950 € | −160 € (-16.5 %); −2 150 € (-16.6 %) |
| Service: audit | per project | 810 / 1 800–3 150 € | 970 / 2 150–3 800 € | −160 € (-16.5 %); −650 € (-17.1 %) |
| Service: ai_managed | per month | 230 / 320–2 700 € | 270 / 380–3 250 € | −40 € (-14.8 %); −550 € (-16.9 %) |
| Service: integration_care | per month | 140 / 230–410 € | 160 / 270–490 € | −20 € (-12.5 %); −80 € (-16.3 %) |
| Workshop: ai_strategy_discovery | per project | 720 / 1 100–1 600 € | 860 / 1 300–1 950 € | −140 € (-16.3 %); −350 € (-17.9 %) |
| Workshop: ai_readiness_mapping | per project | 1 600 / 2 250–3 150 € | 1 950 / 2 700–3 800 € | −350 € (-17.9 %); −650 € (-17.1 %) |
| Workshop: agent_architecture | per project | 1 800 / 2 700–3 600 € | 2 150 / 3 250–4 300 € | −350 € (-16.3 %); −700 € (-16.3 %) |
| Workshop: landing_zone_assessment | per project | 1 800 / 2 700–4 050 € | 2 150 / 3 250–4 850 € | −350 € (-16.3 %); −800 € (-16.5 %) |
| Workshop: kubernetes_review | per project | 1 350 / 2 250–3 600 € | 1 600 / 2 700–4 300 € | −250 € (-15.6 %); −700 € (-16.3 %) |
| Workshop: devops_gitops_assessment | per project | 1 350 / 2 250–3 600 € | 1 600 / 2 700–4 300 € | −250 € (-15.6 %); −700 € (-16.3 %) |
| Workshop: observability_sre | per project | 1 600 / 2 250–3 600 € | 1 950 / 2 700–4 300 € | −350 € (-17.9 %); −700 € (-16.3 %) |
| Workshop: ecommerce_integration_discovery | per project | 900 / 1 350–2 700 € | 1 100 / 1 600–3 250 € | −200 € (-18.2 %); −550 € (-16.9 %) |
| Workshop: rag_data_readiness | per project | 1 600 / 2 250–3 150 € | 1 950 / 2 700–3 800 € | −350 € (-17.9 %); −650 € (-17.1 %) |
| Workshop: responsible_ai_review | per project | 810 / 1 350–2 700 € | 970 / 1 600–3 250 € | −160 € (-16.5 %); −550 € (-16.9 %) |
| Care plan: website | per month | 80 / 160–320 € | 95 / 190–380 € | −15 € (-15.8 %); −60 € (-15.8 %) |
| Care plan: commerce | per month | 80 / 160–320 € | 95 / 190–380 € | −15 € (-15.8 %); −60 € (-15.8 %) |
| Care plan: automation | per month | 140 / 230–410 € | 160 / 270–490 € | −20 € (-12.5 %); −80 € (-16.3 %) |
| Care plan: cloud | per month | 230 / 320–450 € | 270 / 380–540 € | −40 € (-14.8 %); −90 € (-16.7 %) |
| Care plan: security | per month | 80 / 160–320 € | 95 / 190–380 € | −15 € (-15.8 %); −60 € (-15.8 %) |
| AI Managed: essential | per month | 230 / 320–450 € | 270 / 380–540 € | −40 € (-14.8 %); −90 € (-16.7 %) |
| AI Managed: managed | per month | 630 / 810–1 250 € | 760 / 970–1 500 € | −130 € (-17.1 %); −250 € (-16.7 %) |
| AI Managed: advanced | per month | 1 600 / 2 000–2 700 € | 1 950 / 2 400–3 250 € | −350 € (-17.9 %); −550 € (-16.9 %) |

## Review status

| Reviewer | Question | Status |
| --- | --- | --- |
| Owner | Approve one list, or choose a different basis | **PENDING** |
| Lawyer | Is a price that depends on the page language caught by Regulation (EU) 2018/302 Art. 4? Is a separate, openly stated price list by the contracting party's country acceptable? (docs/LEGAL_SOURCES.md, section 2) | **PENDING — NOT VERIFIED** |
| Accountant | VAT status and whether "final prices, not VAT registered" can stay on the pages; effect of cross-border B2B/B2C sales | **PENDING — NOT VERIFIED** |

## Options the owner may choose from (none is recommended here)

1. Keep one list for everyone (the current branch behaviour).
2. Keep one list but raise it (a commercial decision; update `lib/prices.ts` baselines and this record).
3. Separate, openly stated lists by the **contracting party's country**, only after the lawyer confirms the basis; the
   page language must still never select the price.

## To record the decision

Write the date, the option, who decided, and the lawyer's and accountant's answers in this file; set
`PRICE_SCHEDULE_OWNER_APPROVAL` to `"approved"` and update `lib/prices.test.ts` in the same change.
