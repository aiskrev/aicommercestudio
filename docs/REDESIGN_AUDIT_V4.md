# Public website redesign v4: audit and implementation plan

Status: **implemented** on branch `design/redesign-v4` (2026-11-03): phases 2–7, owner decisions D-1 blue
primary, D-2 dark-only public pages, D-3 hero copy unchanged, D-4 merged homepage sections. The
implementation report is §5. Baseline:
`main` @ `dcf41f9`. Current-state screenshots: `apps/web/e2e/screenshots/redesign-before/` (home BG/EN,
services, AI Managed Services EN, Advisor BG, contact, about; 1440 and 390 px; horizontal overflow 0
everywhere).

## 1. Audit

### 1.1 Current visual architecture

* **Design system v2.1 "Engineering editorial"** (DESIGN_SYSTEM.md):
  * tokens in `app/globals.css` `@theme`;
  * primitives in `components/ui/primitives.tsx`;
  * patterns in `components/ui/patterns.tsx`.
* **Palette and surfaces:**
  * a dark navy page (`#080f19`) with three raised surfaces, a near-black `deep` band and warm-paper
    `light` sections;
  * one teal accent (`brand` `#69d9df`), periwinkle (`brand-2`) only for AI elements, amber for human
    approval, green for outcomes.
* **Type and motion:**
  * Manrope (display), Inter (body) and JetBrains Mono (labels), all through `next/font`, self-hosted
    at build, with Cyrillic subsets;
  * a fluid type scale (`t-*` classes);
  * CSS-only motion with `prefers-reduced-motion` handling, verified by `motion.spec.ts`.
* **Honesty rules are already in place:** no logos, metrics or testimonials; diagrams captioned as
  illustrative; demo data labelled.
* **The logo, wordmark and favicon are frozen** (owner decision, CLAUDE.md). Their cyan → blue → violet
  gradient is the only place violet appears.

### 1.2 Reusable primitives (keep, evolve)

| Group | Primitives |
| --- | --- |
| Layout | `Container` (reading / narrow / content / wide), `Section` (tone, density, size) |
| Headings | `SectionHeading`, `Eyebrow`, `PageHero` |
| Actions | `Button`, `ButtonLink`, `buttonClass` |
| Status | `Badge`, `Alert` |
| Interaction | `Tabs` |
| Content | `FeatureCard`, `FeatureIndex`, `FeatureMatrix`, `CheckList`, `IconBadge`, `Skeleton` |
| Patterns | `EditorialSplit`, `DiagramFrame`, `SpecList`, `CaseStudyLayout`, `ResultList` |
| CSS classes | `.card*`, `.panel`, `.tool-frame`, `.field*`, `.link`, `.focus-frame`, `.reveal` |

### 1.3 Design tokens

* **Colours.** Over 40 semantic colour tokens with documented contrast ratios.
* **Scales.** Container widths, fluid section spacing, the type scale, radii, shadows, and motion
  durations and easings.
* **Enforcement.** `components/ui/design-tokens.test.ts` fails on:
  * raw palette utilities or hex values in public TSX;
  * hard-coded colours in the CSS component layer;
  * any listed text pair below 4.5:1 or non-text pair below 3:1.

The admin area still uses legacy scale names, mapped onto the brand.

### 1.4 Page hierarchy

* **Homepage** (`app/[locale]/page.tsx`, content in `content/{bg,en}/home.ts`), nine sections:
  1. hero with `SystemMap`;
  2. four capability groups (`OfferGroups`, ten domain hubs);
  3. tools (`ToolsPreview` with the Advisor);
  4. AI Managed Services;
  5. a five-step process;
  6. solution architecture (`HeroWorkflow` + `ControlLanes`);
  7. founder plus `CredibilityStrip`;
  8. FAQ;
  9. `CtaBand`.
* **Inner pages:**
  * ten domain hubs and nine service pages share one template;
  * AI Managed Services has a long sectioned page with in-page navigation;
  * also: the Advisor, the tools hub with 15 tools, the agent library, reference scenarios and
    patterns, workshops, insights, about and founder, process, industries, contact, the legal pages,
    404 and error states.
* **Length.** The homepage is about 12 viewport heights at 1440 px and about 21 at 390 px.

### 1.5 Duplicated or inconsistent styling (measured)

* **Arbitrary text sizes.** 107 occurrences of `text-[NNpx]` in public TSX (for example
  `text-[15px]`, `text-[14.5px]`), outside the `t-*` scale. Body-small sizes are therefore expressed
  in several ways.
