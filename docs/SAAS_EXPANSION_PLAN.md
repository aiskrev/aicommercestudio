# SaaS expansion plan: accounts, plans, usage and billing

Status: **design only, 2026-11-04.** Nothing here is built. No production setting, DNS record, domain,
mailbox, user or payment was changed to write it. No real price is proposed anywhere in this document.

Scope: extend A.I. Commerce Studio from engineering services plus free public tools to engineering
services plus SaaS tools with customer accounts, free and paid access, subscriptions, invoices and
online payments.

Evidence rule: statements below were checked against the code, the 15 migrations and the live site on
2026-11-04. Older baseline documents were used only as pointers. Where a document and the code differ,
the code wins and the difference is listed in section 1.3.

## 1. Status matrix

### 1.1 Capabilities

| Capability | In the code | Publicly reachable | Off / limited | Planned |
| --- | --- | --- | --- | --- |
| Public site, BG and EN | yes | yes | | |
| Contact and quote forms, leads | yes (`routers/public.py`, `leads`) | yes | | |
| AI Advisor | yes (`routers/advisor.py`) | yes | demo: `AI_PROVIDER=mock` | real provider needs owner approval |
| Readiness, ROI, finder, AI team, solution builder | yes | yes, anonymous | | |
| Engineering assessments | yes (`routers/assessments.py`) | yes, anonymous | preview definitions off (`ASSESSMENTS_PREVIEW_ENABLED=false`) | |
| Saved results | yes: hashed secret token, expiry (`assessment_results`, `team_configurations`) | yes, by link | not tied to any account | link to a workspace (P4) |
| PDF reports | yes (`app/reports`, reportlab) | yes | | entitled report variants (P4) |
| Staff admin | yes (`admin_users`, `admin_sessions`, roles admin, editor, viewer) | sign-in page | TOTP required in production | |
| Service catalogue | yes (`app/catalogue`, draft → publish, releases) | public reads | no prices by design | stays free of prices |
| Opportunity and proposal workflow | yes (`lead_opportunities`, `lead_proposals`) | staff only | no automated sending | |
| AI operations console | yes (`app/ops`, 54 routes, `OPS_MODULES`) | staff only: `/api/ops/*` answers 401 | internal; no customer data connected by this plan | |
| Client portal, read-only | yes (`routers/portal.py`, `portal_users`, `/portal`) | API answers 404 | **off**: `CLIENT_PORTAL_ENABLED=false`, prerequisites open | not used as a shortcut (section 5) |
| Outbound e-mail | partial: lead notification only (`notifications.py`, SMTP) | no | SMTP not configured in production | transactional e-mail (P1) |
| Inbound mail | `contact@ai-commercestudio.com`, Cloudflare Email Routing | yes | receive only | |
| Self-service registration | no | | | P2 |
| Customer accounts and workspaces | no | | | P2, P3 |
| Products, plans, entitlements | no | | | P4 |
| Usage metering | no (per-IP rate limits and `ADVISOR_AI_DAILY_LIMIT` only) | | | P5 |
| Checkout, subscriptions, invoices | no | | | P6, P7 |

### 1.2 Production settings that matter here (template in `infra/deploy/production.env.example`)

`APP_ENV=production`, `ADMIN_MFA_REQUIRED=true`, `AI_PROVIDER=mock`, empty `SMTP_HOST`,
`CLIENT_PORTAL_ENABLED` unset (default false). One API instance on a 4 GB server. Daily backups stay on
the server: **there is no off-site copy yet.**

### 1.3 Differences found between documents and reality

* `/portal` answers **200** on the live site: the web shell is served while `/api/portal/*` answers 404.
  It is not a data exposure, but the page should not look like a product. Tracked as task P0-5.
* `CLIENT_PORTAL.md` and `AI_OPERATIONS_PORTAL.md` still describe the deployment as prepared; the site is
  now live. Their prerequisites remain valid and open.
* `SERVICE_CATALOGUE_ARCHITECTURE.md` says **no prices**. That stays true for the catalogue. The new
  requirement is met in a separate module (ADR-54), not by adding prices to catalogue tables.
