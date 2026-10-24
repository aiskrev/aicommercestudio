# UI implementation report — premium redesign

Date: 2026-10-24. Branch `redesign/premium-ui` (from `main` @ `40b03e0`). Frontend-only change: no
backend, database, API, routing or SEO-logic changes. Nothing committed, pushed or deployed yet.

## 1. Audit summary

See [UI_AUDIT.md](UI_AUDIT.md). The site was solid but generic: one near-black surface everywhere,
neon gradients and gradient text, an orbital "AI hub" hero, the same rounded icon card repeated in
~8 sections, hard-coded `01–07` service counters, cramped Manrope Cyrillic in small headings, and a
7 px overflow on the services page at 360 px.

## 2. Design direction

**Precision Commerce × Intelligent Automation** — an engineering studio, not an AI-agency template.
Deep navy surfaces, a single teal accent, periwinkle only for AI, amber only for human approval, and
a light editorial surface that changes the rhythm. Visuals show *how the studio works* (workflows,
approval gates, discipline-specific schemas) and are always labelled as illustrations/demo data.
Tokens and rules: [UI_DESIGN_SYSTEM.md](UI_DESIGN_SYSTEM.md).

## 3. What changed

### Global
* `globals.css` rebuilt: semantic colour/radius/shadow tokens, brand-tuned Tailwind scales, new type
  scale (Manrope display / Inter text / JetBrains Mono labels), solid primary button, flatter cards,
  light-surface rules, nav underline, flowing workflow connector, reduced-motion handling.
* JetBrains Mono added via `next/font` (Latin + Cyrillic) in the public and admin root layouts.
* Manrope Bulgarian `locl` forms disabled for every Manrope usage (consistent Cyrillic).

### Header & brand
* New monogram (an "A" that ends in a routed node) and wordmark (`A.I. Commerce` + mono `STUDIO`).
* Compact header, active page marked with a teal underline (no pills), panel-style services menu,
  mono BG | EN switcher with 36 × 40 px targets, solid CTA. Mobile menu unchanged functionally.

### Homepage (complete re-composition)
1. Hero: editorial headline + **product-style workflow panel** (store event → API → AI structured
   output → rules + human approval → business action), labelled "Demo · sample data".
2. Services: **asymmetric bento** (7 + 5 / 4 + 4 + 4 / 5 + 7), per-discipline line motifs, no counters;
   tablet layout balanced automatically; audit offering as a dashed "first step" strip.
3. Problems: **light editorial index** — 7 client problems, each linked to its service (added the
   "AI solution runs but nobody maintains it" → AI Managed Services row).
4. AI capability: **five-stage pipeline** (input, AI processing, business rules, human approval,
   output) with "AI may" vs "requires approval" lanes; advisor promo.
5. Process: **stepped editorial sequence** (Discovery, Architecture & planning, Development &
   validation, Support & optimization) with deliverable tags and a sticky heading.
6. Capabilities: **light hairline matrix** of six capability groups + working principles (no logos,
   no numbers).
7. Who we help: compact industry list + engagement formats panel.
8. Insights: featured article + editorial rows.
9. FAQ: hairline accordion. 10. Final CTA: “Имате технически проблем или идея за автоматизация?” /
   “Have a technical challenge or an automation idea?” with one primary action (“Обсъди проект” /
   “Discuss your project”).

Removed from the homepage: the technology strip (merged into capabilities) and the use-case card
grid (use cases remain on the AI Solutions page).

### Inner pages
* Services directory: bento grid + audit strip (overflow at 360 px fixed).
* Service detail (6 template services): **discipline-specific concept diagram** in the hero
  (cycle / site tree / application stack / process flow with approval gate / measurement funnel /
  system hub / audit checklist) built from each service's own workflow steps; summary strip; signals
  as an editorial list; capabilities as a two-column index; technical checks on the light surface;
  process as stepped sequence beside "what we need from you".
* AI Managed Services: hero with the vertical AI-operations diagram; "why AI fails" as a light
  editorial grid; audience as an index list.
* AI Solutions: use cases as an index list, principles on the light matrix, managed-service band.
* About: principles on the light matrix. Insights: featured + rows. Contact, advisor, industries,
  process, legal, article pages and admin inherit the new tokens without layout or behaviour changes.

## 4. Files

**New components:** `components/home/{HeroWorkflow,ProblemIndex,AiPipeline,ProcessSteps,CapabilityMatrix}.tsx`,
`components/sections/{ServiceBento,ServiceMotif,ServiceConcept}.tsx`, `FeatureIndex` and
`FeatureMatrix` in `components/ui/primitives.tsx`.

