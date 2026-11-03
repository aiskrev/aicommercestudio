# Roadmap

Priorities are indicative and depend on business decisions. Detailed dependencies and acceptance
criteria for the next generation are in
[IMPLEMENTATION_DEPENDENCIES_V2.md](IMPLEMENTATION_DEPENDENCIES_V2.md). The verified current state is
in [PLATFORM_BASELINE_AUDIT.md](PLATFORM_BASELINE_AUDIT.md).

## Shipped

### V1: local, production-ready foundation (2026-10-23)

- Bulgarian website, service pages, articles, draft legal pages
- Contact form → PostgreSQL with spam protection, rate limiting and GDPR consents
- Admin:
  - login, dashboard;
  - leads (filters, status, notes, deletion);
  - AI triage (mock);
  - AI approvals;
  - audit log.
- AI provider abstraction (mock + Anthropic), approval policy
- Docker Compose, tests (API, unit, e2e), documentation

### V1.1a: AI Managed Services and bilingual platform (2026-10-24)

- English locale (`/en`) with translated URLs, switcher, hreflang, localised API messages and admin
- AI Managed Services page, packages (custom quote), intake form, lead storage and admin display
- Bilingual AI advisor (English demo templates, output language for the AI provider)

### V1.2: redesign and interactive tools (2026-10-24 → 2026-10-27)

- **Design:**
  - premium-editorial redesign;
  - design system v2;
  - interaction system;
  - homepage v3;
  - new information architecture.
- **Phase 0 platform work:** CI workflows, weekly dependency audit, Lighthouse baseline.
- **Tools:**
  - **Hub and registry:** tools hub, tool registry and feature flags.
  - **AI readiness assessment:** with PDF reports and optional submission.
  - **Build your AI team:** costs, saved links (migration 0007), PDF plan, consultations.
  - **Client-side tools:** AI ROI calculator, Automation Opportunity Finder, AI Solution Builder.
  - **AI Agent Library:** 10 static pages.
- AI Managed Services: eight operating areas and the planned portal (no telemetry claims).
- Staff-only AI operations scaffold (migration 0008):
  - organisations, workspaces, roles and agent registry;
  - tenant-scoped API with isolation tests.
- Release review: OG image, layout and accessibility fixes.

### V2 increments (2026-10-27 → 2026-11-03, PRs #17–#39 and the audit branch)

- **Positioning and IA:** platform vision, ten-domain taxonomy, BG/EN content strategy, IA v2, the
  mega-menu, the domain hubs.
- **Service catalogue:**
  - migrations 0009–0010;
  - the public read-only API;
  - the admin editor with per-entry publishing;
  - staff roles (`admin`, `editor`, `viewer`).
- **Founder profile and contacts:** the founder profile and a single source for contacts, protected
  by tests.
- **Tools and assessments:**
  - the assessment engine with versioned definitions;
  - readiness model 2026-11.1;
  - ten specialised assessments with one results experience;
  - reports and PDF;
  - opt-in saved results (migrations 0011–0012);
  - Advisor V2;
  - Solution Builder and agent library v2;
  - AI Managed Services v2.
- **Ops platform** (migration 0013):
  - RLS under a restricted runtime role;
  - registry, evaluations (simulated), bounded observability, incidents and changes;
  - the read-only client portal, **off**.
- **Reference content:** 20 fictional reference scenarios and 11 integration patterns.
- **Workshops & Advisory and opportunities** (migration 0014):
  - the Workshops & Advisory catalogue (ten formats) and the engineering insight topics (no articles
    yet);
  - the opportunity, proposal and SOW workflow with human approval;
  - the integration and quality audit ([INTEGRATION_AUDIT_V2.md](INTEGRATION_AUDIT_V2.md)).

## Next: V2 platform (see IMPLEMENTATION_DEPENDENCIES_V2.md)

1. **P0:** documentation in sync with the code (done 2026-10-27, enforced by `scripts/test.ps1`).
   Delete the superseded branches (owner).
2. **P1, data-platform hardening:**
   - restricted runtime database role and PostgreSQL RLS — **done** (0013), except a separate
     runtime *login* role;
   - a manual migration step in production;
   - a Redis-backed rate limiter and a job queue.
3. **P2:** staff roles — **done**; TOTP MFA for staff — open.
4. **P3 / P4:** client identity (invitations, MFA), then a read-only client portal with manual data
   (registry, versions, incidents, reports) — **implemented and switched off**; release needs the
   prerequisites in CLIENT_PORTAL.md and explicit approval.
5. **P5–P7, telemetry:**
   - telemetry ingestion (keys, gateway, runs and spans, cost computation);
   - evaluations and human review queues;
   - alerts, budgets, incidents and scheduled reports.

## Before public launch (parallel, owner-driven)

- Company registration details (the contact phone and e-mail are approved and published; the mailbox domain `ai-ecomstudio.site` must be activated and verified); legal review of the privacy policy and terms
- Production deployment (VPS or managed containers) behind Caddy with TLS, with automated backups
- Scheduled retention job; uptime monitoring and error alerting
- Configure SMTP lead notifications (a transactional e-mail provider with an EU DPA)
- OG image with Cyrillic typography (the current image is Latin-only by design)

## Later

- **Content:** articles from a headless CMS or Markdown; RSS.
- **Privacy:** privacy-friendly analytics with consent management, only if needed.
- **Case studies:** only once real, approved client projects exist.
- **Commercial:**
  - a pricing page once prices are defined;
  - payments and subscriptions for retainers;
  - CRM sync through `CRMConnector`.
- **AI and integrations:**
  - enable the Anthropic provider for lead triage after a DPA and a privacy-policy update;
  - action executors for approved AI actions (track T3), which would also give the approval queue
    a producer;
  - Shopify and WooCommerce connectors implementing `CommercePlatform` (read-only first);
  - an SEO data provider for client reporting.