* **Cards.** 38 public files apply `card` directly, so many sections render as walls of equal cards
  (homepage capability groups, tool cards, AMS lists, workshops, scenarios).
* **Raw sections.** 17 raw `<section>` elements in pages bypass `Section` (spacing and tone are
  hand-set).
* **Bug: header wrap.** At 1440 px the Bulgarian header wraps „За кого“ onto two lines: there are too
  many items for the bar with Bulgarian lengths.
* **Hero H1.** The Bulgarian hero H1 runs to five lines (about 330 px tall) and dominates the first
  screen. The brief asks for the opposite.
* **Empty gap.** There is a large empty area (about 150 px) between the hero and the next section on
  desktop.
* **Uniform rhythm.** Every section uses eyebrow → H2 → lead → content, left-aligned at 76rem. The
  mono eyebrow repeats 10+ times on the homepage.

### 1.6 Components to evolve

| Area | What to change |
| --- | --- |
| Header | `Header.tsx` (537 lines): compact the bar, fix the Bulgarian wrap, keep the mega-menu and its keyboard model |
| Hero | Smaller display scale and a clearer two-CTA hero. Keep the `SystemMap` idea, but make it a calmer "platform map" with layered boundaries |
| `OfferGroups` | Replace with a three-area capability narrative (AI Business Automation; Commerce & Platform Engineering; AI Managed Services) with unequal weight, still linking all ten hubs |
| `ToolsPreview` / `AdvisorPreview` | Become a dedicated Advisor product section: inputs → structured output → where a person decides, plus privacy notes from AI_ADVISOR.md |
| AMS homepage section | Becomes an operational lifecycle; `AiOpsDiagram` is reused on the AMS page |
| `ProcessSteps` | Seven-step delivery model, aligned with `/proces` |
| `CredibilityStrip` | An "engineering credibility" section (API-first, IaC, quality gates, data boundaries, human-in-the-loop) |
| `CtaBand` | Calmer final CTA |
| `Footer` | Grouped and compact |

Also:

* new primitives: `FeaturePanel` (large offering) and `CapabilityList` (hairline rows instead of
  cards);
* a "selected capabilities / example solution patterns" proof block reusing the reference scenarios
  and patterns;
* inner pages adopt the same hero, section rhythm and CTA, with no content rewrites.

### 1.7 Components that should remain unchanged

* **Frozen:** `Logo.tsx`, `app/icon.svg`, the founder portrait, `FounderPortrait`, `ContactDetails`,
  `lib/company.ts` and the founder profile content.
* **Forms:** `ContactForm`, `AiManagedFields`, the Advisor form and the tool wizards keep their
  behaviour, fields, validation, consents, honeypot, form token and API contracts. Only the visual
  layer is touched.
* **Routing and metadata:** `lib/locale-routing.ts`, `i18n/config.ts`, `lib/seo.ts`, the sitemap,
  robots and the JSON-LD builders.
* **Admin** (`components/admin`, `app/admin`): no marketing styling. Only shared primitives it
  already consumes may change, and only where they render identically.
* **Client portal** (`app/portal`): unchanged.

### 1.8 Accessibility-sensitive interactions

* Header mega-menu and Company menu: arrow keys, Home/End, Escape, outside click, `aria-expanded`,
  `aria-controls`.
* Mobile sheet: focus trap, accordion with one group open, focus return.
* Language switcher: keeps the equivalent page, BG/EN slug maps.
* Skip link; one H1 per page; `aria-current` in navigation.
* `Tabs`: the WAI-ARIA pattern.
* Forms: labels, `aria-describedby`, `aria-invalid`, an error summary with focus, `aria-live`
  success states.
* Advisor result: focus moves to the result heading.
* Card-wide focus rings (`.card-interactive`, `.focus-frame`) and the forced-colours fallbacks.
* Reduced motion (CSS plus `motion.spec.ts`).

### 1.9 Tests that protect important behaviour

* **Unit (Vitest, 779 tests).** These pin markup and texts:
  * `design-tokens.test.ts` (token discipline, contrast);
  * `Header.test.tsx` (menus, keyboard, migration of every destination);
  * `home.test.tsx` (homepage groups link the ten hubs; no numbers, logos or ratings);
  * `domains.test.ts`, `content.test.ts`, `seo-map.test.ts`, `routing-and-seo.test.ts`,
    `i18n.test.ts` (no Cyrillic in EN; key parity);
  * the form and component tests, `company.test.ts`, `protected-content.test.ts`.
