# UI redesign report — premium editorial redesign

Date: 2026-10-24. Branch `design/premium-editorial-redesign`, created from `redesign/premium-ui`
@ `42173f5` (the first redesign, pushed but not merged; `main` still has the original design with the
orbital `HeroVisual` and uniform card grids). Frontend-only: no backend, database, API, routing or
SEO-logic changes. Not committed, pushed or deployed at the time of writing.

The first redesign is documented in [UI_IMPLEMENTATION_REPORT.md](UI_IMPLEMENTATION_REPORT.md); this
report covers the second, editorial pass. Design rules: [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## 1. Audit findings

Full table: [UI_AUDIT.md — Round 2](UI_AUDIT.md#round-2--editorial-redesign-brief-2026-10-24).
Main issues: the AI offering did not lead the service hierarchy; the AI Automation Advisor had no
product showcase; no homepage feature for AI Managed Services and no credibility strip; a long mobile
hero visual; a dense AI Managed Services page; a generic four-column footer; an ungrouped contact
form; dead code (`HeroVisual`); overuse of uppercase labels.

## 2. Screenshots (before → after)

Captured with Playwright/Chromium against the running stack (artefacts are git-ignored):

| Set | Path | Content |
| --- | --- | --- |
| Original design (`main`) | `apps/web/e2e/screenshots/before/` | 16 routes at 1440 + 390 px, overflow at 5 widths |
| Start of this pass | `apps/web/e2e/screenshots/baseline2/` | 10 key pages × 1440 / 1024 / 768 / 390 / 360 px |
| Result | `apps/web/e2e/screenshots/after2/` | the same 10 pages × 5 widths (production build) |
| Result, all routes + admin | `apps/web/e2e/screenshots/after2-all/` | 16 routes at 1440 + 390 px, admin login/dashboard/leads, overflow at 5 widths |

Key pages: BG/EN homepage, BG/EN services, BG/EN AI Managed Services, BG/EN contact, BG/EN advisor.

## 3. Main visual changes

**Homepage — new information architecture and rhythm** (each section a different composition):

1. Split hero with the product-style workflow window; on phones the window shows step titles and
   statuses only, so the CTA stays near the top.
2. **Credibility strip** — six capability groups (platforms, frameworks, integrations, cloud, AI,
   observability/security). No logos, no numbers.
3. **Curated services** — *AI & automation* (custom AI tools, process automation, AI Managed
   Services) as large panels with a discipline motif header; *core operations* (maintenance, SEO,
   analytics, integrations) as compact rows; audit offering as a dashed "first step" strip. Groups are
   derived from service keys; all seven links and localized slugs unchanged.
4. Light editorial **problem index** (problem → service).
5. Full-width editorial headline + **AI pipeline** with "AI may / requires approval" lanes.
6. **AI Managed Services feature** — positioning, plans by audience with "Custom quote", lifecycle
   diagram (conceptual), CTAs to the page and its inquiry form. No prices, SLAs or metrics.
7. **Horizontal process timeline** (vertical on mobile).
8. **Advisor product showcase** on the light surface — how it works, sample input → structured
   output excerpt, approval boundary, explicit "Example · demo mode" label and note, link to the
   real tool. The sample output matches what the demo engine produces for this input type.
9. Editorial insights (featured + rows). 10. FAQ. 11. **Full-bleed closing statement** with
    display-size type and one primary action.

Removed from the homepage (still available on dedicated pages): industries list (`/za-kogo`),
engagement formats (service pages, AI Managed plans), principles (`/za-nas`), the advisor banner
(replaced by the showcase).

**AI Managed Services page:** sticky in-page navigation with a compact CTA; value and audience as
index lists; monitoring split into "available now" vs "requires integration" with status colours;
maintenance boundary highlighted; quality criteria as rows and the illustrative evaluation examples
behind a disclosure; security principle as a pull quote; a mid-page CTA after cost optimisation;
incidents as numbered rows; calmer plan cards with a mono "Custom quote" line; plain-case comparison
table; scope as two columns; inquiry section on a raised surface. All content and the inquiry form
(and its backend integration) are unchanged.

**Services index:** the same curated grouping as the homepage.

**Footer:** statement + secondary CTA row, services (two columns) / company / legal groups, quiet
meta row. Contact details still render only when configured.

**Contact form:** numbered visual groups (request → about you → project), calmer panel, privacy and
consent block grouped, stronger success state. Validation, schema and API calls unchanged.

**Typography/system:** mono labels in sentence case; anchors offset below the sticky header and
sub-navigation; obsolete `HeroVisual.tsx` and `ServiceBento.tsx` removed with their dictionary keys.

## 4. Modified files

`app/[locale]/page.tsx`, `app/[locale]/uslugi/page.tsx`,
`app/[locale]/uslugi/ai-managed-services/page.tsx`, `app/globals.css`,
`components/contact/ContactForm.tsx`, `components/home/{HeroWorkflow,ProcessSteps}.tsx`,
`components/layout/Footer.tsx`, `components/sections/{CtaBand,ServiceCard}.tsx`,
`content/{bg,en}/{home,advisor}.ts`, `i18n/dictionaries/{bg,en}.ts`,
`e2e/visual/screenshots.spec.ts`; docs `UI_AUDIT.md`, `DESIGN_SYSTEM.md` (consolidated from
`UI_DESIGN_SYSTEM.md`), `UI_IMPLEMENTATION_REPORT.md`, this report.
Deleted: `components/sections/HeroVisual.tsx`, `components/sections/ServiceBento.tsx`.

## 5. New components

`components/sections/ServiceShowcase.tsx`, `components/home/CredibilityStrip.tsx`,
`components/home/ManagedFeature.tsx`, `components/home/AdvisorShowcase.tsx`; new variants:
`ProcessSteps layout="horizontal"`, `CtaBand emphasis`, contact `FormGroup`.

## 6. BG/EN verification

* All new copy is in the typed content/dictionaries for both locales (`advisor.showcase`,
  `home.servicesIntro.groups`, `form.groupRequest/About/Project`); the i18n unit tests (identical keys,
  no Cyrillic in English, no raw keys) pass.
* Both `/bg` and `/en` render the new layouts (screenshots at all five widths); the bilingual e2e spec
  (switcher on desktop and mobile, canonical, reciprocal hreflang, `lang`, localized validation,
  admin language) passes.

## 7. Mobile and responsive verification

Measured horizontal overflow (`overflow.json`): **0 px on all 16 routes at 1440, 1024, 768, 390 and
360 px.** Visual review of the slices found and fixed: the hero demo badge wrapping at 1024 px and
the "Core operations" label breaking at 768 px (re-measured after the fix).

## 8. Build and test results (executed 2026-10-24)

| Check | Result |
| --- | --- |
| `.\scripts\test.ps1` (full) | API 245 passed, Ruff clean, Vitest 135 passed (9 files), Playwright 44 passed |
| After the final layout fixes: `-Suite web`, `-Suite e2e` | 135 passed / 44 passed |
| Production build (in the web image) | succeeded |
| TypeScript / ESLint | 0 errors / 0 findings |

No Lighthouse measurement was run in this pass; no performance score is claimed. All new
components are server components (no added client JavaScript).

## 9. Known limitations

* Built on top of the unmerged `redesign/premium-ui`; merging this branch also brings in that work.
* The mobile homepage remains long because each section stacks; condensing for phones is a candidate
  next step.
* Advisor page layout itself (form + result) received token-level styling only.
* Manrope's Cyrillic kerning is slightly uneven at some mid sizes.
* Visual QA was done by the implementer from screenshots; no user testing.

## 10. Reviewing locally

```powershell
cd D:\Projects\Site
git switch design/premium-editorial-redesign
.\scripts\start.ps1
```

Then open http://localhost:3000/bg, http://localhost:3000/en,
http://localhost:3000/bg/uslugi/ai-managed-services, http://localhost:3000/en/contact and
http://localhost:3000/en/ai-automation-advisor. To regenerate the screenshots:

```powershell
docker compose --profile test build e2e
docker compose --profile test run --rm -e SHOT_LABEL=review -e SHOT_FULL=all `
  -v ${PWD}/apps/web/e2e/screenshots:/e2e/screenshots e2e `
  npx playwright test -c playwright.screens.config.ts
```