* ADR-46 (no automated e-mail without an approved integration) must be replaced for P1, not bypassed.
* The Bulgarian trade register shows the company is **not registered for VAT**. The billing design must
  not assume VAT handling that does not apply yet, or that it will stay this way (section 8, D-4).

## 2. Map of what exists

| Area | Today | Reuse for SaaS | Do not reuse |
| --- | --- | --- | --- |
| Staff identity | `admin_users`, `admin_sessions` (token hashes), lockout, roles, TOTP (`services/admin_mfa.py`) | password hashing, session pattern, lockout, TOTP | the tables: customers are never staff |
| Client identity | `portal_users`, `portal_sessions`, `portal_tokens`, invitation only, password + mandatory TOTP, one organisation per user | token and recovery flow patterns | the identity itself (section 5) |
| Anonymous access | hashed secret link per saved result | claim a result into a workspace | |
| Tenancy | `ops_organizations`, `ops_workspaces`, `ops_memberships` (`user_id` → `admin_users`) | RLS technique in `app/ops/rls.py`: `SET LOCAL ROLE acs_app_runtime` plus transaction-local settings | the tables: they model operations clients, and memberships point at staff |
| Roles | `AdminRole`, `OpsRole`, matrix in `ops/rbac.py`, routes declare permissions | permission-matrix approach and its completeness test | |
| E-mail | one SMTP function, failures swallowed, no queue, no templates | | as a base for verification mail |
| Reports | typed document → PDF and HTML (`app/reports`) | invoice PDF and entitled reports | |
| Catalogue | domains, families, services, `ToolKey` references, immutable releases | link a product to a `ToolKey` | prices in catalogue tables |
| Audit | `audit_logs`, retention job, consent versions on leads | audit and versioned consent | |
| Limits | in-memory limiter (`rate_limit.py`), single instance | anonymous abuse control | plan limits or quotas: lost on restart |
| Jobs | systemd timers on the host; `app.cli` commands | same image and CLI | |

**H-1 is still open.** The API connects as the schema owner and only switches to `acs_app_runtime` inside
tenant-bound transactions. Anything outside that path is not protected by RLS. This blocks any public
sign-up, not just the client portal.

## 3. Gap analysis

| Area | Missing | Risk if skipped | Phase |
| --- | --- | --- | --- |
| Self-service registration | sign-up flow, duplicate handling without account enumeration, bot protection, terms acceptance with versions | mass fake accounts, unlawful consent | P2 |
| E-mail verification | token flow, sending provider, bounce handling, sender domain records (DKIM, SPF, DMARC) | unusable or spoofable mail | P1, P2 |
| Password reset, sessions | customer reset, session list, revoke all | account takeover | P2 |
| Rights per plan | plan versions, features, resolved entitlements, grace rules | paid features leak or customers lose access wrongly | P4 |
| Usage limits | durable counters, idempotent events, reservation for costly calls, period rules | overuse, unbounded AI cost, disputes | P5 |
| Checkout | provider choice, hosted flow, customer record, tax evidence | card data exposure, tax errors | P6 |
| Subscriptions | state machine, webhooks, retries, dunning, cancellation, plan change | access out of step with payment | P6 |
| Invoices | numbering, legal fields, currency, credit notes, immutability, retention, accounting export | non-compliant documents | P7 |
| Legal | subscription terms, withdrawal rules, privacy update, processors, DPA | contracts not enforceable | gate before P6 |
| Operations | off-site backups, uptime alerts, error tracking, durable rate limits, runtime login role | loss of billing records, undetected failure | P0 |

## 4. Proposed architecture

**Stay a modular monolith:** same Next.js, FastAPI and PostgreSQL, same image, one more process for jobs.
No microservices and no external identity product. Reasons: one API instance, a 4 GB server, one team, and
the need for transactional consistency between entitlements, usage and billing. Revisit only with evidence,
for example sustained load that one instance cannot carry.

