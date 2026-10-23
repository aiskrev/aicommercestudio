# Roadmap

Priorities are indicative and depend on business decisions.

## V1 (this release) — local, production-ready foundation
- Bulgarian website: 15 page types, 7 service pages, 3 articles, draft legal pages
- Contact form → PostgreSQL with spam protection, rate limiting and GDPR consents
- Admin: login, dashboard, leads (filters, status, notes, deletion), AI triage (mock), AI approvals, audit log
- AI provider abstraction (mock + Anthropic), approval policy
- Docker Compose, tests (API, unit, e2e), documentation

## V1.1 — before public launch
- Complete company details, contact e-mail/phone, legal review of privacy policy and terms
- Production deployment (VPS or managed containers) behind Caddy with TLS; automated backups
- Scheduled retention job; uptime monitoring and error alerting
- Configure SMTP lead notifications (transactional e-mail provider with an EU DPA)
- Real OG image with Cyrillic typography; logo finalisation
- Admin: password change, second administrator, optional TOTP 2FA

## V1.1a (this iteration) — AI Managed Services & bilingual platform
- English locale (`/en`) with translated URLs, switcher, hreflang, localized API messages and admin
- AI Managed Services page, packages (custom quote), intake form, lead storage and admin display
- Bilingual AI advisor (English demo templates, output language for the AI provider)

## Next iteration — AI Operations Console (multi-tenant)
- Internal console for operated AI systems: tenants, systems, incidents, changes, evaluations
- Telemetry ingestion (OpenTelemetry), health probes, evaluation runner, cost import, alerts
- Client portal (read-only) — see [AI_OPERATIONS_ARCHITECTURE.md](AI_OPERATIONS_ARCHITECTURE.md)
- Contract templates for AI Managed Services (scope, hours, response targets only where staffed)

## V1.2 — content & growth
- Articles managed through a headless CMS or Markdown files; article categories and RSS
- Privacy-friendly analytics with consent management (only if needed)
- Case studies — only once real, approved client projects exist

## V2 — commercial features
- Pricing / packages page once prices are defined
- Client portal: requests, reports, shared documents
- Online payments and subscriptions for retainers (e.g. Stripe), invoices
- CRM sync for leads (HubSpot, Pipedrive or similar) through `CRMConnector`

## V2+ — AI & integrations
- Enable the Anthropic provider for lead triage after DPA and privacy-policy update
- Action executors for approved AI actions (e-mail drafts, CRM updates) with policy enforcement
- Shopify / WooCommerce connectors implementing `CommercePlatform` (read-only first)
- SEO data provider integration for client reporting
- Redis-backed rate limiting and job queue for scaling beyond one API instance
