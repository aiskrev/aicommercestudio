# Interactive AI demonstrations (Phase 14)

Commercial expansion, Phase 14. Eight interactive **simulations** that show how an AI automation is designed: the visitor
picks an invented situation and the page walks it through six steps: trigger, input check, AI / rules, output check, human
approval, proposed business action. They are public pages of the demo centre (`/bg/demo-tsentar/<slug>` ↔
`/en/demo-centre/<slug>`) and need no sign-in and no flag. They are examples, not products: every page says so, in the
page header, in the form and in the result.

| Scenario | Slug (BG / EN) | What it shows |
| --- | --- | --- |
| Product description enhancement | `opisanie-na-produkt` / `product-description` | a draft only from available facts; missing facts stop it; publishing needs a person |
| Lead qualification | `kvalifikatsiya-na-zapitvane` / `lead-qualification` | points become hot, warm or cold: a suggestion; the first reply needs a person |
| Customer support routing | `nasochvane-kam-podkrepa` / `support-routing` | a queue; payments, accounts and upset customers are read by a person first; masking |
| Order workflow analysis | `analiz-na-poruchka` / `order-workflow` | the next step for an order; no change, no message to the customer |
| Inventory warning | `preduprezhdenie-za-nalichnost` / `inventory-warning` | level, direction of a supplier request (never a number), a draft only |
| CRM automation | `crm-avtomatizatsiya` / `crm-automation` | an event creates a task; without consent only an internal task |
| Quotation drafting | `chernova-na-oferta` / `quotation-drafting` | the sections of a draft; **no price, no guarantee**; vague scope asks questions first |
| Human approval before a business action | `odobrenie-ot-chovek` / `human-approval` | which actions need a person, by the platform's real policy |

## How it works

* **Deterministic and stateless.** `POST /api/public/demos/{scenario}/run` takes the chosen options and returns the same
  answer for the same input. Nothing is stored, no cookie is set, no lead is created (tests check it).
* **No AI provider is called.** The "AI / rules" step is a plain, documented rule set, labelled as a simulation. A demonstration
  is therefore free, reproducible, cannot fail with a provider and cannot leak anything to one. An AI provider could later
  add *wording* behind the same output schema; it would never change a decision (D-44).
* **Reuses the platform's approval policy.** Step 5 asks `app.ai.policy.evaluate` whether the proposed action type needs a
  person and at what risk: sending a message, changing a product, a price or an order and touching sensitive data need approval
  (critical for prices, orders and sensitive data); a plain draft does not. The demonstration cannot override it
  (`test_every_combination_is_valid_deterministic_and_follows_the_platform_policy` runs every combination).
* **Nothing is executed.** `executed` is always false. The last step is a *proposal*.
* **Simulated data only.** The choices are fixed lists; the server refuses any other field or option (422
  `fields_mismatch`, `option_not_allowed`).
* **Codes, not sentences.** The answer is machine-readable; the page translates every code into Bulgarian and English. The
  list of codes and the scenarios are shared files (`app/demos/codes.json`, `scenarios.json` and their web copies in
  `lib/`); a hash check in `scripts/test.ps1`, an API test and a web test keep them equal, and a web test fails if a code has
  no translation.

## The note is data, never an instruction

Each form has one optional free-text note (280 characters). It is validated as plain text (markup and secret-looking tokens
are refused, 422) and then only **inspected**: text that looks like an instruction (English or Bulgarian), a secret, a link
or a personal detail is *flagged* in the input check. It is never echoed, never stored and never changes a decision. The
tests send eleven different steering attempts to every scenario and require that every field of the answer except the
input-check step is identical to the answer without the note, and that an approval can never be talked away.

## Limits and failure behaviour

* Rate limit per address (`DEMO_RATE_LIMIT`, 30 per `DEMO_RATE_WINDOW_SECONDS`, 600) and a global one
  (`DEMO_GLOBAL_RATE_LIMIT`, 600); 429 with `Retry-After`; the page says so.
* A provider failure cannot happen (no provider); a test makes the provider factory raise and every scenario still runs.
* A scenario with too little input (missing product facts, a vague scope) is **blocked** in the input check and the later steps
  are shown as "not reached"; the page explains it.
* Empty state before the first run, and messages for a refused choice, a server error and no connection.
* Every result lists its limitations: simulated data, plain rules, nothing executed, not advice.

## Pages

Each scenario page has a heading, what it shows, what it is not, the form (radio groups in fieldsets, labelled, with a
visible focus and a target of at least 44 px), the result as an ordered list of six steps with a status badge each (a
vertical list on a phone, three columns on a wide screen), the risk and approval line, the limitations, and links on: the
related service page, the project packages where they fit and the contact form for that service. The demo centre lists all
eight with a "Simulation" badge. The pages are indexable, in the sitemap and in the site search, with the English address
at its own path.

## Tests

`apps/api/tests/test_demos.py` (about 50 tests): the list, the six steps and `executed: false` for every scenario, every
input combination (deterministic, valid shape, policy-consistent approval), the conclusions each scenario describes, invalid
input and options, the note (plain text, limit, steering attempts, secrets, links, personal details, approvals), provider
independence, rate limits, no storage and no cookie, no network or provider import, and the shared JSON files.
`apps/web/src/lib/demos.test.ts` (codes, options, slugs, no promises), `components/demo/demo.test.tsx` (the runner: empty,
result, English, errors, blocked) and `apps/web/e2e/tests/demos.spec.ts` (the list, a run, a steering note, a blocked
scenario, all pages in English, 360 px, axe, sitemap, no cookie).

## Not here

Real AI output (a provider), per-visitor saved results, customer data of any kind, direct changes to any external system,
and numbers about savings or return on investment. See D-44 and D-45 in
[COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md).
