# Project configurator

`/bg/konfigurator` ↔ `/en/configurator`. A multi-step form that turns a few enumerated answers into a **guide** for a
conversation: the fitting package, the published indicative prices that apply, what needs an assessment, assumptions,
exclusions and why a person must review it. It is not a quote, not an offer and not a commitment, and every screen
says so. Commercial expansion, Phase 05.

**Off by default.** `PROJECT_CONFIGURATOR_ENABLED=false` (API and web). While off, the page and the three API
routes answer 404, no entry point is drawn and the sitemap does not list the page.

## How it works

| Step | What happens | Where |
| --- | --- | --- |
| 1–6 | The visitor answers: project type, scope, features, design, operations, budget and timing. Every answer is an enumeration or a boolean | `components/configurator/ProjectConfigurator.tsx`, vocabulary in `lib/configurator.ts` |
| Draft | The answers (never contact details) are kept in the tab's `sessionStorage` and removed after a quote request | browser only |
| 7 Review | `POST /api/public/configurator/review` with the answers. The server validates them, applies the rules and returns the review. It stores nothing | `app/configurator/model.py`, `app/routers/configurator.py` |
| Quote request | Optional. Contact fields, goals, special requirements, privacy acknowledgement, separate marketing consent. Creates one lead per `submission_id` | `app/configurator/service.py` |
| Staff | The lead (`inquiry_type = quote`, `source = project_configurator`) shows the stored answers and the server's review in the admin | `components/admin/LeadDetail.tsx` |

Steps are history entries (`#scope`, `#features`, …): the browser's back and forward buttons move between them, the
heading of a new step takes focus, and a reload restores the answers.

## One model file, one evaluator

`apps/web/src/lib/configurator-model.json` is copied byte for byte to `apps/api/app/configurator/model.json`
(`scripts/test.ps1` compares them). It holds the option lists, the five packages, which features are unavailable per
project type, which are included per package, which are priced by an existing service, and every key a review can
contain. The web uses it to draw the form and to label the result; **the evaluation exists only on the server**.
`version` (`2026-11.1`) is sent with every request: a stale browser bundle is refused with 422 `configurator_model`.

Packages are the ones of `/proektni-paketi` (`lib/project-packages.ts`); a web test keeps the two equal.

## Rules

Unsupported combinations are refused with 422 `unsupported_combination` and the rule name:

| Rule | Meaning |
| --- | --- |
| `landing_single_page` | A landing page is one page |
| `products_need_store` | Products exist only for an online store or a custom application |
| `store_needs_products` | An online store has at least one product band |
| `store_migration_needs_store` | Only an online store migrates a store |
| `dashboard_needs_accounts` | A user dashboard needs customer accounts |
| `feature_not_for_type:<feature>` | The feature does not apply to the project type |

Recommendation: landing page → `landing_page`; business website → `business_website`; custom application →
`custom_web_app` (always delivered in stages, never presented as a fixed-price commodity); online store →
`store_setup` only when the catalogue is up to 50 products, there is no migration, the design is standard, there are
fewer than three languages and none of the features in `store_complete_triggers` is chosen, otherwise `store_complete`.

## Prices

* Amounts come from the published schedule (`app/pricing.py`, docs/PRICING.md). **No request field carries an amount**:
  unknown fields are refused (`extra="forbid"`), and nothing the browser displays is stored.
* A line has the band of its service or care plan, or `null` = **requires assessment**. The landing page and the
  starter store have no separately approved price (decision D-09), so their package line is never priced.
* A feature is either included in the package, priced by an existing service (one line per service, even when
  several features lead to it) or listed as unpriced. Scope and design choices that change the price but have no
  published amount (extra languages, redesign, migration of content, large site or catalogue, new branding, bespoke
  design, accessibility requirements) are listed as unpriced.
* Totals are the sums of the **starting** prices of the priced lines, one-time and monthly kept apart, labelled as
  not a final price. Typical ranges are never added up.
* The review states `binding: false`, the schedule version, the owner approval state (`pending` today) and the tax
  treatment. Language, country and address play no part.
* Hosting, licences and AI model usage are exclusions, not unpriced requirements.

## Human review

`human_review.required` is always true. Reasons: `indicative_only` (always), `custom_application`, `migration`,
`integrations`, `ai_assistant`, `bespoke_design`, `new_branding`, `large_scope`, `asap_timeline`,
`budget_below_starting_price`, `unpriced_requirements`.

## Security and privacy

* Review requests contain no personal data and are not stored. Logs carry enumerations and counts only.
* Rate limits: `CONFIGURATOR_REVIEW_RATE_LIMIT` per address and `CONFIGURATOR_GLOBAL_RATE_LIMIT` per
  `CONFIGURATOR_RATE_WINDOW_SECONDS` for reviews; the contact-form limits for quote requests.
* Quote request: form token, honeypot, link and secret checks, length limits (goals and special requirements 600
  characters each), the privacy acknowledgement and a separate, unticked marketing consent, as on the contact form.
* Duplicate submissions: the browser creates one `submission_id` per review. A transaction-scoped advisory lock and a
  lookup make a repeated or simultaneous request return the first lead (HTTP 200) without a second lead or a second
  notification.
* No database migration: the lead uses the existing `leads` table (`service_details` JSONB).

## Entry points

With the flag on, "Configure a project" appears in the homepage section "What do you want to build?" and on the
packages page (`components/configurator/ConfiguratorEntry.tsx` asks `/api/configurator-flag`, because those pages
are prerendered).

## Tests

| Suite | What |
| --- | --- |
| `apps/api/tests/test_configurator.py` | flag off = 404; model file against the lead enums and the schedule; recommendations; priced, included and unpriced lines; unsupported combinations; determinism; amount tampering; invalid, missing and stale requests; rate limit; lead creation; duplicate and simultaneous submissions; spam guards; the admin view; no dependence on language or country |
| `apps/web/src/lib/configurator.test.ts` | model = packages page; labels for every option and every result key in BG and EN; no amount in the texts; draft normalisation; step requirements |
| `apps/web/src/components/configurator/configurator.test.tsx` | step validation, options per project type, the request body (answers only), the review, "requires assessment", unsupported combinations, quote form validation, one submission on a double click, no contact details in storage, reload and back button, the entry link |
| `apps/web/e2e/tests/configurator.spec.ts` | default stack: nothing reachable. Commercial stack (`scripts/test.ps1 -Suite commercial`): BG and EN flows, the amount equals the pricing page, quote request, back/forward/reload, keyboard, axe on every state, 360–1440 px, entry points, API tampering and duplicate submission |

## Switching it on

Set `PROJECT_CONFIGURATOR_ENABLED=true` for the API and the web. In production the API refuses to start with it until
**BLOCKER-COM-STORAGE-01** is closed: the cookie policy must first describe the configurator's session storage
(`app/release_gates.py`, decision D-15). With `QUOTE_BASKET_ENABLED` also on, the review ends in "Add to the request"
instead of the quote form ([QUOTE_BASKET.md](QUOTE_BASKET.md)). Before switching on, the owner should also look at: the package
wording (D-10), the two packages without a price (D-09), the approval of the price schedule (D-04) and the wording
about what a guide is (D-12). Nothing in the configurator needs a new migration, a payment provider or outgoing mail
beyond the existing new-lead notification.
