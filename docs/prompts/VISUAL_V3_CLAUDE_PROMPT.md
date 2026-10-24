# Claude Code prompt — Visual direction v3 "Signal"

Paste everything below the line into Claude Code, one phase at a time (start with "Phase 0").

---

You are a senior frontend engineer and design-system engineer working in the A.I. Commerce Studio
repository (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 tokens in
`apps/web/src/app/globals.css`, FastAPI API, PostgreSQL, Docker Compose, BG/EN).

Your job is to implement the visual direction in `docs/VISUAL_DIRECTION_V3.md` ("Signal")
**incrementally**, one phase per branch and pull request. Read that document fully before starting.
It is the source of truth for colours, gradients, surfaces, typography, motion, components,
homepage composition, budgets and accessibility rules. Do not invent visual values that the
document already specifies; if something is missing, choose the most restrained option consistent
with the document and record the decision in `docs/DESIGN_SYSTEM.md`.

## Hard rules

1. **Do not touch the logo.** `components/layout/Logo.tsx`, `app/icon.svg` and the
   `.logo-gradient-text` class stay exactly as they are (owner decision).
2. **Do not rewrite working business logic**: API, forms submission, validation, advisor logic,
   admin, auth, locale routing (`proxy.ts`, `lib/locale-routing.ts`), SEO metadata and JSON-LD.
   Visual changes only, plus new presentational components.
3. **Honesty:** no fabricated metrics, clients, logos, testimonials, prices or SLAs. Anything that
   looks like data is synthetic and labelled in the UI with `DemoChip` ("DEMO · synthetic data" /
   "ДЕМО · примерни данни") plus a caption.
4. **BG/EN parity:** every new string goes into `src/content/{bg,en}` or the dictionaries
   (EN typed against BG). Test the longest Bulgarian strings at 360 px.
5. **Server Components by default.** Client components only for real interactivity (pointer
   effects, port focus, count-up, builders), each as a small island.
6. **Accessibility:** WCAG AA contrast (re-run the contrast check for every new colour pair),
   visible focus (`--ring`), keyboard operation for every interactive diagram, ≥ 44 px targets,
   `prefers-reduced-motion` static states, pause controls for loops longer than 5 s, no
   hover-only information.
7. **Performance budgets** (document section 8.3): homepage JS added across phases 1–7 ≤ 25 KB gz;
   no new web fonts; LCP element stays text or the SVG core; CLS ≤ 0.05; mobile Lighthouse
   performance and LCP not worse than `docs/PERFORMANCE_BASELINE.md`.
8. **One phase = one branch = one PR.** Never push to `main`, never merge, never deploy. Commit and
   push the phase branch only when I ask. Commit messages end with
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
9. Do not read or print secrets from `.env`; use `scripts/setup.ps1` / `scripts/test.ps1`.

## Every phase follows this loop

1. **Inspect** the relevant code first (`globals.css`, `components/ui/primitives.tsx`,
   `components/ui/patterns.tsx`, the components listed for the phase, `docs/DESIGN_SYSTEM.md`).
   List the existing components you will reuse or extend.
2. **Plan**: write the phase plan (files, components, tokens, risks, test plan) and show it to me
   before editing.
3. **Implement** in small commits.
4. **Verify:**
   * `.\scripts\test.ps1 -Suite web` (typecheck, lint, unit), `-Suite api`, `-Suite e2e`;
   * production build (`docker compose build web`);
   * screenshots with the visual tool (`apps/web/e2e/visual/screenshots.spec.ts`,
     `SHOT_FULL=all`) at 360/390/768/1024/1440 in BG and EN — horizontal overflow must be 0 on
     every page;
   * the same pages with reduced motion emulated;
   * a keyboard walkthrough of everything new;
   * `.\scripts\lighthouse.ps1 -Label v3-phase-N` compared with the baseline (phases 1, 5, 6, 7, 8).