```
apps/api/app/
  auth_core/     password, opaque session tokens, TOTP, lockout: extracted from admin and portal
  accounts/      customer identity, verification, reset, sessions, consents
  workspaces/    customer workspaces, members, invitations, RLS binding
  products/      products, plans, plan versions, features: internal commercial definitions
  entitlements/  what a workspace may do now; the only source other modules ask
  usage/         events, counters, reservations, period rollover
  billing/       provider port, customers, subscriptions, webhooks, dunning
  accounting/    invoices, credit notes, numbering, export; no provider logic
  outbox/        reliable side effects: e-mail, provider calls, retries
```

Dependency direction, enforced by an import test:
`accounts ← workspaces ← entitlements ← usage`, `products → entitlements`, `billing → entitlements` (through
events only), `billing → accounting`. Tools and reports ask `entitlements` and `usage`; they never read plans
or billing. Nothing in these modules imports `app/ops` or `app/portal`.

**One auth implementation, separate principals.** `auth_core` holds the shared mechanics; staff, portal users
and customers stay separate tables with separate cookies and cookie paths. This is a refactor of existing
code, not a second stack. A bug in customer sign-up must not be able to reach staff tables.

**Tables (planned from migration 0016; names can change in review):**

| Module | Tables |
| --- | --- |
| accounts | `customer_accounts`, `customer_sessions`, `customer_tokens`, `customer_consents` |
| workspaces | `customer_workspaces`, `workspace_members`, `workspace_invitations` |
| products | `products`, `plans`, `plan_versions`, `plan_features`, `plan_prices` |
| entitlements | `entitlement_grants`, `workspace_entitlements` (read model) |
| usage | `usage_events` (append-only, unique idempotency key), `usage_counters`, `usage_reservations` |
| billing | `billing_customers`, `subscriptions`, `subscription_events`, `provider_events` (unique provider event id), `payments` |
| accounting | `invoices`, `invoice_lines`, `credit_notes`, `invoice_sequences`, `accounting_exports` |
| outbox | `outbox_messages` |

The name `customer_workspaces` is deliberate: `ops_workspaces` already exists and means something else.

**Rules that shape the design**

* **Tenancy:** every workspace table carries `workspace_id`, has RLS with a policy on a new
  `app.workspace` setting, and uses composite foreign keys as `ops_*` does.
* **Entitlements:** a plan version is immutable; a subscription points at a version, so a later plan change
  never rewrites what a customer bought. Routes declare `require_entitlement("feature")`.
* **Usage:** record with an idempotency key. For costly work, reserve first, then commit or release, so
  parallel requests cannot exceed a limit. Counters are in PostgreSQL, not memory.
* **Billing:** a provider port with one adapter. Webhooks verify the signature on the raw body, store the
  event once, and process through the outbox. The provider is the source for payment state; our tables are the
  source for entitlements. A nightly reconciliation compares both.
* **Card data never reaches our servers:** hosted checkout and customer portal by redirect, not embedded.
* **Invoices:** issued documents are immutable; corrections are credit notes. Numbering comes from a locked
  sequence inside the transaction. Retention follows accounting law, so the retention job and GDPR deletion must
  exclude these records and anonymise the account instead.
* **Free tools stay free and indexable.** Existing public tools keep working without an account. Accounts add
  saving, history and higher limits. Removing anonymous access would be a separate decision with SEO impact.
* **Web:** a new non-indexed `/app` area with its own layout and CSP. Not `/portal`, not `/admin`.
* **Jobs:** a `worker` process from the same image runs the outbox and reconciliation. Budget about 200 MB on
  the current server; measure in P1 before deciding on a resize.

## 5. ADR-52: product accounts and the operations portal stay separate

**Status:** proposed (accepted · design after review).

**Context.** `portal_users` is an invitation-only, read-only view of operational data for a managed-services
client: agents, evaluations, incidents. It is off, with four open prerequisites. A self-service product account
is open to anyone on the Internet. If the two are the same thing, registration alone could approach
operational client data.

**Options**

| Option | Result |
| --- | --- |
| A. Reuse `portal_users` as the product account | rejected: mixes anonymous sign-up with client data, requires turning the portal on, and forces TOTP and one-organisation semantics on every free user |
| B. Merge everything into one identity now | rejected: largest blast radius, touches a working staff login and an unreleased portal at once |
| C. Separate product accounts, with an explicit staff-approved link | **chosen** |

