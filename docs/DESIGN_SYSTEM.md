# UI design system — "Precision Commerce × Intelligent Automation"

Source of truth: `apps/web/src/app/globals.css` (tokens + component classes) and
`apps/web/src/components/ui/primitives.tsx` (layout and content primitives). It replaces the
original V1 design-system notes (see git history before `42173f5`).

## Direction

A credible engineering studio, not an "AI agency": deep navy surfaces, one teal brand accent, a
periwinkle secondary used only for AI-related elements, a warm amber reserved for *human approval*,
and a light editorial surface that breaks the dark rhythm. Visuals are diagrams of real working
methods (workflows, approval gates, service-specific schemas), always labelled as illustrations —
never fake dashboards, metrics, logos or testimonials.

## Colour tokens

| Token (Tailwind name) | Value | Use |
| --- | --- | --- |
| `surface-page` / `ink-950` | `#080f19` | page background |
| `surface-1` | `#0d1724` | cards, raised sections (`tone="raised"`) |
| `surface-2` | `#111c2b` | icon wells, inputs on cards, nested panels |
| `surface-3` | `#192a3d` | active states |
| `surface-light` | `#edf3f4` | light editorial sections (`tone="light"`) |
| `fg` | `#f4f7fb` | headings, primary text (17.3:1) |
| `fg-secondary` | `#d3dee8` | body on dark (13.4:1) |
| `fg-muted` | `#a9b9c9` | supporting text (9.2:1) |
| `fg-subtle` | `#7d8fa3` | captions ≥ 12 px only (5.6:1) |
| `brand` | `#69d9df` | links, accents, primary button (11.3:1) |
| `brand-2` | `#83a9f9` | AI-specific elements only |
| `warning` | `#f2c46d` | human approval, alerts |
| `success` / `danger` | `#5fd4a0` / `#f47a8a` | status |
| `ink` / `ink-muted` / `brand-ink` | `#14232d` / `#45606e` / `#0f6f75` | text on the light surface (14.6 / 6.0 / 5.4:1) |
| `line-subtle` / `line-default` / `line-strong` | 12 % / 20 % / `#4d6178` | hairlines, borders, field borders (≥ 3:1) |

Compatibility: Tailwind's `slate`, `cyan`, `blue` and `violet` scales are re-tuned in `@theme` to the
brand neutrals/accents, so older utility classes follow the new identity. New code uses the semantic
names above. No component should hard-code hex values (the logo SVG is the documented exception).

## Typography

| Role | Face | Size / weight | Class |
| --- | --- | --- | --- |
| Display (hero H1) | Manrope 700 | clamp(2.35 → 4.15 rem), lh 1.02, −0.03em | `t-display` |
| Page H1 | Manrope 700 | clamp(2.15 → 3.6 rem) | `t-h1` |
| Section H2 | Manrope 700 | clamp(1.8 → 3 rem) | `t-h2` |
| Large H3 | Inter 600 | clamp(1.3 → 1.75 rem) | `t-h3-lg` |
| H3 | Inter 600 | 19 px | `t-h3` |
| Lead | Inter 400 | clamp(17 → 20 px), lh 1.65 | `t-lead` |
| Body | Inter 400 | 16 px, lh 1.6 | — |
| Labels, eyebrows, technical data | JetBrains Mono 400/500 | 12.5–13 px, sentence case | `t-label`, `t-eyebrow` |

* All three faces are loaded with `next/font` (self-hosted, Latin + Cyrillic).
* Manrope's Bulgarian localized glyphs (`locl`) are switched off for every Manrope usage so
  headings match Inter's standard Cyrillic forms; Manrope is used only at display sizes, small
  headings use Inter (better Cyrillic spacing at 16–20 px).
* No body-like text below 13.5 px; captions at 12 px only for metadata.

## Spacing, radius, elevation

* Container `max-w-[76rem]` with 16/24/32 px gutters.
* Section density: `compact` (48/64 px), `default` (64/96 px), `spacious` (80/112/128 px).
* Radius: `sm 6px` badges, `md 10px` buttons/inputs/icon wells, `lg 14px` cards, `xl 20px` panels.
* Elevation: hairline borders first; `--shadow-panel` only for floating panels (hero workflow, menus,
  CTA); `--shadow-lift` on hover for interactive cards.

## Components

