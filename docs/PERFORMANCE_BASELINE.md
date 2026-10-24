# Performance baseline (Lighthouse, lab)

Phase 0 of [PLATFORM_EXPANSION_PLAN.md](PLATFORM_EXPANSION_PLAN.md). Re-run with `.\scripts\lighthouse.ps1`
and compare against this table before and after every phase.

## Method

* **Code measured:** `main` @ `831fe81` (production build, `docker compose up --build`).
* **Tool:** Lighthouse 13.5.0 in the Playwright container (`apps/web/e2e/perf/lighthouse.mjs`, run by
  `scripts/lighthouse.ps1`), Chromium headless, against `http://web:3000` on the Docker network.
* **Presets:** `mobile` (Lighthouse default: Moto G Power emulation, simulated slow 4G, 4× CPU) and
  `desktop` (`--preset=desktop`).
* **Runs:** 3 per route and preset; the table shows the run with the **median performance score**
  (all three scores in brackets). Measured 2026-10-24 04:3x UTC on a Windows 11 developer machine
  (Docker Desktop). Lab numbers vary between sessions; treat differences below ~0.3 s LCP or
  ~100 ms TBT as noise (see the 63 outlier on the first `/bg` run — a cold start).
* **Not covered:** field data (no production site), real devices, CDN/HTTP/2 behaviour.

## Results — baseline 2026-10-24

| Preset | Route | Perf (runs) | A11y | BP | SEO | FCP | LCP | TBT | CLS | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mobile | `/bg` | **91** (63, 91, 92) | 100 | 74 | 100 | 0.98 s | 3.32 s | 113 ms | 0 | 423 KB |
| mobile | `/en` | **94** (92, 96, 94) | 100 | 74 | 92 | 0.95 s | 2.87 s | 115 ms | 0 | 414 KB |
| mobile | `/bg/uslugi` | **88** (89, 88, 88) | 100 | 74 | 100 | 0.91 s | 3.60 s | 160 ms | 0 | 403 KB |
| mobile | `/bg/uslugi/ai-managed-services` | **90** (90, 86, 93) | 100 | 74 | 100 | 1.13 s | 3.47 s | 117 ms | 0 | 465 KB |
| mobile | `/bg/kontakti` | **89** (92, 89, 89) | 100 | 74 | 100 | 0.91 s | 3.31 s | 191 ms | 0 | 381 KB |
| mobile | `/bg/ai-automation-advisor` | **90** (89, 91, 90) | 100 | 74 | 100 | 0.94 s | 3.32 s | 151 ms | 0 | 427 KB |
| desktop | `/bg` | **100** (100, 100, 100) | 100 | 74 | 100 | 0.27 s | 0.73 s | 16 ms | 0 | 459 KB |
| desktop | `/en` | **100** (100, 100, 100) | 100 | 74 | 92 | 0.26 s | 0.73 s | 18 ms | 0 | 447 KB |
| desktop | `/bg/uslugi` | **100** (100, 100, 100) | 100 | 74 | 100 | 0.25 s | 0.73 s | 16 ms | 0 | 484 KB |
| desktop | `/bg/uslugi/ai-managed-services` | **99** (99, 100, 99) | 100 | 74 | 100 | 0.30 s | 0.83 s | 32 ms | 0 | 501 KB |
| desktop | `/bg/kontakti` | **100** (100, 100, 100) | 100 | 74 | 100 | 0.25 s | 0.77 s | 19 ms | 0 | 427 KB |
| desktop | `/bg/ai-automation-advisor` | **100** (100, 100, 100) | 100 | 74 | 100 | 0.25 s | 0.77 s | 18 ms | 0.011 | 454 KB |

## Findings

| # | Category | Finding | Status |
| --- | --- | --- | --- |
| 1 | Performance | Mobile LCP 2.9–3.6 s (simulated slow 4G) is the main gap; desktop LCP < 1 s. TBT is low (113–191 ms mobile). CLS 0 except 0.011 on the advisor page (desktop). Transfer 380–500 KB per page | Budget candidates for Phase 1+: mobile LCP ≤ 3.0 s, TBT ≤ 200 ms, CLS ≤ 0.05, transfer ≤ 500 KB |
| 2 | Best practices | `is-on-https` / `redirects-http` fail because the lab stack is plain HTTP; expected to pass behind the TLS reverse proxy (`infra/reverse-proxy`) | Environmental, no code change |
| 3 | Best practices | **Console errors**: invalid SVG path in the audit motif (`ServiceMotif.tsx`, missing space `m44 ${y}3 …`) on pages that show it | **Fixed on `ci/phase-0-foundations`** — see re-measurement below |
| 4 | SEO (EN) | `link-text`: two links read only "Learn more" (AI Managed feature and process on the homepage). Lighthouse checks English only; the Bulgarian "Научете повече" links have the same issue | Open — Phase 2 (descriptive link text or accessible names) |
| 5 | Accessibility | 100 on all pages and presets | — |

## Re-measurement after the SVG fix (`ci/phase-0-foundations`)

Same method, routes `/bg`, `/en`, `/bg/uslugi` (the pages that render the audit motif):

| Preset | Route | Perf (runs) | A11y | BP | SEO | FCP | LCP | TBT | CLS | Transfer |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| mobile | `/bg` | **92** (92, 91, 95) | 100 | 74 | 100 | 0.96 s | 3.33 s | 109 ms | 0 | 423 KB |
| mobile | `/en` | **92** (94, 91, 92) | 100 | 74 | 92 | 0.94 s | 3.32 s | 101 ms | 0 | 414 KB |
| mobile | `/bg/uslugi` | **93** (92, 94, 93) | 100 | 74 | 100 | 0.91 s | 2.87 s | 154 ms | 0 | 403 KB |
| desktop | `/bg` | **100** (100, 100, 100) | 100 | 74 | 100 | 0.28 s | 0.76 s | 27 ms | 0 | 459 KB |
| desktop | `/en` | **100** (100, 100, 100) | 100 | 74 | 92 | 0.26 s | 0.76 s | 37 ms | 0 | 447 KB |
| desktop | `/bg/uslugi` | **100** (100, 100, 100) | 100 | 74 | 100 | 0.25 s | 0.74 s | 23 ms | 0 | 484 KB |

* The three SVG console errors are gone on every run. The remaining console message on all pages is
  "The Cross-Origin-Opener-Policy header has been ignored, because the URL's origin was
  untrustworthy" — caused by plain HTTP in the lab (also present at baseline on pages without the
  motif). Together with `is-on-https` / `redirects-http` it keeps Best Practices at 74 locally; all
  three are expected to clear behind HTTPS.
* Performance differences versus the baseline are within lab noise (no performance change intended).