5. **Document** decisions in `docs/DESIGN_SYSTEM.md` (tokens, components, usage, do/don't).
6. **Report:** files changed, decisions, test and Lighthouse results, screenshots reviewed,
   remaining issues.

## Phases

### Phase 0 — Baseline (branch `design/v3-baseline`, docs only)
Capture before-screenshots (`SHOT_LABEL=v3-before`) and a Lighthouse run (`-Label v3-before`).
Map every document section to existing files. Output the full phase plan for phases 1–8. No source
changes.

### Phase 1 — Tokens, surfaces, light (branch `design/v3-tokens`)
* Add the v3 tokens from section 8.1; alias the v2 names to them so nothing breaks; move `brand`
  to `#22d3ee` only after verifying every pair.
* Add `.surface-recessed`, `.surface-1..4`, `.light-field-hero|horizon|ops`, `.noise` (static
  SVG data URI), line tokens, motion tokens, `--ring`.
* Restyle existing `.card`, `.panel`, `.section-alt` onto the new levels. No layout changes.
* Paper (`surface-light`) is kept but only used by Insights/article pages after phase 6.

### Phase 2 — Motion system and buttons (branch `design/v3-motion-buttons`)
* Motion tokens and utilities; global reduced-motion rules extended (section 5.8).
* `PauseControl` primitive.
* Signal button exactly as section 8.4 (`@property` stops, light stops only behind text, sweep,
  arrow 4 px, press 0.985, focus ring), Outline-light secondary, Spectrum-underline link. Keep the
  existing `Button`/`ButtonLink`/`buttonClass` API; add the variant names, keep old ones as aliases.
* Unit tests for class composition; screenshot hover/focus/active states.

### Phase 3 — Card families and primitives (branch `design/v3-cards`)
* `FigureLabel`, `Port`, `FlowEdge`, `DemoChip`, `SpectrumText`, `LightField`.
* Card families from section 5.11 / 8.5: `ToolCard`, `SolutionCard`, `ArchitectureNode`,
  `AgentCard`, `MetricTile`, `StatusRow`, and an `EditorialCard` variant of `ArticleCard`.
* Border light: one shared client listener (CSS custom properties updated in
  `requestAnimationFrame`, `mask-composite` border), disabled for coarse pointers and reduced
  motion; static highlight on focus.
* Replace the generic icon-in-box usage where the document says so (section 5.6).
* Unit tests: every card renders as a single accessible link where it is clickable; `MetricTile`
  and `StatusRow` fail type-checking without `demo`.

### Phase 4 — Navigation (branch `design/v3-nav`)
* Sliding Spectrum-line active indicator (one element, transform only).
* Services mega-panel (floating surface, two columns + "Start here" rail), keyboard and
  screen-reader behaviour unchanged or better (existing e2e must pass).
* Tools panel and `Client login` link only behind a config flag and only for routes that exist.
* Header height fixed at 64 px (no layout shift); mobile sheet.

### Phase 5 — Hero: AI System Core (branch `design/v3-hero`)
* `SystemCore`: server-rendered isometric SVG (three plates: Data cyan, Intelligence azure,
  Agents & automation violet; Operations ring green; amber Approval gate on the output path) with
  six HTML-labelled ports (DATA, AI, AGENTS, AUTOMATION, HUMAN CONTROL, OPERATIONS).
* CSS flows: light rises through the plates, holds 600 ms at the gate, passes; 32 s ambient light
  drift; all paused off-screen and under reduced motion; visible pause control.
* Ports are buttons (client island ≤ 4 KB gz): focus/hover dims others, brightens connections and
  shows a one-line explanation in a caption region; arrow keys move between ports.
* `PhaseRail` (Discover → Design → Build → Deploy → Operate → Improve) synced with the core.
* New hero copy in BG/EN (section 7.1); hero statement scale from section 5.5.
* Mobile: core 300–340 px directly under the CTAs; ports as a legend list.
* No WebGL in this phase. Lighthouse must not regress.

### Phase 6 — Homepage recomposition (branch `design/v3-home`)
Rebuild the homepage sequence of section 7 using existing data and components where listed:
stack strip, statement, services bento (descriptive link texts, replacing "Learn more"), failure
modes (dark diagnostic log), Approval Gate section, Insights on paper, FAQ, final CTA. Keep all
existing content keys; add only new strings. Keep `h1` count, headings order, JSON-LD and metadata.

### Phase 7 — Signature modules (branch `design/v3-signatures`)
* AI Operations telemetry band (section 5.15 / 7.7) with deterministic demo data from content
  files, every tile `DemoChip`-labelled, tilted surface on desktop only.
* Agent constellation teaser (section 7.8) as SVG + HTML nodes; links to the Automation Advisor
  until a team-builder tool exists.
* Reuse the same primitives on the AI Managed Services page and service pages where the document
  says so; do not add new tools or routes.

### Phase 8 — Optional WebGL core (branch `design/v3-webgl`, only if I approve after phase 7)
* React Three Fiber version of the core, `dynamic(..., { ssr: false })` after idle, only for
  `pointer: fine`, no reduced motion, no `Save-Data`, `navigator.deviceMemory ≥ 4`; pause when
  off-screen; adaptive DPR; SVG core remains the LCP element and fallback.
* Ship only if Lighthouse stays within budget and a side-by-side review shows clear added value.

## Definition of done (every phase)
* All suites green, production build OK, no new console errors.
* Screenshots reviewed BG/EN at all widths, overflow 0, reduced-motion state correct.
* Contrast verified for new pairs; keyboard path verified.
* Lighthouse within budget where measured.
* `docs/DESIGN_SYSTEM.md` updated.
* Report with changed files, decisions, results and remaining issues.

Start with Phase 0.
