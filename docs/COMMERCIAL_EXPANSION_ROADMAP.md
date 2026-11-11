# Commercial expansion — roadmap

Date: 2026-11-11. Based on [COMMERCIAL_EXPANSION_AUDIT.md](COMMERCIAL_EXPANSION_AUDIT.md). Status of each phase:
[COMMERCIAL_EXPANSION_PROGRESS.md](COMMERCIAL_EXPANSION_PROGRESS.md).

## 1. Phases and dependencies

```text
01 audit ─▶ 02 UX/conversion ─▶ 03 packages ─▶ 04 pricing ─▶ 05 configurator ─▶ 06 quote basket
                                                                                     │
                                             07 quotations/leads ◀───────────────────┘
                                                   │
                       08 accounts hardening ─▶ 09 project portal ─▶ 10 documents/approvals
                                                   │                        │
                                            11 e-mail ◀─────────────────────┘
                                                   │
                      12 admin CRM ─▶ 13 billing/invoicing ─▶ 14 AI demos ─▶ 15 SEO/perf/analytics
                                                                                     │
                                             16 security/GDPR ─▶ 17 staging/release gates ─▶ 18 QA + release review
```

Strict order: 03 → 04 (packages reference price keys), 04 → 05/06 (totals come from the pricing source), 06 → 07,
08 → 09 → 10, 09/10 → 11 (notifications for portal events), 07/09 → 12, 12 → 13. 14 and 15 are independent of
07–13 but run after them to avoid conflicts in shared files. 16–18 are gates over everything.

## 2. Phase scope and acceptance

| Phase | Scope | Acceptance |
| --- | --- | --- |
| 02 | Conversion paths: clearer primary CTAs, one consistent "request a quote" route, mobile spacing, header layout fix for accounts-on (BLOCKER-ACC-HEADER-01) | Existing e2e + new CTA tests; no protected content touched; a11y spec green |
| 03 | Package definitions for build services (website, store, portal, integration, AI) with included/excluded items, versioned; static content first, catalogue link | Pages BG/EN, JSON-LD, tests; no invented guarantees; prices only as existing bands |
| 04 | Single pricing module with a server-side mirror (golden vectors like team model); VAT/currency display rules; language never selects price | Parity test web ↔ API; owner approval flag respected; no new approved prices |
| 05 | Project configurator: enumerated answers → recommended package + options + indicative range; shareable code; PDF optional | Deterministic model, server validation, vectors, accessible UI; flag `PROJECT_CONFIGURATOR_ENABLED` off |
| 06 | Quote basket: items = package + options; server totals; persistence by token; becomes quote request | Server recomputes totals; flag `QUOTE_BASKET_ENABLED` off; consents reuse existing legal flow |
| 07 | Quote → lead/opportunity link; customer-facing quotation view (read-only token) of a **human-approved** proposal version; explicit accept/decline with audit | Draft/generated content never visible; acceptance recorded in `legal_events`-style audit |
| 08 | Accounts hardening review: session, rate limits, verification, IDOR tests; fix BLOCKER where code-fixable | Security tests; registration still off in production |
| 09 | Commercial project object per workspace (status, milestones, updates); customer read view; staff write | Isolated from `/portal`; flag `COMMERCIAL_PROJECTS_ENABLED` off |
| 10 | Documents and approvals: metadata, signed download, approval requests; upload endpoint implemented but disabled | Flag `PROJECT_DOCUMENTS_ENABLED` off; upload gate `PROJECT_UPLOADS_ENABLED` off; security review recorded |
| 11 | Templates for quotation sent/accepted, project update, approval request via outbox | Dev-file provider in tests; no real mail; production still guarded by `EMAIL_DELIVERY_VERIFIED`; flag `PROJECT_NOTIFICATIONS_ENABLED` off |
| 12 | Admin CRM: company/contact grouping, tasks, pipeline view, timeline | Staff roles respected; audit log entries |
| 13 | Quotation-linked billing in Stripe sandbox via the existing integration; invoicing source unchanged | No second Stripe integration; no live mode; real run BLOCKED without test keys |
| 14 | AI demo polish on top of mock provider; clear "demo, not a result" labelling | No metrics or customer claims |
| 15 | Sitemap, metadata, JSON-LD for new pages; funnel events; Lighthouse budget | seo e2e, performance baseline updated |
| 16 | Security/GDPR review: data map, retention for new tables, erase/export coverage | Review doc; compliance tests extended |
| 17 | Staging runbook, Cloudflare/Hetzner checklist, release gates | Documents only; no infrastructure change |
| 18 | Full QA, regression, release review | Release review doc; **stop at approval gate** |

