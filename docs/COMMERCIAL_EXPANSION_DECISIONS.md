# Commercial expansion — decisions

Decisions taken during the programme and decisions that still belong to the owner. A pending decision is never
treated as approved; the code uses the safest default and says so.

| ID | Phase | Decision | State | Default used meanwhile |
| --- | --- | --- | --- | --- |
| D-01 | 02 | Header layout with customer accounts on (BLOCKER-ACC-HEADER-01): one compact icon link to sign-in on desktop instead of a text link plus a "create account" button. Sign-up stays reachable from the sign-in page, the mobile menu and the footer | Implemented; the blocker is closed because the header fits. **The owner may still choose another layout** (for example moving the consultation button into a menu) | Compact sign-in icon (`AccountLinks`, variant `header`) |
| D-02 | 02 | Homepage hero keeps the approved calls to action ("Заявете консултация" / "Book a consultation", "Оценете AI готовността си"). Quote requests are offered per service in the new entry section and by the existing sticky quote bar | Taken in code; no approved copy was replaced | — |
| D-03 | 02 | "Configure a project" is **not** shown yet. It becomes a primary pathway in Phase 05, when the configurator exists and its flag is on | Deferred to Phase 05 | Quote request per service |
| D-04 | 04 | Unified BG/EN price schedule (`OWNER_DECISION_PRICE_SCHEDULE.md`) | Pending, owner | `ACTIVE_PRICE_SCHEDULE = "bg"`, one schedule for every language |
| D-05 | 11 | Verified mailbox and domain for transactional e-mail | Pending, owner | Mail provider disabled; templates only |
| D-06 | 07 | Meaning of a customer "accepting" a quotation (binding contract or expression of interest) | Pending, owner and lawyer | Wording "pending legal review"; no binding claim |
| D-07 | 10 | Upload policy (types, size, scanning, retention) | Pending, owner | Uploads disabled |
| D-08 | 13 | Billing on quotations, and Stripe sandbox keys | Pending, owner | Not started |
| D-09 | 03 | Indicative prices for the two smaller scopes, "Landing page" and "Starter online store". The price schedule has bands only for whole services | Pending, owner | The page says "Price in a written quote" for both; `lib/project-packages.test.ts` fails if a price appears without this decision |
| D-10 | 03 | Package names and scope wording (BG and EN) on `/proektni-paketi`. They were written from the approved service pages and contain no times, guarantees or SLA | Written; owner review welcome | As published in `content/{bg,en}/project-packages.ts` |
| D-11 | 04 | Tax treatment of published prices. Today: the company is not VAT registered, nothing is added, and the site says so | Fact recorded in code (`PRICE_TAX_TREATMENT`); **the accountant decides** what the amounts become on VAT registration | "not_vat_registered"; the public note and the legal texts must change together with the value |
| D-12 | 04 | Wording about what is binding. The pages say "the exact price is the one in the written quote", not that a quote is legally binding | Lawyer review with D-06 | Neutral wording |
| D-13 | 05 | Switching the project configurator on in production (`PROJECT_CONFIGURATOR_ENABLED`) | Pending, owner. Depends on D-04, D-09, D-10 and D-12 | Off |
| D-14 | 05 | The configurator sums the starting prices of the priced lines (one-time and monthly apart) and labels the sum "not a final price" | Taken in code; owner may prefer no sum at all | Sum shown with the label |
| D-15 | 05–06 | Cookie policy: describe the new browser storage (configurator answers in `sessionStorage`, the basket token in `localStorage`) | Pending, owner and lawyer. **BLOCKER-COM-STORAGE-01**: production refuses both flags until `COMMERCIAL_STORAGE_DISCLOSED` is set with the approved text | Flags off |
| D-16 | 06 | How long a draft request is kept: 30 days after the last change; a sent one 1 day | Taken in code (`QUOTE_BASKET_DAYS`); owner may change | 30 days / 1 day |
| D-17 | 06 | Attaching a quote request to a customer account (optional sign-in) | Deferred to Phase 09: accounts are off in production and the customer portal defines what a signed-in customer sees | Anonymous requests, as the contact and quote forms already work |
| D-18 | 06 | With the basket on, the configurator ends in "Add to the request" and no longer offers its own quote form | Taken in code; owner may prefer to keep both | One path |
| D-19 | 07 | Linking an accepted quotation to a customer project | Deferred to Phase 09 (customer projects and the customer portal do not exist yet; accounts are off in production). The quotation records who answered, when and which approved version | Nothing is created or moved on acceptance |
| D-20 | 07 | Who may publish a quotation to a client: administrators only (editors and viewers cannot) | Taken in code; owner may widen it | Administrator |
| D-21 | 07 | Quotations carry a validity date only when staff set one; the system never invents a validity or a guarantee | Taken in code | No date unless staff choose one |
| D-06 | 07 | (update) Wording and legal meaning of a client's answer. The page says the answer states the company's intention and does not replace a written agreement. **BLOCKER-COM-ACCEPT-01**: production refuses `QUOTATIONS_ENABLED` until the wording is approved | Pending, owner and lawyer | Non-binding wording; feature off |