| Component | File | Notes |
| --- | --- | --- |
| `Section` | `ui/primitives.tsx` | `tone`: `default` / `raised` / `light`; `density` |
| `Eyebrow`, `SectionHeading`, `PageHero` | `ui/primitives.tsx` | mono eyebrow with a square marker |
| Buttons (`btn-primary/secondary/ghost/danger`) | `globals.css` | solid teal primary, 10 px radius, ≥ 44 px tall (md/lg) |
| `FeatureIndex` | `ui/primitives.tsx` | rows with hairlines (instead of card grids) |
| `FeatureMatrix` | `ui/primitives.tsx` | hairline matrix for light sections |
| `ServiceShowcase` | `sections/ServiceShowcase.tsx` | curated service hierarchy: *AI & automation* (custom AI, automation, AI Managed Services) as large panels with a motif header, *core operations* as compact rows; groups derived from service keys (no hard-coded count) |
| `ServiceMotif` | `sections/ServiceMotif.tsx` | small per-discipline line drawing (decorative) |
| `ServiceConcept` | `sections/ServiceConcept.tsx` | service-page hero schema: cycle / tree / stack / flow / funnel / hub / checklist from the service's own workflow |
| `HeroWorkflow` | `home/HeroWorkflow.tsx` | product-style demo of a controlled automation (labelled demo data) |
| `AiPipeline` | `home/AiPipeline.tsx` | 5 stages + "AI may" / "requires approval" lanes |
| `ProcessSteps` | `home/ProcessSteps.tsx` | `vertical` (service pages, mono numerals on a rail) or `horizontal` (homepage timeline from `lg`) |
| `CredibilityStrip` | `home/CredibilityStrip.tsx` | compact capability strip under the hero (no logos, no numbers) |
| `ManagedFeature` | `home/ManagedFeature.tsx` | AI Managed Services feature: positioning, plans by audience with "custom quote", lifecycle diagram |
| `AdvisorShowcase` | `home/AdvisorShowcase.tsx` | product showcase on the light surface: how it works, sample input → structured output excerpt (labelled), link to the real tool |
| `ProblemIndex`, `CapabilityMatrix` | `home/*` | light editorial sections |
| `ArticleCard` | `editorial/ArticleCard.tsx` | `card` / `featured` / `row` variants |
| `AiOpsDiagram` | `sections/AiOpsDiagram.tsx` | horizontal or `vertical` (AI Managed hero) |
| `CtaBand` | `sections/CtaBand.tsx` | panel variant (inner pages) or `emphasis` (full-bleed display statement, homepage close) |
| `Footer` | `layout/Footer.tsx` | statement + CTA row, services (2 columns) / company / legal, meta row |
| Contact `FormGroup` | `contact/ContactForm.tsx` | numbered visual dividers: request → about you → project (fields keep their labels) |
| AI Managed sub-navigation | `uslugi/ai-managed-services/page.tsx` | sticky in-page nav under the header with a compact CTA; examples behind a `<details>` disclosure |

Colour semantics in diagrams: teal = system/integration, periwinkle = AI suggestion, amber = human
approval, green = completed outcome.

## Motion

Only where it explains: hover lift on interactive cards, the nav underline, the "flowing" dashed
connector in the hero workflow, accordion height. All motion is disabled under
`prefers-reduced-motion: reduce`; every diagram is complete and readable when static.

## Accessibility rules

* Text contrast ≥ 4.5:1 (values above); non-text UI ≥ 3:1 (`line-strong` for fields).
* Visible 2 px focus ring (`brand`, `brand-ink` on light surfaces).
* Touch targets ≥ 40 px (language links 36 × 40 px inside a 44 px group; buttons ≥ 44 px).
* Stretched-link cards keep the heading as the accessible name; decorative SVGs are `aria-hidden`.

## Composition rules (editorial redesign)

* No two consecutive sections share the same composition. The homepage sequence is: hero (split) →
  capability strip → curated services (panels + rows) → problem index (light) → full-width editorial
  headline with pipeline → AI Managed feature (raised, split) → horizontal timeline → product
  showcase (light) → editorial insights → FAQ (raised) → full-bleed closing statement.
* Light sections are used where contrast carries meaning (client problems, the product showcase,
  technical checks, principles), not alternated mechanically.
* Cards are reserved for things that are clickable or comparable (services, plans, articles);
  lists of facts use rows with hairlines (`FeatureIndex`) or matrices (`FeatureMatrix`).
* Uppercase is limited to tiny metadata; labels are sentence case.