## 3. Data model proposal (new tables, all behind flags, created by linear migrations 0026+)

| Table | Purpose | Key columns |
| --- | --- | --- |
| `service_packages`, `package_versions` | Phase 03/04: package definitions and immutable versions | key, service_key, version, content JSON, price_band_key, status (draft/approved), approved_by |
| `configurator_sessions` | Phase 05 | token_hash, answers JSON (enumerated), model_version, expires_at |
| `quote_baskets`, `quote_basket_items` | Phase 06 | token_hash, locale, currency, package_key, options JSON, totals JSON, model_version, expires_at |
| `quotations` | Phase 07: customer-visible projection of an approved `lead_proposal_versions` row | lead_id, proposal_version_id, token_hash, status (sent/viewed/accepted/declined/expired), accepted_at, accepted_by_hash |
| `commercial_projects`, `project_milestones`, `project_updates` | Phase 09 | workspace_id, quotation_id, status, visibility |
| `project_documents`, `approval_requests` | Phase 10 | project_id, storage_key, sha256, size, scan_status, state, decided_by |
| `crm_companies`, `crm_contacts`, `crm_tasks` | Phase 12 | normalised company/contact, lead links, due dates |

Migration strategy: one migration per phase at most, additive only (no destructive change to existing tables),
single Alembic head, tested upgrade-from-populated like `test_migration_legal_populated.py`; nothing is applied to
production without the release approval.

## 4. API design (all under existing prefixes, versionless like the current API)

| Phase | Routes |
| --- | --- |
| 03/04 | `GET /api/public/packages`, `GET /api/public/packages/{key}`, `POST /api/public/pricing/estimate` |
| 05 | `POST /api/public/configurator/recommend`, `POST /api/public/configurator/sessions`, `POST …/sessions/lookup` |
| 06 | `POST /api/public/quote-basket`, `GET`/`PUT /api/public/quote-basket/{token}`, `POST …/submit` |
| 07 | `GET /api/public/quotations/{token}`, `POST …/accept`, `POST …/decline`; admin: `POST /api/admin/leads/{id}/proposals/{pid}/publish-quotation` |
| 09 | `GET /api/workspace/projects/commercial*` (customer), `/api/admin/projects*` (staff) |
| 10 | `GET /api/workspace/projects/{id}/documents`, signed download, `POST …/approvals/{aid}/decide` |
| 12 | `/api/admin/crm/*` |

Every new route: Pydantic schemas, rate limit via `app/accounts/limits.hit`, listed in `API_REFERENCE.md`, in the
OpenAPI file (`docs_sync.py --write`), covered by tests including cross-tenant access.

## 5. UI route plan

New Bulgarian segments need EN mappings in `i18n/config.ts`: `konfigurator` ↔ `configurator`, `zapitvane` (basket) ↔
`quote`, `oferta/[token]` ↔ `quotation/[token]`, `konto/proekti` ↔ `account/projects`. Staff: `admin/crm`,
`admin/projects`. New routes are added to `routes.ts`, sitemap (public ones only), and the route tests.

## 6. Feature flags (all default off)

`PROJECT_CONFIGURATOR_ENABLED`, `QUOTE_BASKET_ENABLED`, `QUOTATIONS_ENABLED`, `COMMERCIAL_PROJECTS_ENABLED`,
`PROJECT_DOCUMENTS_ENABLED`, `PROJECT_UPLOADS_ENABLED`, `PROJECT_NOTIFICATIONS_ENABLED`, `ADMIN_CRM_ENABLED`.
API settings with a 404 for disabled routes; the web hides entry points when the API answers 404 (as for billing);
the production guard refuses combinations that need an unmet owner decision.

## 7. Testing, rollback, risks

* Each phase adds unit/API tests, golden vectors where the model is duplicated, and an e2e only where a user path
  exists; suites run through `scripts/test.ps1`. Failing tests are fixed, never disabled.
* Rollback: flags off restores current behaviour; migrations are additive so a code rollback leaves unused tables.
* Owner decisions needed: price schedule approval, mailbox/domain, what a customer may "accept" (binding or
  expression of interest), upload policy, retention for new data, billing on quotations yes/no, lawyer review of
  acceptance wording. Phases proceed with the safest default and record the decision as open in
  `COMMERCIAL_EXPANSION_DECISIONS.md` (created when the first decision appears).