**Decision**

1. A customer account grants access to its own workspaces only. **Registration never grants access to operational
   data**, and neither do plan, payment, e-mail domain or a matching company name.
2. A workspace may be linked to an `ops_organizations` row only through a record in a new table
   `workspace_ops_links`, created by staff with `operator` and approved by a second person.
3. The link needs: a signed contract or DPA reference, a named client contact, a verified account with MFA, and an
   expiry or review date. Every creation, use and removal goes to the audit log.
4. A link does not expose data by itself. Showing any operational data in the product area is a later release
   behind its own flag, read-only, and it needs all of `CLIENT_PORTAL.md` "Before a public release".
5. Removing the link ends access at once. Billing state never creates or removes a link.
6. `CLIENT_PORTAL_ENABLED` stays false. The portal is not a shortcut for accounts, and this plan does not switch it on.

**Consequences.** Two client-facing identities may coexist for a while. A managed-services client with a product
account keeps a separate portal login until the link release. That is the price of keeping the boundary obvious.

**Tests required:** a new account sees no ops data; a paid account sees none either; a same-named company gets no
link; a link without second approval is refused; an expired link denies access; no route in `accounts`,
`workspaces`, `billing` imports `app/ops`.

## 6. Other decisions recorded

* **ADR-53:** modular monolith with `auth_core` and separate principals. Accepted · design.
* **ADR-54:** the catalogue stays free of prices; commercial data lives in `products`, linked by `ToolKey` or
  service key. The new business requirement lifts the old non-goal only for that module. Accepted · design.
* **ADR-55:** hosted checkout behind a provider port; card data never touches our systems. The provider itself is
  open (D-3). Accepted · design.
* **ADR-56:** transactional e-mail through an approved provider and the outbox; replaces ADR-46 for account and
  billing mail only, and only once the provider is approved. Open.

## 7. Backlog

Effort is relative (S, M, L). Each phase ends at a gate. Work marked **independent** can start before any owner
decision.

### P0 Foundations (independent, except off-site storage)

| # | Task | Size | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| 0-1 | Separate runtime login role, close H-1 | L | | API logs in as a non-owner role; migrations use a separate role; tenant tests pass under it |
| 0-2 | Off-site encrypted backups | S | D-7 | a restore from off-site works |
| 0-3 | Uptime and error alerts | S | D-7 | an induced failure raises an alert |
| 0-4 | Durable rate limiting for auth routes | M | | limits survive a restart |
| 0-5 | `/portal` answers 404 while the flag is off | S | | live check |
| 0-6 | Extract `auth_core`, no behaviour change | M | | staff and portal suites unchanged and green |

**Gate G0:** H-1 closed, a tested off-site restore, alerts working.

### P1 Messaging (needs D-2)

| # | Task | Size | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| 1-1 | Outbox and `worker` process | M | 0-6 | at-least-once delivery, retries, dead-letter view; memory measured |
| 1-2 | Provider adapter, templates BG and EN | M | D-2 | test send; bounces recorded |
| 1-3 | Sender records for the domain | S | owner approval | SPF, DKIM and DMARC pass in a real test |

**Gate G1:** real delivery proven to at least two mail providers.

### P2 Accounts

| # | Task | Size | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| 2-1 | Registration, verification, reset | L | G0, G1 | same response for known and unknown e-mail; tokens hashed and single-use |
| 2-2 | Sessions, MFA option, account deletion | M | 2-1 | revoke all works; deletion anonymises |
| 2-3 | Versioned consent to terms and privacy | S | D-6 | version stored per acceptance |
| 2-4 | Bot protection | S | D-8 | scripted sign-up blocked |

**Gate G2:** security review of the flows, privacy notice updated, feature flag default off.

### P3 Workspaces

| # | Task | Size | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| 3-1 | Workspaces, members, invitations, roles | L | 2-1 | RLS tests as the runtime role; cross-tenant read fails |
| 3-2 | `/app` shell, non-indexed | M | 3-1 | robots, CSP and mobile checks |
| 3-3 | Claim a saved result into a workspace | M | 3-1 | only with the secret link; audited |

