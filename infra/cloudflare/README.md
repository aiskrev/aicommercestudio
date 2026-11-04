# Cloudflare configuration for review

**Nothing here has been applied.** These are proposals to review and apply by hand in the dashboard.
Changes to DNS, Cloudflare and production rights need the owner's approval.

Written for the Free plan, which is what `ai-commercestudio.com` is believed to use. **Check the plan and
its current rule limits first**: limits differ by plan and change over time, and the Free plan may allow
only one rate limiting rule with a short period.

## Cache

Rule order matters, so the bypass comes first. `cache-rules.json` has the expressions.

| Rule | Paths | Action |
| --- | --- | --- |
| 1. Bypass | `/api/`, `/admin`, `/portal`, `/bg/konto`, `/en/account` | Bypass cache |
| 2. Static files | `/_next/static/` | Eligible for cache, respect origin (immutable) |
| 3. Everything else | Public pages | Respect origin headers |

No rule caches HTML by default. Bypass does not depend on cookies, so personal data is never stored even
if a cookie name changes. The API also sends `Cache-Control: no-store` on account, workspace, billing and
client area routes, and those pages are rendered per request.

## Webhooks

`POST /api/billing/stripe/webhook` must reach the origin with **no browser challenge**: Stripe cannot
solve one. Its proof is the signature, not the network. `waf-rules.json` has a skip rule limited to that
exact path and method. Do not widen it, and leave Bot Fight Mode off for it, or the Stripe events fail.
If Bot Fight Mode cannot be skipped on this plan, leave it off for the zone.

Stripe's callback pages (`/bg/konto/advisor/payment`) are ordinary signed-in pages and need no exception.

## Rate limits

Two layers. The application limits per IP and e-mail in PostgreSQL, and those work without Cloudflare.
`rate-limits.json` adds an edge rule for sign-in and recovery. Leave the webhook out of edge limits: Stripe
sends bursts at renewal time, the signature protects it, and a blocked event only retries for a while.

## Turnstile

Off until both values are set. Create a widget for the domain, then set:

| Where | Name | Notes |
| --- | --- | --- |
| API `.env` | `TURNSTILE_SECRET_KEY` | Secret |
| Web `.env` | `TURNSTILE_SITE_KEY` | Public |
| Web build | `TURNSTILE_ENABLED=true` | Adds Turnstile to the CSP; needs a rebuild |

`app/turnstile.py` verifies every token on the server for sign-up and password recovery. An unreachable
Cloudflare refuses the request.

## Content Security Policy

`apps/web/next.config.ts`. Today everything is `'self'`. With `TURNSTILE_ENABLED=true`, `script-src` and
`frame-src` also allow `https://challenges.cloudflare.com`. Stripe needs nothing: Checkout and the portal
are full-page redirects, not embedded.

## Client address

Do not trust forwarded headers from arbitrary clients. The chain is already built for this:

1. Caddy trusts `CF-Connecting-IP` only from Cloudflare's ranges (`infra/reverse-proxy/Caddyfile.cloudflare`).
2. Caddy overwrites `X-Forwarded-For` with that address and removes `CF-Connecting-IP`.
3. The API takes the right-most `X-Forwarded-For` entry, the one set by the nearest proxy.
4. UFW allows port 443 from Cloudflare only.

Keep Cloudflare's IP list in the Caddyfile and UFW up to date.

## After applying

* A public page returns `cf-cache-status` as configured, and `/api/` and `/bg/konto` return `BYPASS` or
  `DYNAMIC`.
* `stripe trigger` or Resend reaches the webhook with 2xx, and no challenge appears in Security Events.
* Sign-in with a wrong password many times hits the edge rule.