* **e2e (Playwright, ~180 tests).** `public`, `ia`, `mobile` (31 pages, no overflow), `seo` (every
  sitemap URL), `links`, `i18n`, `contact`, `advisor`, `domains`, `founder`, `motion`, `workshops`,
  `reference` and others. They select by role, label and test id, so restyling is safe as long as
  roles, names and test ids are kept.

### 1.10 Risks

| Risk | Mitigation |
| --- | --- |
| Header rework breaks keyboard or menu behaviour | change styling and layout only; keep the component logic; run `Header.test.tsx`, `ia.spec.ts` and `mobile.spec.ts` after phase 3 |
| Homepage restructure fails `home.test.tsx` (ten hub links, no numbers) | the new capability narrative still links every hub; update tests only where the structure changes intentionally, never to weaken a rule |
| Token changes break contrast | change values through the token test; run the contrast script |
| Bulgarian strings overflow new layouts | verify at 360/390/768/1024/1440 in both languages (`mobile.spec.ts` plus screenshots) |
| Copy changes become positioning changes | business decision: see §4 |
| SEO regressions (H1 text, keyword map) | `seo-map.test.ts` pins one primary keyword per page and requires the keyword in the title; H1 text changes need the keyword-map update |
| One huge diff | phases with their own commits; screenshots before and after each phase |

## 2. Proposal

### 2.1 Tokens and typography

* **Keep the token architecture and names.**
  * Surfaces: `surface-page` → `#06101d`, `surface-1` → `#0c1929`, `surface-2` → `#101f32`, with
    contrast re-verified.
  * Text: `fg` is already `#f4f7fb`. `fg-secondary` softens towards `#a8b4c5` for body copy only if
    it stays ≥ 7:1.
  * Add semantic aliases the brief names (`accent-secondary`, `section-divider`,
    `gradient-subtle`), mapped to existing values where possible.
* **Accent.** The brief proposes electric blue `#3B82F6` as primary and cyan `#22D3EE` as secondary;
  today the primary is teal `#69d9df`. This is a brand decision (§4, D-1). On dark navy, `#3B82F6`
  as text is about 5:1, but white text on a `#3B82F6` button is about 3.7:1 (fails AA for normal
  text), so a blue primary button would need dark text or a deeper blue (`#2563EB` with white ≈ 5.2:1).
* **Light sections.** Warm paper is used today for client problems, the product showcase,
  technical checks and principles. The brief asks for a consistently dark enterprise language. The
  proposal is to retire paper sections on public pages, replaced by `raised` and `deep` tones (§4,
  D-2).
* **Typography.**
  * Keep Manrope, Inter and JetBrains Mono: verified Cyrillic, self-hosted by `next/font`, no new
    dependency.
  * Reduce `--type-display` to about clamp(2.1 → 3.4 rem) with lh 1.05, so the Bulgarian hero H1
    fits in two to three lines at 1440 px.
  * Reduce the mono eyebrow use (once per page region, not every section).
  * Replace the 107 `text-[NNpx]` sizes with scale classes (`t-body`, `t-small`, a new `t-caption`).

### 2.2 Component mapping

| Brief family | Repository implementation |
| --- | --- |
| Container, Section, SectionHeading, Eyebrow | evolve the existing primitives (rhythm variants; heading `align` and size already exist) |
| Button, TextLink | `Button`, `ButtonLink`, `.link` (unchanged APIs, refined tokens) |
| FeaturePanel, CapabilityCard | new `FeaturePanel` in `primitives.tsx`; `CapabilityList` (hairline rows) in `patterns.tsx` |
| ProductPreview | evolve `AdvisorPreview` (real form fields, labelled sample output) |
| ArchitectureVisual, TrustBoundaryDiagram | evolve `SystemMap` (layered platform with an approval boundary) inside `DiagramFrame` |
| ProcessSteps | `ProcessSteps` (seven steps, vertical on mobile) |
| CTASection | `CtaBand` |
| FormField, StatusMessage | existing `field*` classes, `Alert`, `ToolState` |
| SiteHeader, MobileNavigation, LocaleSwitcher, SiteFooter | `Header.tsx`, `LanguageSwitcher.tsx`, `Footer.tsx` (restyle, same logic) |

### 2.3 Homepage information architecture (target)