**Gate G3:** isolation test suite in CI; internal beta with synthetic data only.

### P4 Products and entitlements

| # | Task | Size | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| 4-1 | Products, plans, versions, without real prices | M | | versions immutable |
| 4-2 | Entitlement resolution and `require_entitlement` | M | 3-1, 4-1 | every gated route declares a feature; completeness test |
| 4-3 | Free plan on real tools, behind a flag | M | 4-2 | anonymous tools unchanged |

**Gate G4:** owner approves plan structure (D-1). Still no payments.

### P5 Usage

| # | Task | Size | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| 5-1 | Events, counters, idempotency | M | 4-2 | replays do not double count |
| 5-2 | Reservations for costly calls | M | 5-1 | parallel test cannot exceed a limit |
| 5-3 | Usage view for customers and staff | S | 5-1 | numbers reconcile with events |

**Gate G5:** load test on the production-sized server; cost ceiling agreed if a real AI provider is used.

### P6 Billing (needs D-3, D-4, D-5, D-6)

| # | Task | Size | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| 6-1 | Provider port and test-mode adapter | M | D-3 | full flow in provider test mode |
| 6-2 | Webhooks, idempotency, reconciliation | L | 6-1, 1-1 | duplicate and out-of-order events are safe; mismatches reported |
| 6-3 | Subscription states, dunning, cancellation, plan change | L | 6-2, 4-2 | every transition tested; access follows the written rules |
| 6-4 | Hosted checkout and customer billing page | M | 6-1 | no card field on our pages |

**Gate G6:** lawyer-approved terms, accountant-approved flow, provider live review, security review, rollback
rehearsal. Production keys only after explicit owner approval.

### P7 Accounting

| # | Task | Size | Depends on | Acceptance |
| --- | --- | --- | --- | --- |
| 7-1 | Invoices, credit notes, locked numbering | L | 6-3, D-5 | no gaps under concurrency; issued documents immutable |
| 7-2 | Invoice PDF in BG and EN | M | 7-1 | accountant signs off a sample |
| 7-3 | Accounting export | M | D-5 | agreed format imports cleanly |
| 7-4 | Retention and deletion rules | S | 7-1 | deleting an account keeps legally required records |

**Gate G7:** a first real low-value transaction made by the owner, reconciled end to end, then a limited launch.

The link to operational data (ADR-52) is **not** in this backlog. It needs its own plan after G7 and after the
portal prerequisites are met.

## 8. Decisions needed

None of these blocks P0-1, P0-4, P0-5, P0-6, 1-1 or the schema work in P3 to P5.

| # | Decision | Owner | Blocks |
| --- | --- | --- | --- |
| D-1 | Which tools are paid, plan structure, limits, real prices | owner | G4 |
| D-2 | Transactional e-mail provider, sender address | owner | P1 |
| D-3 | Payment model: payment provider or merchant of record | owner, accountant | P6 |
| D-4 | VAT: the company is not VAT registered; effect of selling to EU and non-EU customers, B2B and consumers | accountant | P6, P7 |
| D-5 | Who issues invoices, numbering, currency, accounting software and export format, any obligation for card sales | accountant | P7 |
| D-6 | Subscription terms, withdrawal rights for digital services, privacy update | lawyer | G2, G6 |
| D-7 | Off-site backup storage and uptime alert accounts | owner | G0 |
| D-8 | Bot protection choice | owner | 2-4 |
| D-9 | Customers: businesses only, or consumers too | owner | D-4, D-6 |
| D-10 | Keep the current server or resize before beta | owner, after measurement | G5 |

D-3 matters most: a merchant of record handles tax and invoicing for each sale and could remove most of P7, at a
higher fee and with less control. Decide it before building 6-1. **Legal and tax points above are questions for
the lawyer and the accountant, not conclusions.**

## 9. Not verified

* Load or memory figures for the new modules: none exist yet.
* The number of operations organisations in the production database was not counted.
* Whether any payment provider accepts this business model; no provider was contacted.
* Legal and tax requirements: not assessed here.