**Refactored:** `app/globals.css`, `components/ui/primitives.tsx` (Section tones/densities, Eyebrow,
IconBadge, PageHero), `layout/{Header,Logo,LanguageSwitcher,Breadcrumbs}.tsx`,
`sections/{ServiceCard,CtaBand,Faq,ProcessTimeline,AiOpsDiagram}.tsx`, `editorial/ArticleCard.tsx`
(variants), pages `[locale]/{page,uslugi/page,uslugi/[slug]/page,uslugi/ai-managed-services/page,
ai-resheniya/page,statii/page,za-nas/page}.tsx`, both root layouts (font).

**Content:** `content/{bg,en}/home.ts` (hero context + workflow demo, AI-maintenance problem, pipeline
stages, 4-stage process, capabilities, new final CTA; removed unused technology/use-case blocks);
`i18n/dictionaries/{bg,en}.ts` (`service.conceptLabel`).

**Tooling:** `e2e/visual/screenshots.spec.ts` + `e2e/playwright.screens.config.ts` (screenshot and
overflow capture, not part of the test run); `.gitignore` (screenshot artefacts).

**Docs:** `UI_AUDIT.md`, `UI_DESIGN_SYSTEM.md`, this report; `DESIGN_SYSTEM.md` marked superseded.

## 5. Screenshots

Captured with Playwright/Chromium against the running stack (not committed; regenerate locally):

```powershell
docker compose --profile test run --rm -e SHOT_LABEL=after `
  -v ${PWD}/apps/web/e2e/screenshots:/e2e/screenshots e2e `
  npx playwright test -c playwright.screens.config.ts
```

* `apps/web/e2e/screenshots/before/` — 16 routes × 1440 px and 390 px (full page + slices),
  admin dashboard/leads, `overflow.json`.
* `apps/web/e2e/screenshots/after/` — the same set on the production build of this branch.

## 6. Responsive verification (measured horizontal overflow, px)

| Width | Before | After |
| --- | --- | --- |
| 1440 / 1024 / 768 / 390 | 0 on all 16 routes | 0 on all 16 routes |
| 360 | services-bg 7, services-en 3 | 0 on all routes (re-measured after the fix) |

Visual review of slices at 1440 and 390 px: hero headline and primary CTA are in the first mobile
screen; workflow panel follows the CTA; no clipped text, overlapping elements or awkward last rows.

## 7. BG/EN verification

Both locales use the same components and receive equivalent layouts; all new strings live in the
typed content/dictionaries (`en` typed against `bg`). English headings wrap correctly in the bento
and hero; the header fits at 1024 px in English. The i18n unit tests (identical keys, no Cyrillic in
English, no raw keys) and the bilingual e2e spec (switcher, hreflang, canonical, `lang`) pass.

## 8. Build, lint and tests (executed 2026-10-24, `.\scripts\test.ps1`)

| Suite | Result |
| --- | --- |
| Production web build (`next build` in Docker) | succeeded, 76 static pages |
| TypeScript (`tsc --noEmit`) / ESLint | 0 errors / 0 findings |
| Vitest | 135 passed (9 files) |
| Pytest / Ruff (regression, backend untouched) | 245 passed / clean |
| Playwright e2e (desktop + Pixel 7) | 44 passed |

No Lighthouse/Core Web Vitals measurement was run for this iteration; no score is claimed. Client
JavaScript did not grow: all new homepage and service components are server components.

## 9. Remaining problems

* The mobile homepage is long (~18,000 px at 390 px) because every section stacks; a future pass
  could collapse capabilities and engagement into tabs or shorter lists on phones.
* Manrope's Cyrillic kerning is slightly uneven at mid sizes (titles in the problem index); a
  Cyrillic-specialised display face could be evaluated.
* Contact, advisor, process, industries and admin received token-level restyling, not new layouts.
* Screenshots were reviewed by the implementer only; no user testing.

## 10. Local URLs

http://localhost:3000/bg · http://localhost:3000/en · http://localhost:3000/bg/uslugi ·
http://localhost:3000/en/services · http://localhost:3000/bg/uslugi/ai-managed-services ·
http://localhost:3000/en/services/ai-managed-services · http://localhost:3000/bg/kontakti ·
http://localhost:3000/en/ai-automation-advisor · http://localhost:3000/admin

## 11. Configuration changes

None at runtime. `next/font` downloads JetBrains Mono at build time like the existing fonts (no
third-party requests from the browser — verified by the existing e2e check).

## 12. Recommended next improvements

1. Mobile-specific condensation of the long homepage sections.
2. Layout-level redesign of the contact and advisor pages (stepper for the advisor form).
3. Lighthouse + real-device check before launch; consider preloading only the display weight.
4. Real OG image in the new visual language.