| # | Section | Content source | Notes |
| --- | --- | --- | --- |
| A | Header | nav model unchanged (`lib/site-nav.ts`) | compact, no Bulgarian wrap, same CTA |
| B | Hero | `home.hero` | headline, supporting paragraph, consultation + Advisor CTAs, platform map. **New headline copy needs D-3** |
| C | Capability narrative: 1 AI Business Automation · 2 Commerce & Platform Engineering · 3 AI Managed Services | the existing domain texts; links to all ten hubs | one large panel plus two medium, not equal cards |
| D | Advisor as a product | AI_ADVISOR.md, `advisor.showcase` | inputs, output, human review, privacy, start CTA |
| E | AI Managed Services lifecycle | `ai-managed.ts` areas | the six-stage loop of the brief, mapped to existing areas (§2.4) |
| F | Engineering credibility | `home.capabilities` plus SECURITY/ARCHITECTURE facts | concise technical statements, no logo cloud |
| G | Delivery model | `/proces` steps | seven steps, aligned with the process page |
| H | Proof | reference scenarios, integration patterns, workshops, published articles | "example solution patterns", all labelled fictional or illustrative; no case studies exist |
| I | Founder (kept) and FAQ (kept) | unchanged content | founder block untouched |
| J | Final CTA | `CtaBand` | "Discuss an AI automation opportunity" plus Advisor |

### 2.4 AI Managed Services lifecycle mapping (no new commitments)

| Brief stage | Existing content it maps to |
| --- | --- |
| Discover | the initial technical assessment (AI_MANAGED_SERVICES.md, "Assessment first") |
| Onboard | onboarding / access and documentation in the AMS levels |
| Observe | monitoring and reliability; agent execution visibility; cost and token usage |
| Evaluate | quality evaluation; human review |
| Optimize | continuous optimisation; AI cost optimisation |
| Govern | security and governance; incident response |

Every label links to the existing AMS page section. No package, SLA, price or response time is added.

### 2.5 Phases (each phase its own commit and checks)

| Phase | Scope | Checks |
| --- | --- | --- |
| 1 | This audit, screenshots and decisions (§4) | — |
| 2 | Tokens, typography scale, `t-caption`, the arbitrary-size cleanup, `FeaturePanel`, `CapabilityList`, focus/hover states | token test, typecheck, lint, unit |
| 3 | Header (compact, Bulgarian wrap fixed), mobile sheet, footer, language switcher styling | `Header.test.tsx`, `ia`, `mobile`, `i18n` e2e |
| 4 | Homepage A–J | `home.test.tsx`, `public`, `seo`, `links`, `motion`, screenshots BG/EN |
| 5 | Inner pages: hubs and services template, AMS, Advisor flow, about and founder (layout only), contact, legal, 404 and error, loading and empty and success states, tools, workshops, reference, insights | all e2e, screenshots |
| 6 | Responsive, accessibility (keyboard, contrast script), reduced motion, metadata check, Lighthouse sample (local, measured) | mobile, motion, seo; Lighthouse |
| 7 | Full suites, before/after screenshot set, DESIGN_SYSTEM.md v3 section, implementation report, PR | everything |

The admin area is not restyled. If a shared primitive changes, the admin screenshots are compared,
and any visible change is listed in the report.

## 3. What the brief asks that is already true

These are kept, not rebuilt:

* the dark navy enterprise palette;
* no robot imagery or fake proof;
* captioned diagrams;
* CSS-only motion with a reduced-motion test;
* semantic tokens enforced by a test;
* self-hosted fonts with Cyrillic;
* server rendering by default;
* no third-party scripts;
* bilingual routes and metadata.

## 4. Decisions needed before phase 2 (owner)

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D-1 | Primary accent | (a) keep teal `#69d9df`, refined; (b) electric blue as primary (`#2563EB` buttons with white text, `#3B82F6`/`#60A5FA` for text and lines) and cyan secondary, as the brief suggests | **(b) blue primary + cyan secondary**. It matches the brief and the logo's own cyan → blue gradient, so the frozen logo sits naturally. Teal remains only as cyan |
| D-2 | Warm-paper light sections on public pages | keep / retire | **retire** (consistent dark language); `deep` and `raised` carry the rhythm |
| D-3 | Positioning of the hero and audience | (a) keep today's copy, written for small and medium businesses; (b) the brief's direction ("Design, build and operate AI-powered commerce systems", enterprise buyers) | Owner call. It changes who the site speaks to and the homepage keyword (open decision D7 in PLATFORM_VISION.md) |
| D-4 | Homepage length | keep all nine current sections plus the new ones, or merge (tools → Advisor section; architecture → credibility) | **merge** to about 9 viewport heights on desktop |

