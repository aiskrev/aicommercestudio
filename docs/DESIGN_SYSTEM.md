# UI design system v2.1 — "Engineering editorial"

> **v2.1 (2026-10-27): consolidation, no redesign.** It moves the remaining hard-coded colours to
> semantic tokens and makes token use enforceable by tests. It also adds a `Tabs` primitive, fixes
> danger-button contrast, aligns paired form fields, and documents state coverage. Routes, i18n,
> SEO, admin, the forms, the Advisor and Managed Services are unchanged. See
> [Changes in v2.1](#changes-in-v21).

Source of truth: `apps/web/src/app/globals.css` (tokens + component classes),
`apps/web/src/components/ui/primitives.tsx` (layout and content primitives) and
`apps/web/src/components/ui/patterns.tsx` (composition patterns). v2 refines the v1 "Precision
Commerce × Intelligent Automation" system (commit `831fe81`) without renaming any existing token or
class, so every page keeps working; the changes are listed under [Changes in v2](#changes-in-v2).

## Direction

A product-minded AI engineering company, not an "AI agency" template:

* **Surfaces:** deep navy page, a near-black *deep* band for technical deep-dives, raised navy panels,
  and a **warm off-white paper** for editorial contrast sections (replaces the cool grey-blue of v1).
* **Colour discipline:** one teal accent (`brand`) for actions, links and system elements;
  periwinkle (`brand-2`) only for AI-specific elements; amber only for human approval; green only for
  completed outcomes. Gradients are limited to hairlines and a 5–7 % tint at the top of a panel.
* **Technical language:** mono labels, tabular indices (`01`, `02`), blueprint grids with corner
  registration ticks, description lists for facts. Diagrams show real working methods and are always
  captioned as illustrations — never fake dashboards, metrics, logos or testimonials.
* **Not used:** glassmorphism as decoration, neon glows, blurred colour blobs, robot imagery, stock
  "AI brains".

## Tokens

### Colour

| Token (Tailwind name) | Value | Use | Contrast |
| --- | --- | --- | --- |
| `surface-deep` | `#05080d` | near-black band (`tone="deep"`) | — |
| `surface-page` / `ink-950` | `#080f19` | page background | — |
| `surface-1` | `#0d1724` | cards, raised sections (`tone="raised"`) | — |
| `surface-2` | `#111c2b` | icon wells, nested panels | — |
| `surface-3` | `#192a3d` | active states | — |
| `surface-light` | `#f4f1ea` | warm paper sections (`tone="light"`) | — |
| `surface-light-2` | `#ebe6dc` | nested blocks on paper | — |
| `surface-paper-card` | `#fbfaf6` | `.card` on paper | — |
| `fg` | `#f4f7fb` | headings, primary text | ≥ 13:1 |
| `fg-secondary` | `#d3dee8` | body on dark | ≥ 10:1 |
| `fg-muted` | `#a9b9c9` | supporting text | 7.3:1 on `surface-3` |
| `fg-subtle` | `#8798ab` | captions, metadata | 4.9:1 on `surface-3`, 6.5:1 on page |
| `fg-placeholder` | `#8698ac` | input placeholders | 6.5:1 on page |
| `brand` / `brand-strong` / `brand-soft` | `#69d9df` / `#45c7ce` / `#a8ebee` | links, accents, primary button; badge text | 8.7:1 on `surface-3` |
| `brand-2` | `#83a9f9` | AI-specific elements only | 6.3:1 on `surface-3` |
| `warning` | `#f2c46d` | human approval, alerts | ≥ 8.9:1 |
| `success` / `danger` | `#5fd4a0` / `#f47a8a` | status, field errors | ≥ 5.5:1 |
| `ink` / `ink-muted` / `brand-ink` | `#14232d` / `#45606e` / `#0c6670` | text on paper | 14.2 / 5.9 / 5.9:1 (≥ 5.4:1 on `surface-light-2`) |
| `ink-line` | `#7a8a93` | field borders on paper | 3.2:1 (non-text) |
| `line-subtle` / `line-default` / `line-strong` | 12 % / 20 % / `#5a6e85` | hairlines, borders, field borders | `line-strong` 3.4:1 on `surface-1` |
| `line-hover` | `#71859c` | field border on hover | 4.8:1 on `surface-1` (non-text) |
| `on-brand` | `#06121c` | text on the primary button | 11.3:1 on `brand`, ≥ 10.5:1 on both hover stops |
| `brand-glow-a` / `brand-glow-b` | `#8fe5ea` / `#93c5fd` | primary-button hover gradient stops | — |
| `on-success` / `on-warning` / `on-danger` / `on-info` | `#c9f2df` / `#fbe8c2` / `#ffd4da` / `#d2f5f6` | text on status tints (badges, alerts, status chips) | ≥ 11.9:1 on their tint over `surface-1` |
| `danger-fill` / `danger-fill-hover` / `on-danger-fill` | `#c4384f` / `#b02f45` / `#fff` | destructive button | 5.2:1 / 6.3:1 (was 4.3:1 / 3.5:1); fill 3.7:1 against the page |
| `surface-paper-field` | `#fff` | fields, badges and secondary buttons on paper | — |
| `window-chrome` | `#3c4d60` | decorative window-control dots in product previews | decorative |

Compatibility: Tailwind's `slate`, `cyan`, `blue` and `violet` scales are re-tuned in `@theme` to the
brand neutrals and accents (for example, `slate-500` equals `fg-subtle`). The re-tuning exists only
for the admin area, which still uses them.

### Token discipline (enforced)

`components/ui/design-tokens.test.ts` fails when any of these rules breaks:

* **Public components and pages** (`components/**`, `app/**` except `components/admin` and
  `app/admin`) use semantic colour utilities only. No raw `slate-*`, `cyan-*`, `amber-*`,
  `emerald-*`, `rose-*`, `white` and so on.
* **No hard-coded hex values in public TSX.** The exceptions are the logo drawing (`Logo.tsx`,
  frozen), the generated OG image, and the `themeColor` metadata.
* **The component layer of `globals.css`** takes every colour from a token. The only literals are
  the frozen logo wordmark gradient and the `@property` initial values, which CSS requires to be
  literal.
* **The listed text pairs** stay ≥ 4.5:1 and the listed non-text pairs ≥ 3:1. The ratios are
  computed from the token values in the test.

The admin area still uses the legacy scale names (≈ 230 utilities). Migrating it is a follow-up; the
guard will then be extended to it.

Logo: the V1 monogram (`layout/Logo.tsx`) — an "A" in a cyan → blue → violet gradient-outlined tile
with a node at the top right, the same drawing as the favicon (`app/icon.svg`). The wordmark is
"A.I. Commerce" in Manrope 600 with "Studio" in the same gradient (`.logo-gradient-text`, plain
`CanvasText` in forced-colours mode). These gradient stops are the only place the violet appears;
`LogoMark` takes a `gradientId`, unique per page (the footer uses `logo-gradient-footer`).

The **favicon is SVG** (`app/icon.svg`), and the **compact mark** is `LogoMark`, the same drawing.
The logo, wordmark and favicon are frozen by owner decision. v2.1 did not change them.

### Typography

Fluid sizes are CSS variables on `:root` (`--type-*`), consumed by the `t-*` classes.

| Role | Face | Size / weight | Class |
| --- | --- | --- | --- |
| Display (hero H1) | Manrope 700 | `--type-display` clamp(2.35 → 4.15 rem), lh 1.02, −0.03em | `t-display` |
| Page H1 | Manrope 700 | `--type-h1` clamp(2.15 → 3.6 rem) | `t-h1` |
| Section H2 | Manrope 700 | `--type-h2` clamp(1.8 → 3 rem) | `t-h2` |
| Large H3 / sub-section | Inter 600 | `--type-h3-lg` clamp(1.3 → 1.75 rem) | `t-h3-lg` |
| H3 | Inter 600 | `--type-h3` 19 px | `t-h3` |
| Lead | Inter 400 | `--type-lead` clamp(17 → 20 px), lh 1.65 | `t-lead` |
| Body / small | Inter 400 | 16 px / 14 px | `t-body`, `t-small` |
| Labels, eyebrows, data | JetBrains Mono 500 | 12.5–13 px, sentence case | `t-label`, `t-eyebrow` |
| Indices, figures | JetBrains Mono 500, tabular | 12.5 px | `t-index` |

* Reading width: `.measure` (68ch) and `.measure-narrow` (56ch); `.prose-content` is capped at 68ch.
* Manrope's Bulgarian localized glyphs (`locl`) are off for every Manrope usage; small headings use
  Inter (better Cyrillic spacing at 16–20 px).
* Every page heading uses the scale — no one-off `text-3xl font-semibold` headings.

### Layout and rhythm

| Token | Value | Utility |
| --- | --- | --- |
| `--container-reading` | 44rem | `max-w-reading` / `<Container size="reading">` — articles, legal |
| `--container-narrow` | 60rem | `max-w-narrow` — forms, focused flows |
| `--container-content` | 76rem | `max-w-content` — default page width |
| `--container-wide` | 88rem | `max-w-wide` — full-bleed compositions |
| `--spacing-section-compact` | clamp(3 → 4 rem) | `py-section-compact` (`density="compact"`) |
| `--spacing-section` | clamp(4 → 6 rem) | `py-section` (`density="default"`) |
| `--spacing-section-spacious` | clamp(5 → 8 rem) | `py-section-spacious` (`density="spacious"`) |
| `--spacing-stack` | clamp(2.5 → 3.5 rem) | `mt-stack`, `gap-stack` — heading → content |

* Gutters: 16 / 24 / 32 px (`px-4 sm:px-6 lg:px-8`). Breakpoints are Tailwind's (`sm` 640, `md` 768,
  `lg` 1024, `xl` 1280); layouts are verified at 360, 390, 768 and 1440 px.
* **Overflow safety:** arbitrary `fr` grid tracks are written as `minmax(0, …fr)` so long Bulgarian
  words, URLs or code cannot widen a column; `body` sets `overflow-wrap: break-word`; `md`/`lg`
  buttons wrap their label below 480 px.

### Shape, elevation, focus, motion

* Radius: `sm 6px` badges, `md 10px` buttons/inputs/icon wells, `lg 14px` cards, `xl 20px` panels,
  diagram and tool frames.
* Elevation: hairline borders first; `--shadow-panel` for floating panels and frames,
  `--shadow-lift` (neutral, with a faint teal component) on hover, `--shadow-paper` for cards on paper.
* Focus: `--ring` (2 px `brand`; `brand-ink` inside `.surface-light`), offset 3 px. Composite
  links use `.card-interactive` or `.focus-frame` so the ring outlines the whole card/row; under
  `forced-colors` the ring falls back to a system colour outline.
* Motion tokens: `--duration-fast` 140 ms (buttons, fields), `--duration-base` 200 ms (cards, nav),
  `--duration-slow` 320 ms; easing `ease-out-soft`, `ease-standard`. Under
  `prefers-reduced-motion: reduce` all transitions/animations are cut, card hover lift is removed and
  `.motion-decorative` elements are hidden; every diagram is complete when static.

## Primitives (`ui/primitives.tsx`)

| Primitive | Props | Notes |
| --- | --- | --- |
| `Container` | `size`: `reading` / `narrow` / `content` (default) / `wide` | site gutters included |
| `Section` | `tone`: `default` / `raised` / `deep` / `light`; `density`; `size` | `alt` remains as a legacy alias for `raised` |
| `SectionHeading` | `eyebrow`, `title`, `lead`, `align`, `as` (`h1`–`h3`), `size` (`lg` / `sm`), `action` | `action` (link/button) sits right of the text from `lg`, below it on small screens |
| `Eyebrow`, `PageHero` | — | mono eyebrow with a square marker |
| `Button`, `ButtonLink`, `buttonClass` | `variant`: primary / secondary / ghost / danger / dangerOutline; `size` | ≥ 44 px tall (md/lg) |
| `Badge` | `tone`: neutral / accent / success / warning / outline; `dot` | `accent` remains as a legacy flag |
| `Alert` | `tone`: error / success / warning / info | |
| `Tabs` (`ui/Tabs.tsx`, client) | `id`, `label`, `items` (`value`, `label`, `count?`), `value`, `onChange`, `children` (panel) | WAI-ARIA tabs with automatic activation: one tab stop, ← → Home End move and select (wrapping), `aria-controls` / `aria-labelledby`, focusable panel. Styles `.tabs`, `.tab`, `.tab-count`, `.tab-panel`, with a paper variant. Used by Admin → AI approvals. |
| `FeatureCard`, `FeatureIndex`, `FeatureMatrix`, `CheckList`, `IconBadge`, `Skeleton` | — | unchanged APIs |

### Form fields (`globals.css`)

`field-label`, `field-required` (the visual `*`, with an `sr-only` "(required)"), `field-hint`,
`field-error`, `field`, `checkbox`. Hints and errors are wired with `aria-describedby`; invalid fields
set `aria-invalid`. Inside `.surface-light` fields switch to white with an `ink-line` border.
Used by `contact/FormField.tsx`, `contact/AiManagedFields.tsx`, `contact/ContactForm.tsx` and
`advisor/AdvisorTool.tsx`.

### Surfaces (`globals.css`)

`card`, `card-interactive`, `card-accent`, `card-quiet` (hairline only), `panel`, `surface-deep`,
`surface-light` (re-maps headings, `t-*`, cards, badges, fields, buttons and the focus ring to the
paper palette), `section-alt`, `grid-backdrop`.

## Patterns (`ui/patterns.tsx`)

| Pattern | Use | Where |
| --- | --- | --- |
| `EditorialSplit` | heading column (0.8fr) + content column (1.2fr) from `lg`; `sticky` keeps the heading in view; `ratio="even"` for 1:1 | FAQ sections (home, services, AI Managed), service problems and process, About mission, Process needs, AI solutions "not for" |
| `DiagramFrame` | technical figure: blueprint grid, corner ticks, mono title bar with optional `meta` (e.g. a "concept" badge), `figcaption` stating it is illustrative | `AiOpsDiagram`, `ServiceConcept` |
| `SpecList` | key/value facts as `<dl>`: mono labels, hairline rows; `columns={2}` | case study facts |
| `CaseStudyLayout` | numbered chapters (`01`, `02` …, each a labelled `<section>`) beside a sticky facts column | `/proekti/[slug]` (renders only verified, client-approved studies) |
| `ResultList` | measured outcome with its evidence (source + measurement date) beside the figure | case study results |
| `.tool-frame` | interactive tool surface: brand hairline at the top edge, faint tint | AI Automation Advisor form |

Usage example:

```tsx
<Section labelledBy="faq-title" tone="raised">
  <EditorialSplit sticky aside={<SectionHeading id="faq-title" eyebrow="FAQ" title={t.faq} />}>
    <Faq items={items} />
  </EditorialSplit>
</Section>

<DiagramFrame title={t.diagramTitle} titleId="ops-title" caption={t.illustrativeNote}>
  <ol>…</ol>
</DiagramFrame>
```

## Feature components

| Component | File | Notes |
| --- | --- | --- |
| `ServiceShowcase` | `sections/ServiceShowcase.tsx` | *AI & automation* as large panels, *core operations* as compact rows (rows use `.focus-frame`) |
| `ServiceMotif` | `sections/ServiceMotif.tsx` | small per-discipline line drawing (decorative) |
| `ServiceConcept` | `sections/ServiceConcept.tsx` | service hero schema (cycle / tree / stack / flow / funnel / hub / checklist) in a `DiagramFrame` |
| `SystemMap` | `home/SystemMap.tsx` | homepage hero: layers of an AI system (data → intelligence → agents → human approval gate → actions) with an operations rail; server-rendered HTML in a `DiagramFrame`, captioned as illustrative |
| `HeroWorkflow` | `home/HeroWorkflow.tsx` | product-style demo of a controlled automation (labelled demo data); used in the homepage solution-architecture section |
| `ControlLanes` | `home/ControlLanes.tsx` | "AI may do alone" (periwinkle) / "requires approval" (amber) / "always recorded" (green) next to the workflow |
| `OfferGroups` | `home/OfferGroups.tsx` | homepage capability groups: icon, title, the problem in one sentence, then one ≥ 44 px link per domain hub |
| `ToolsPreview` | `home/ToolsPreview.tsx` | the AI Automation Advisor with the `AdvisorPreview` product window, plus up to three further live tools. All seven tools are live; a planned tool would be shown as "in preparation" and never linked. |
| `ProcessSteps` | `home/ProcessSteps.tsx` | `vertical` or `horizontal` timeline |
| `CredibilityStrip`, `AdvisorPreview` | `home/*` | capability strip; Advisor sample input → output window |
| `ArticleCard` | `editorial/ArticleCard.tsx` | `card` / `featured` / `row` (row uses `.focus-frame`) |
| `AiOpsDiagram` | `sections/AiOpsDiagram.tsx` | horizontal or `vertical`, in a `DiagramFrame` |
| `CtaBand` | `sections/CtaBand.tsx` | panel or `emphasis` |
| `Footer`, `Header`, `LanguageSwitcher`, `Breadcrumbs` | `layout/*` | |
| Contact `FormGroup` | `contact/ContactForm.tsx` | numbered visual dividers: request → about you → project |

Colour semantics in diagrams: teal = system/integration, periwinkle = AI suggestion, amber = human
approval, green = completed outcome.

## Interaction system

All interaction styling lives in `app/globals.css` and the shared primitives; pages only apply
class names. No animation library and no extra client JavaScript (the scroll reveal is CSS-only).

| Token | Value | Use |
| --- | --- | --- |
| `--duration-press` | 90 ms | pressed state |
| `--duration-fast` | 160 ms | colour, border, focus, text links |
| `--duration-base` | 220 ms | transforms, shadows, cards, nav underline, menus |
| `--duration-slow` | 320 ms | mobile menu sheet |
| `--duration-reveal` | 420 ms | reference for larger transitions |
| `--ease-out-soft` / `--ease-standard` | `cubic-bezier(.22,1,.36,1)` / `(.2,0,0,1)` | entering & movement / state changes |
| `--lift` / `--lift-card` | −1 px / −2 px | hover lift for buttons / cards |
| `--press-scale` | 0.985 | pressed buttons (cards 0.995) |
| `--nudge` | 3 px | arrow/icon movement |

| Element | Hover (fine pointers only) | Keyboard focus | Pressed | Other states |
| --- | --- | --- | --- | --- |
| Primary button | lifts 1 px; fill interpolates brand cyan → `#8fe5ea`/`#93c5fd` (registered `@property --btn-a/--btn-b`, text ≥ 10:1); azure glow; arrow +3 px | 2 px ring + arrow +3 px | scale 0.985 | disabled 50 % opacity, no motion; loading = spinner + `aria-busy`, label swap, no icon |
| Secondary button | lifts 1 px, brand border, `surface-3`, soft shadow; arrow +3 px | ring + arrow | scale 0.985 | as above |
| Tertiary (ghost) | lighter colour, underline fades in (`.btn-label`) | underline + ring | scale 0.985 | — |
| Text link `.link` | brand → `brand-soft`, underline 35 % → 100 % | underline 100 % + ring | — | `.surface-light` uses `brand-ink` |
| Card `.card-interactive` | lifts 2 px, brand border, `surface-2`, lift shadow; `.arrow-nudge` +3 px | 2 px brand ring around the card (`:has(:focus-visible)`) | scale 0.995 | — |
| Rows `.focus-frame` + `group` | heading turns brand; arrow nudge | outline around the row; arrow nudge | — | — |
| Nav link `.nav-link` | underline grows at 45 % | underline at 45 % + ring | — | current page / open menu: underline 100 % |
| Services dropdown / mobile sheet | — | Escape closes, focus returns | — | `.menu-enter` / `.menu-sheet-enter` on open (fade + 6–8 px drop); closing is instant |
| Section headings, diagram frames | — | — | — | `.reveal`: fade + 16 px rise driven by `animation-timeline: view()` |
| Tab `.tab` | colour → `fg`, `surface-2` wash | inset 2 px ring | — | selected: `fg` + 2 px brand underline that scales in (`--duration-base`); paper: `brand-ink` underline |

Rules:
* Every hover rule written in CSS sits in `@media (hover: hover) and (pointer: fine)`; Tailwind
  `hover:` utilities already behave that way. Touch devices never get a stuck hover and nothing
  is reachable only by hover.
* Focus always shows a visible ring; anything that moves on hover also moves on keyboard focus.
* Only `transform`, `opacity`, colours and shadows animate.
* Reveals are progressive enhancement: without view timelines (e.g. Firefox today), with reduced
  motion, or when printing, content is simply shown. They are never applied to a page H1.
* `prefers-reduced-motion: reduce`: all transforms and entry/reveal animations are removed;
  colour and border feedback stay because they carry state.
* No infinite decorative animation was added (the existing flowing connector in the hero workflow
  remains the only loop and is reduced-motion aware).
* New interactive pieces reuse `.arrow-nudge`, `.link`, `.btn-*`, `.card-interactive`,
  `.focus-frame`, `.menu-enter` and `.reveal` instead of page-level `transition-*`/`hover:translate`
  utilities.

### State coverage

| Component | Active / selected | Loading | Disabled | Error / invalid |
| --- | --- | --- | --- | --- |
| `Button` / `ButtonLink` | pressed scale 0.985 | spinner + `aria-busy`, label swap, no icon | 50 % opacity, `not-allowed`, no motion | `danger` / `dangerOutline` variants for destructive actions |
| `.field`, `.checkbox`, `Select` | brand border + 3 px focus halo | — | 60 % opacity, `not-allowed` | `aria-invalid` → danger border and halo, `.field-error` linked with `aria-describedby` |
| `Tabs` | `aria-selected` + underline | the panel content shows its own loading state | — | — |
| Cards (`.card-interactive`) | lift + brand border; card-wide focus ring | `Skeleton` / tool `ToolState kind="loading"` | — | `ToolState kind="error"` with retry |
| Forms (contact, Advisor, tools) | — | submit button `loading` | — | error summary `Alert role="alert"` + focus to the first invalid field |
| Admin data views | — | `LoadingState` (skeleton rows + status text) | — | `ErrorState` with request id and retry |

Form layout rule: in a two-column field row, each field is a flex column whose control sits at the
bottom (`mt-auto`). The controls line up even when only one field has a hint (Advisor volume / team
size).

## Homepage composition

`app/[locale]/page.tsx`, content in `content/{bg,en}/home.ts` (EN typed against BG):

| # | Section | Tone | Composition |
| --- | --- | --- | --- |
| 1 | Hero — engineering and business value (AI · cloud · platforms · commerce), CTAs: **Book a consultation** (contact) and **Assess your AI readiness** (AI Automation Advisor), `SystemMap` | default + grid | asymmetric split |
| 2 | What we offer — four capability groups (`OfferGroups`: AI, Cloud and data, Platforms and operations, Commerce), each with the problem it solves and links to its domain hubs; "All services" | default, spacious | 2 × 2 cards; the ten hubs, never the individual services |
| 3 | Which tool first (`ToolsPreview`, the Advisor marked **Start here**) | raised, spacious | product window + live tool cards |
| 4 | After launch — AI Managed Services (the three packages from `ai-managed.ts`, "by individual quote"; CTAs: the service page and `#ams-inquiry`) | default | text + `card-accent` package list |
| 5 | Methodology — 5 stages (`ProcessSteps` horizontal) | raised | timeline |
| 6 | Solution architecture — "AI suggests. People decide." (`HeroWorkflow` + `ControlLanes`) | deep, spacious | statement + diagram split |
| 7 | Who builds it — founder introduction (`FounderPortrait`, ghost CTA) + `CredibilityStrip` ("Expertise you can check", technologies and practices, no logos or numbers) | default + surface strip | portrait + text split, then the strip |
| 8 | FAQ | raised | sticky `EditorialSplit` |
| 9 | Final CTA (`CtaBand emphasis`: contact + Advisor) | — | full-bleed statement |

The "What we build" bento and the use-case ledger were removed from the homepage: the capability
groups replace the bento (they lead to the ten domains instead of six services), and the use cases
added length without answering one of the four questions. The AI solutions page keeps the
AI-specific detail.

Honesty rules for the homepage:

* No client logos, testimonials or metrics.
* Diagrams are captioned as illustrative.
* Product previews use labelled demo data. There are no fabricated analytics.
* A tool that is not live is shown as "in preparation", without a link (registry: `lib/tools.ts`).

**Founder profile** (`/za-nas/osnovatel`): split hero with the approved portrait
(`components/sections/Founder.tsx`, `next/image`, 4:5 crop, `object-top`), five titled paragraphs
(not a timeline or skills list), the three-line closing statement in display type, services and
consultation CTAs, then the contact card. Contact details everywhere use
`components/sections/ContactDetails.tsx` (visible labels, descriptive accessible names, no
icon-only links). There are no badges, counters, logos or certification walls.

**Service catalogue** (`components/sections/Catalogue.tsx`, `CatalogueBrowser.tsx`,
`OfferingPage.tsx`, `StatusChip.tsx`): `OfferingCard` is the shared card: a type badge (Service,
Assessment, Workshop), the status chip only when an entry is not available, the name as a stretched
link, summary, then domain and duration as a small `dl`. The index filter uses `aria-pressed` type
buttons (shown only when more than one type exists) and a labelled native `select` for the domain;
the result count is an `aria-live` line, and an empty result offers "Show all". Hubs show a
`panel` empty state with a contact button instead of an empty grid. `ManagedRelation` is a
`card-accent` aside. The entry page follows the service template's hero and summary strip, without
the concept diagram, use cases or FAQ, which catalogue entries do not have.

## Composition rules

* No two consecutive sections share the same composition; use `tone` and `density` to vary rhythm.
  `deep` is reserved for technical deep-dives, `light` for sections where contrast carries meaning
  (client problems, product showcase, technical checks, principles).
* Section headers: `SectionHeading` everywhere (with `action` for "all services/articles" links);
  heading + long content side by side → `EditorialSplit`.
* Cards are for things that are clickable or comparable (services, plans, articles, case studies);
  lists of facts use hairline rows (`FeatureIndex`), matrices (`FeatureMatrix`) or `SpecList`.
* Diagrams go in a `DiagramFrame` with a caption that says what they are.
* Uppercase only for tiny metadata; labels are sentence case.

## Accessibility rules

* Text ≥ 4.5:1, non-text UI ≥ 3:1 — values in the colour table; re-check with the contrast script
  when a token changes.
* Visible focus on every interactive element; never `outline-none` on a link unless a parent
  `.card-interactive` / `.focus-frame` draws the ring (programmatic `tabIndex={-1}` targets excepted).
* Touch targets ≥ 40 px (buttons ≥ 44 px).
* Stretched-link cards keep the heading as the accessible name; decorative SVGs are `aria-hidden`.
* BG and EN content must both fit: test with the Bulgarian strings (typically 15–30 % longer).

## Changes in v2

* Warm paper (`#f4f1ea`) replaces the cool light surface; `brand-ink` darkened to `#0c6670`.
* New tokens: `surface-deep`, `surface-light-2` use, `surface-paper-card`, `fg-placeholder`,
  `brand-soft`, `ink-line`, container sizes, fluid section spacing, type-scale variables, measure,
  focus-ring and motion variables, `--shadow-paper`.
* Contrast fixes: `fg-subtle` `#7d8fa3` → `#8798ab` (was 4.4:1 on `surface-3`); `line-strong`
  `#4d6178` → `#5a6e85` (field borders were 2.8:1 on `surface-1`).
* Focus fixes: article rows and core service rows no longer hide the focus ring (`.focus-frame`);
  forced-colours fallback for card focus.
* New primitives/props: `Container size`, `Section tone="deep"`/`size`, `SectionHeading action/size`,
  `Badge tone/dot`, field classes; new patterns file.
* Pages moved onto the shared scale: About, Process, For whom, Contact, Legal, 404 headings; process
  step cards; case study pages; overflow-safe `minmax(0, …)` grid tracks on all public pages.

## Changes in v2.1

* **Tokens:**
  * New: `on-brand`, `on-success`, `on-warning`, `on-danger`, `on-info`, `danger-fill`,
    `danger-fill-hover`, `on-danger-fill`, `brand-glow-a/b`, `line-hover`, `surface-paper-field`,
    `window-chrome`.
  * The component layer of `globals.css` no longer contains hard-coded colours, apart from the
    frozen logo gradient and the `@property` initial values.
* **Semantic utilities:** 201 raw palette utilities in 27 public files (Advisor, contact forms,
  article body, legal page, AI solutions, contact, industries, header, product previews and others)
  were replaced by semantic tokens.
  * Exact equivalents render identically: `slate-200/400/500`, `cyan-200/300/400`.
  * Near equivalents: `slate-300` → `fg-secondary` (body text), `white` → `fg`, white overlays →
    `line-*` and `surface-*`.
  * Status colours: amber, emerald and rose → `warning`, `success` and `danger` (+ `on-*`).
* **Danger button contrast:** white on `#d6455a` was 4.3:1, and the hover `#e45a6e` was 3.5:1, both
  below AA for a 15 px label. They are now `#c4384f` (5.2:1) and a darker hover `#b02f45` (6.3:1).
* **`Tabs` primitive:** WAI-ARIA keyboard pattern. It replaces the admin AI-approvals filter, which
  had `role="tab"` without a tab panel and without arrow-key navigation.
* **Advisor form:** paired fields align their controls.
* **Enforcement:** `components/ui/design-tokens.test.ts` (palette, hex and contrast guards) and
  `components/ui/Tabs.test.tsx`.
* **Unchanged, by decision or because they were already in place:**
  * the logo, wordmark and favicon (owner decision);
  * typography scale, spacing, motion tokens, the interaction system and reduced-motion handling;
  * all routes, translations, SEO metadata and the admin, Advisor and Managed Services behaviour.
