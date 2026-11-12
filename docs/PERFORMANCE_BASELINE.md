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

## Phase 15 check (2026-11-12): what was and was not measured

* **Measured, as tests**: the new public pages (pricing, project packages, demo centre, two demonstrations) load no third-party host
  and their scripts stay under 520 KB encoded (`e2e/tests/seo-commercial.spec.ts`). The demonstrations add one client component and
  no library; their data is two small JSON files and one text module.
* **Not re-run**: Lighthouse (LCP, INP, CLS, total weight). It needs a quiet machine and a rebuilt stack; run `.\scripts\lighthouse.ps1`
  and compare with the table above before a release (D-47). No claim is made here about the new pages' Core Web Vitals.
* **Layout stability**: the demonstration result area is a fixed-structure ordered list that appears after a user action, not during
  load; the e2e checks at 360 px confirm no horizontal scroll before and after a run.

## Commercial expansion pages (forensic audit follow-up, 2026-11-12)

Lab measurement with `scripts/lighthouse.ps1 -Label forensic-fix` (production build in Docker, Lighthouse 13.5.0, median of 3
runs, mobile = simulated slow 4G; numbers vary between sessions). Result files: `apps/web/e2e/perf-results/forensic-fix/` (not committed).

| Preset | Route | Perf | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- |
| Mobile | `/bg/proektni-paketi` | 86 | 3549 ms | 232 ms | 0 |
| Mobile | `/bg/tseni` | 85 | 3766 ms | 242 ms | 0 |
| Mobile | `/bg/demo-tsentar` | 87 | 3474 ms | 215 ms | 0 |
| Mobile | `/bg/demo-tsentar/opisanie-na-produkt` | 81 | 4275 ms | 241 ms | 0 |
| Desktop | the same four routes | 100 | 795-822 ms | 8-14 ms | 0 |

Reading: CLS is 0 and desktop is fast. On mobile the new pages are **slower than the older pages** (baseline mobile LCP 2.9-3.6 s, TBT
113-191 ms) and miss the budget candidates written above (mobile LCP <= 3.0 s, TBT <= 200 ms); the demonstration scenario page is the
slowest (LCP 4.3 s). Only these four routes were measured; the configurator, the basket and the account pages (behind flags and sessions) were not.
No optimisation was made in this follow-up: the numbers are recorded as they are, and a mobile improvement of the scenario page and the
price page is an open item (decision D-47).

## V5 redesign: before and after in one session (2026-11-12)

Same harness (`apps/web/e2e/perf/lighthouse.mjs`, Lighthouse 13.5.0, median of 3, mobile = simulated slow 4G), run twice in a
row on the same machine: **before** = commit `0c14c6a` (the tip of `feature/commercial-expansion`, built from a detached
worktree), **after** = the V5 working tree. Isolated compose projects, production builds. Result files (not committed):
`apps/web/e2e/perf-results/v5-before/` and `apps/web/e2e/perf-results/v5-after/`.

| Preset | Route | Perf before → after | LCP before → after | TBT before → after | CLS | Transfer before → after |
| --- | --- | --- | --- | --- | --- | --- |
| mobile | `/bg` | 83 → 86 | 3.33 s → 3.67 s | 378 ms → 212 ms | 0 → 0 | 553 KB → 532 KB |
| mobile | `/en` | 83 → 83 | 3.93 s → 3.97 s | 260 ms → 233 ms | 0 → 0 | 538 KB → 518 KB |
| mobile | `/bg/uslugi` | 85 → 83 | 3.75 s → 3.99 s | 219 ms → 249 ms | 0 → 0 | 511 KB → 521 KB |
| mobile | `/bg/paketi` | 81 → 82 | 4.15 s → 4.12 s | 256 ms → 255 ms | 0 → 0 | 482 KB → 491 KB |
| mobile | `/bg/uslugi/interaktivni-biznes-saytove` | 85 → 87 | 3.03 s → 3.18 s | 375 ms → 282 ms | 0 → 0 | 525 KB → 532 KB |
| mobile | `/bg/izrabotka-na-saytove` (new) | – → 81 | – → 3.96 s | – → 305 ms | 0 | – → 516 KB |
| mobile | `/bg/online-magazini` (new) | – → 83 | – → 3.90 s | – → 241 ms | 0 | – → 515 KB |
| desktop | all seven routes | 99–100 → 99–100 | 0.79–0.91 s → 0.81–0.94 s | 14–61 ms → 12–71 ms | 0 | 489–610 KB → 489–558 KB |

Reading (honest): the redesign adds no image, font or script, CLS stays 0 and desktop stays at 99–100. Mobile is **not**
improved: LCP stays above the 3.0 s budget candidate on every route, before and after; the homepage LCP is 0.34 s slower
(just above the ~0.3 s noise band) while its TBT and transfer went down. The two new hubs are in the same band as the
existing pages (LCP 3.9–4.0 s). Accessibility 100 everywhere; best-practices 74 everywhere (unchanged); SEO 92 on `/en`
before and after (pre-existing, not investigated here). The mobile LCP work stays an open item (D-47).