## 5. Implementation report

### 5.1 Owner decisions applied

| # | Decision | Applied |
| --- | --- | --- |
| D-1 | Blue primary, cyan secondary | `brand` `#60a5fa` (text, lines, focus), `brand-fill` `#2563eb` (white text, ≈ 5.2:1), `brand-2` `#22d3ee` (AI elements) |
| D-2 | Retire paper sections | the four public paper sections moved to the raised tone with dark-palette text |
| D-3 | Keep the hero copy | headline, lead, CTAs and highlights unchanged |
| D-4 | Merge homepage sections | tools merged into the Advisor section (other tools as one compact row); architecture and practices form one credibility block. The page did **not** shrink to the ~9 viewport heights targeted: it is about 13 at 1440 px (12 before), because the brief adds the Advisor facts, the AMS lifecycle and the solution patterns |

### 5.2 Commits

| Phase | Commit | Content |
| --- | --- | --- |
| 2 | `59f04d7` | tokens, type scale, text-size utilities (106 values in 46 files), dark-only public surfaces, contrast pairs added to the token test |
| 3 | `bf603a6` | header labels never wrap (fixes the Bulgarian wrap at 1440 px), footer regrouped into five columns |
| 4 | `0449a8f` | homepage: `CapabilityAreas`, Advisor product section, `ManagedLifecycle`, credibility block, delivery model, `SolutionPatterns` |
| 5–7 | this commit | inner pages verified (they inherit the system; no structural changes needed beyond the paper sections), DESIGN_SYSTEM.md v3, this report |

### 5.3 Checks executed

| Check | Command | Result |
| --- | --- | --- |
| Web typecheck, ESLint, Vitest, parity checks | `.\scripts\test.ps1 -Suite web` | **780 passed** (49 files), tsc and ESLint clean, parity checks passed. A first run failed 2 tests on Vitest's 5 s timeout while another session ran its suites on the same Docker host; both passed alone (22/22) and the full re-run on a quiet machine passed |
| Full e2e (desktop Chromium + mobile), staff role accounts, demo organisation | `run_e2e_roles.ps1` (the `test.ps1 -Suite e2e` steps with a host-port override) | **185 passed, 1 skipped** (`portal.spec.ts`, which skips while the portal is off), 0 failed, 9.8 min; includes `motion.spec.ts` (reduced motion), `mobile.spec.ts` (31 pages without overflow), `seo.spec.ts`, `links.spec.ts`, `i18n.spec.ts` |
| Horizontal overflow | screenshot capture at 1440, 1024, 390 px | 0 px on every captured page (17 pages) |
| Lighthouse (production build, one run per route and preset) | `perf/lighthouse.mjs` (label `redesign-v4`) | accessibility **100** and SEO **100** on all 8 measurements; desktop performance 94–100; mobile performance 81–89 (`/bg` 81, the same as the 2026-10-27 release baseline); CLS ≤ 0.012; best practices 74, unchanged from the baseline |
| API | not run | no API code changed |

### 5.4 Visual review

Screenshots (local, not committed):

* `apps/web/e2e/screenshots/redesign-before/` and `v4-p4c/`: home BG/EN at 1440 and 390 px;
* `v4-p5a/`: 15 inner pages;
* `v4-final/`: mobile navigation, the Advisor form and demo result, AMS.

Reviewed in both languages:

* the header on one line;
* the hero in four lines;
* the three areas with unequal weight;
* the lifecycle links;
* the fictional labels on the patterns;
* the dark former paper sections;
* forms and the admin login.

### 5.5 Admin boundary

The admin area was not restyled. Through the shared primitives it shows two changes:

* the primary button is blue with white text;
* the surfaces are slightly darker.

Layout, density, tables, filters, workflows, authentication and the API are unchanged.

### 5.6 Known limitations and next steps

* Homepage length (D-4) is not reduced. Further cuts would remove required content; a later
  iteration could move the delivery model to `/proces` only.
* The mobile hero `SystemMap` is about one viewport tall at 390 px.
* Lighthouse ran once per route (not the median of three) because of time.
* Best practices stays at 74, as before. The cause (local HTTP and other environment items) predates
  this work.
* The copy remains SMB-oriented (D-3). An enterprise repositioning is a separate owner decision
  (PLATFORM_VISION D7).
* Not yet done: a native-speaker review of the new BG/EN homepage copy (C-1).
