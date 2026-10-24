# Visual direction v3 — "Signal"

Status: proposal (no code changed). Builds on design system v2 (`docs/DESIGN_SYSTEM.md`,
branch `design/system-v2`). **The logo is out of scope and must not change**: the V1 monogram and the
gradient "Studio" wordmark (`components/layout/Logo.tsx`, `app/icon.svg`) stay exactly as they are.
The implementation prompt for Claude Code is in `docs/prompts/VISUAL_V3_CLAUDE_PROMPT.md`.

Contents

0. [Summary](#0-summary)
1. [Research: patterns worth taking](#1-research-patterns-worth-taking)
2. [Deliverable 1 — Critique of the current direction](#2-deliverable-1--critique)
3. [Where I disagree with the brief](#3-where-i-disagree-with-the-brief)
4. [Deliverable 5 — Three directions and the recommendation](#4-deliverable-5--three-directions)
5. [Deliverable 2 — The visual direction](#5-deliverable-2--visual-direction-signal)
6. [Deliverable 4 — Signature elements](#6-deliverable-4--signature-elements)
7. [Deliverable 3 — Homepage, section by section](#7-deliverable-3--homepage-section-by-section)
8. [Deliverable 6 — Implementation specification](#8-deliverable-6--implementation-specification)
9. [Sources](#9-sources)

---

## 0. Summary

The site is credible but static: it *describes* AI systems with text, cards and labelled
illustrations. v3 makes it *behave* like one. Three moves do most of the work:

1. **Colour becomes light.** The cyan → azure → violet spectrum already lives in the logo. v3 turns
   it into the brand's energy signal: it appears where something is *active* (a primary action, a
   live connection, the current phase, a focused node) and nowhere else. The canvas gets darker and
   gains ambient light fields, so the spectrum has something to glow against.
2. **Depth becomes hierarchy.** Seven surface levels, from recessed telemetry wells to floating
   menus, replace "background + identical dark card".
3. **The homepage becomes a running system.** The hero is an *AI System Core*: a layered
   architecture object (data → intelligence → agents → operations, gated by human control) with
   light moving through it. Further down, an approval gate that holds the flow, an operations
   telemetry surface (clearly demo data) and an agent constellation replace three more card grids.

Recommended direction: **B — Bold AI Engineering**, tempered with A's restraint (section 4).
3D: one true-3D-looking object (the core), built first as server-rendered SVG with CSS motion
(LCP-safe, ~0 KB JS), with WebGL kept as an optional, measured upgrade, not a dependency.

---

## 1. Research: patterns worth taking

Method: web search and page fetches across premium AI, developer, infrastructure, observability
and agent-platform products (live screenshots could not be captured from this environment, so
claims about specific sites are limited to what the sources below state). The table lists the
pattern, what it achieves, and the verdict for AI Commerce Studio.

| # | Pattern (where it appears) | Why it works | Verdict for AICS |
| --- | --- | --- | --- |
| R1 | **Product as the hero.** Linear's homepage alternates short statements with full-width product UI (backlog, roadmap, agent chat, code review) rather than illustrations or bento cards. | The visitor sees the product working; trust comes from specificity. | **Adopt.** Our "product" is systems we build: show them as working surfaces (pipelines, telemetry, approval gates), not icons in boxes. |
| R2 | **Figure labels / documentary tone.** Linear numbers feature visuals "Fig 0.1 … 0.3". | Engineering-drawing language signals precision without adding colour. | **Adopt.** Fits our mono labels: every diagram gets `FIG 01 · Approval gate`. |
| R3 | **Lifecycle as the spine.** LangChain structures its page around a six-stage agent lifecycle (Build → Test → Deploy → Monitor → Iterate → Govern). | One mental model organises many products. | **Adapt.** Our lifecycle (Discover → Design → Build → Deploy → Operate → Improve) becomes the hero's phase rail and the process section, one continuous object. |
| R4 | **Material/elevation scale.** Vercel's Geist defines surface materials (base → small → medium → large) and floating materials (tooltip → menu → modal → fullscreen) with their own radii. Linear builds elevation from black/white opacity steps and generates themes in LCH from base, accent and contrast inputs. | Depth reads as hierarchy, not decoration; themes stay consistent. | **Adopt.** Seven named surface levels (section 5.4); define colours perceptually (OKLCH) so spectrum steps look evenly bright. |
| R5 | **Restraint is the current premium signal.** Linear's 2025 site cut colour back toward black/white with a few bold accents; a community Vercel spec reserves its multicolour mesh gradient for hero scale only. | Colour carries meaning because it is rare. | **Adopt as the rule for the spectrum.** "More colour" here means *brighter, rarer* colour, not more coloured areas. |
| R6 | **Shader backgrounds.** Stripe-style animated gradients run as full-screen WebGL fragment shaders; developers report noticeable battery cost. | Memorable, but expensive and now common. | **Reject** a page-wide shader. Use static CSS light fields with slow transform-only drift. |
| R7 | **Border light / spotlight cards.** Pointer position in CSS custom properties (updated from `requestAnimationFrame`, no React re-render), radial gradient masked to the border with `mask-composite`; decorative, with a static state for touch, keyboard and reduced motion. | Makes interactive surfaces feel alive at near-zero cost. | **Adopt** for interactive card families only (not for static content). |
| R8 | **Node canvases for agents.** Agent builders converge on: dark/neutral canvas, glowing connectors, node palette left, configuration drawer right, every node shows input/output. | It is the native visual language of agent systems. | **Adopt** for Build Your AI Team and Architecture Builder, but as *visualisations of accessible form state*, never drag-only. |
| R9 | **Decorative "orchestration" art.** Temporal illustrates durable execution with stylised vector graphics and a demo video rather than diagrams of the mechanism. | Pretty, but explains little. | **Avoid.** Every AICS visual must show the real mechanism (what flows, where it stops, who approves). |
| R10 | **Motion with an off switch.** 2026 trend writing stresses purposeful motion and giving users a way to stop it (reduced-motion settings). | Credibility and accessibility. | **Adopt.** Any ambient loop gets a pause control and honours `prefers-reduced-motion`. |
| R11 | **Typed gradient animation.** Registering colour stops with `@property` lets browsers interpolate gradients (all major engines incl. Firefox ≥ 128). | Smooth colour flow on buttons with no JS. | **Adopt** for the primary CTA (section 8.4). |
| R12 | **Scroll-driven animation.** Shipped in Chrome/Edge (2023) and Safari 26 (Sep 2025); Firefox still behind a flag (Interop 2026 target). | Scroll reveals with zero JS. | **Adopt as progressive enhancement** under `@supports (animation-timeline: view())`; content is never hidden when unsupported. |
| R13 | **3D heroes done responsibly.** Keep a static poster/SSR fallback as the LCP element, mount the canvas after first paint, pause the render loop off-screen (IntersectionObserver), adapt DPR when frame rate drops, use compressed assets on mobile. | 3D without wrecking Core Web Vitals. | **Adopt** if/when the WebGL upgrade ships (phase 8). |

---

## 2. Deliverable 1 — Critique

Based on the v2 screenshots (`apps/web/e2e/screenshots/system-v2/`, 20 pages × 5 widths) and the code.

### 2.1 Why it does not emotionally grab the visitor
* **Nothing is alive.** Every visual is a static, captioned illustration: the hero workflow, the
  AI pipeline, the ops diagram. They are honest ("sample data", "conceptual diagram") but inert. The
  page explains a working system without ever *being* one.
* **No light source.** The palette is one teal accent on navy at a single brightness. There is no
  luminance range: nothing is brighter than the primary button, nothing glows, nothing recedes. Dark
  UIs need light to have mood; this one only has colour.
* **The hero has no focal object.** Left: a good headline. Right: a vertical list of five cards in a
  window frame. The eye has nowhere to land, and the right side reads as more text.
* **Product ambition is invisible.** The platform will have tools, a portal, telemetry and billing,
  but the homepage shows services as a catalogue. The visitor cannot feel "they build serious
  systems" because no system is shown at system scale.

### 2.2 What feels generic
* Icons in 40 px rounded squares next to a title and two lines of copy (credibility strip, core
  operations rows, problem index, AI pipeline). It is the default SaaS template unit.
* "Eyebrow → H2 → lead → content" for every section, always left-aligned, always 76rem wide.
* The section heading copy pattern ("Seven disciplines, one technical partner", "A clear process
  from the first conversation to stable operation") is agency language, not engineering language.
* Teal-on-navy itself: competent, but it is the palette of a hundred dev-tool landing pages.

### 2.3 What feels flat
* Two surface levels in practice (`surface-page`, `surface-1`) plus hairlines. Panels, cards and
  diagram frames are all the same brightness, with the same 1 px border and nearly the same radius.
* The background is identical from hero to footer apart from the warm paper bands.
* Shadows exist only as dark drop shadows; there is no light *on* anything.

### 2.4 What feels repetitive
* Three equal columns (AI & automation panels, plans, articles), then two equal columns of rows,
  then a five-step horizontal line, then a four-step horizontal line (process). Two horizontal
  timelines on one page.
* The same mono eyebrow with a square marker appears 10+ times on the homepage.
* Every section has identical vertical padding, so the scroll has no tempo.

### 2.5 What feels too corporate
* Copy-led sections with "Learn more" CTAs (also an SEO issue already logged).
* Plans shown as a bordered table with "Custom quote" repeated three times.
* Pastel paper bands give a consultancy-brochure feel in the middle of a technical page.

### 2.6 What must not change
* **The logo** (owner decision).
* Honesty rules: demo/synthetic labelling, no fabricated metrics, testimonials or logos.
* The information architecture, BG/EN parity, typed content, routes and SEO work.
* Accessibility baseline: AA contrast, visible focus, reduced motion, 44 px targets.
* The colour *semantics*: amber = human approval, green = done/healthy, rose = problem.
* Mono technical metadata and the editorial typography scale (it just needs more range).

### 2.7 Highest visual potential
1. **Human approval.** It is the brand's real differentiator and it already has a colour (amber).
   It deserves a signature visual: flow that visibly stops at a gate.
2. **AI operations.** Monitoring, incidents, cost and quality can be shown as a credible telemetry
   surface; it is the most "product" thing the company sells.
3. **The lifecycle.** Discover → Improve is the company's method; it can be the hero's spine.
4. **The logo spectrum.** cyan → blue → violet is already the owner's chosen identity; the site
   ignores it everywhere except the logo.

### 2.8 What should become a recognisable signature
See section 6: the Spectrum signal, the AI System Core, the Approval Gate, Telemetry strips with
figure labels, and border light on interactive surfaces.

---

## 3. Where I disagree with the brief

| Brief asked for | Risk | What I propose instead |
| --- | --- | --- |
| Hover fill that flows cyan → **electric** blue → **electric** violet | With dark button text, `#3b82f6` gives 5.1:1 and `#8b5cf6` only **4.46:1 — fails AA**. White text fails on `#3b82f6` (3.7:1). | Interpolate across the *light* stops `#67e8f9 → #60a5fa → #a78bfa` (min **6.95:1** with `#06121c` text). Put the saturated `#3b82f6 → #8b5cf6` only into the glow and the 1 px border light, where it is not behind text. |
| Subtle **scale** on hover | Scaling text causes sub-pixel blur and layout jitter in rows of buttons. | `translateY(-1px)` + scale **1.01** max, primary CTA only. Press: **0.985**. |
| **Magenta / pink** accents | Collides with rose (`#f47a8a`) = incident/error; reads "consumer/crypto". | Not adopted. If ever needed, only as the far end of the hero light field at ≤ 6 % opacity. |
| **3D** everywhere | WebGL in the hero risks LCP/TBT on mobile and looks like a template if generic. | **One** 3D-looking object (the core) built in SVG/CSS isometric projection: same depth, ~0 KB JS. WebGL becomes an optional desktop upgrade only if it measurably adds value. |
| **More motion** | Ambient motion everywhere reads as "AI-generated site" and costs battery. | Motion budget: heavy motion in 4 places only (hero, approval gate, telemetry, agent constellation). Everything else is instant feedback ≤ 200 ms. Ambient loops pause off-screen and have a pause control. |
| Stronger colours **everywhere** | Colour loses meaning; enterprise credibility drops. | A darker canvas and brighter but *rarer* colour: the spectrum marks only active/primary states. |
| Keep the warm **paper** bands as rhythm | They break the "working system" immersion. | Paper becomes the *reading* surface only (Insights, articles). Rhythm comes from surface depth, light fields and composition instead. |

---

## 4. Deliverable 5 — Three directions

### A. Premium Enterprise AI
* **Colours:** near-black blue canvas, white type, one cyan accent; spectrum only in the logo.
* **Depth:** soft elevation, large radii, generous whitespace.
* **3D:** none; product screenshots/frames only.
* **Motion:** fades and small lifts.
* **Typography:** large but quiet; Manrope 600, wide tracking avoided.
* **Personality:** calm, safe, "consultancy that codes".
* **Advantages:** lowest risk, fastest to build, very trustworthy for SMB owners.
* **Risks:** it is essentially today's site with polish — the owner's core complaint ("does not grab
  me") stays unsolved. Indistinguishable from many SaaS pages.

### B. Bold AI Engineering (recommended)
* **Colours:** deeper canvas `#070b14`, ambient light fields, the logo spectrum as the energy signal;
  amber approval, green health, rose incident as functional colours.
* **Depth:** 7 surface levels, recessed telemetry wells, border light on interactive surfaces,
  isometric depth in system diagrams.
* **3D:** one AI System Core (SVG isometric, optional WebGL later); 2.5D everywhere else.
* **Motion:** purposeful flows (light travelling along connectors, holding at the approval gate),
  instant UI feedback, slow ambient drift only in the hero.
* **Typography:** much larger display range (hero up to 104 px), tight tracking, mono metadata and
  big mono numerals for telemetry.
* **Personality:** "an engineering team showing you its running systems".
* **Advantages:** solves the emotional gap while staying honest and fast; uses the identity the
  owner already chose (logo spectrum); every effect explains something.
* **Risks:** needs discipline (spectrum creep); more design work per section; animated SVG
  diagrams need careful a11y (text alternatives) and testing.

### C. Futuristic Product Platform
* **Colours:** full-bleed spectrum gradients, glass panels, saturated violet.
* **Depth:** heavy glassmorphism and blur, floating 3D objects.
* **3D:** WebGL scene behind the hero, particle fields, interactive orbit.
* **Motion:** continuous ambient animation, scroll-jacked storytelling.
* **Typography:** ultra-large, possibly a futuristic display face.
* **Personality:** "AI startup launch".
* **Advantages:** immediate wow; memorable on first visit.
* **Risks:** looks like crypto/AI-template sites; hurts LCP/TBT/battery on mobile; blur hurts
  contrast; Cyrillic display faces in this style are rare; undermines trust with SMB buyers.

**Recommendation: B.** It is the only direction that answers "These people build serious AI
systems" *with evidence on screen*. Take from A the restraint rules (spectrum only for active
states, paper only for reading); take nothing from C except the ambition of the hero.

---

## 5. Deliverable 2 — Visual direction "Signal"

### 5.1 Principles
1. **Show the mechanism.** Every visual depicts what flows, where it waits and who decides.
2. **Colour is light, light means activity.** Idle things are neutral; active things emit spectrum.
3. **Depth is hierarchy.** The higher the surface, the more interactive or important it is.
4. **One focal object per screen.**
5. **Honest data.** Anything that looks like data is labelled `DEMO · synthetic` in the UI itself.
6. **Feedback is instant; storytelling is slow.**

### 5.2 Colour system
All values are proposals; verified contrast is listed on the darkest surface each is used on.

**Canvas and surfaces (cool, blue-black)**

| Token | Value | Use |
| --- | --- | --- |
| `canvas-deep` | `#04070d` | hero base, telemetry band, footer |
| `canvas` | `#070b14` | page background (replaces `#080f19`) |
| `surface-recessed` | `#05090f` + inset shadow | code, telemetry wells, inputs |
| `surface-1` | `#0b111c` | standard cards |
| `surface-2` | `#0f1726` | raised / interactive cards |
| `surface-3` | `#152034` | spotlight cards, active rows |
| `surface-4` | `#1b2940` | floating: menus, popovers, tooltips |
| `paper` | `#f4f1ea` | reading surface (Insights, articles) only |

**Text**

| Token | Value | Contrast |
| --- | --- | --- |
| `fg` | `#f2f6fc` | ≥ 13.5:1 on every dark surface |
| `fg-secondary` | `#cdd8e6` | ≥ 10.1:1 |
| `fg-muted` | `#9fb0c4` | ≥ 6.6:1 |
| `fg-subtle` | `#8497ad` | ≥ 4.9:1 (lowest on `surface-4`) |

**Spectrum (from the logo)**

| Token | Value | On `canvas` | Role |
| --- | --- | --- | --- |
| `signal-cyan` | `#22d3ee` | 10.9:1 | primary action, data, integrations, links |
| `signal-cyan-soft` | `#67e8f9` | 13.6:1 | text accents, button light stop |
| `signal-azure` | `#3b82f6` | (non-text) | models/infrastructure, glow, borders |
| `signal-azure-soft` | `#60a5fa` | 7.7:1 | text accents, button mid stop |
| `signal-violet` | `#8b5cf6` | (non-text) | AI/agents, glow, borders |
| `signal-violet-soft` | `#a78bfa` | 7.2:1 | AI labels, button end stop |

Rule: saturated `#3b82f6` / `#8b5cf6` are **never** used behind or as body text; their soft
partners are.

**Functional colours** (unchanged semantics)

| Token | Value | Meaning |
| --- | --- | --- |
| `approval` | `#f2c46d` | human decision / gate (12.1:1) |
| `healthy` | `#5fd4a0` | done, healthy, passed (10.7:1) |
| `incident` | `#f47a8a` | error, incident, failed (7.5:1) |

**Lines:** `line-1` = `rgb(148 170 200 / 0.10)`, `line-2` = `/0.16`, `line-3` = `/0.28`; field
border `#62788f` (3.9:1 on `surface-2`, non-text ≥ 3).

### 5.3 Gradient system

| Name | Definition | Where |
| --- | --- | --- |
| **Spectrum** | `linear-gradient(100deg, #67e8f9 0%, #60a5fa 50%, #a78bfa 100%)` | primary CTA hover fill, hero keyword, logo wordmark (exists) |
| **Spectrum line** | `linear-gradient(90deg, #22d3ee, #3b82f6 50%, #8b5cf6)` | 1–2 px: active nav underline, focused node ring, border light, connectors in flow |
| **Signal glow** | `0 10px 30px -12px rgb(59 130 246 / .55), 0 0 0 1px rgb(139 92 246 / .35)` | primary CTA hover, active node |
| **Light field — hero** | `radial-gradient(60% 50% at 78% 18%, rgb(59 130 246 / .20), transparent 70%), radial-gradient(40% 35% at 62% 40%, rgb(34 211 238 / .12), transparent 70%), radial-gradient(35% 30% at 92% 55%, rgb(139 92 246 / .10), transparent 70%)` | hero only |
| **Light field — horizon** | `radial-gradient(120% 60% at 50% 0%, rgb(34 211 238 / .08), transparent 60%)` | top edge of a section that "receives" the flow |
| **Light field — ops** | `radial-gradient(70% 60% at 20% 100%, rgb(95 212 160 / .06), transparent 70%)` + grid | telemetry band |
| **Approval glow** | `radial-gradient(closest-side, rgb(242 196 109 / .22), transparent)` | behind the gate only |

Never: gradient text in body copy, gradient section backgrounds edge to edge, more than one
Spectrum fill visible per viewport (the CTA), gradients on cards at rest.

### 5.4 Lighting and surfaces
Seven levels (named after the order a visitor perceives them):

| Level | Token / class | Look | Use |
| --- | --- | --- | --- |
| 0 Deep canvas | `canvas-deep` | darkest, noise 2 % | hero base, telemetry band, footer |
| 1 Ambient light | `.light-field-*` | radial light, no edges | behind focal objects only |
| 2 Recessed | `.surface-recessed` | darker than canvas, `inset 0 1px 0 rgb(0 0 0 / .5)`, line-1 | code, metrics wells, inputs |
| 3 Standard | `.surface-1` | line-1 border, top highlight `inset 0 1px 0 rgb(255 255 255 / .04)` | static content |
| 4 Elevated | `.surface-2` | line-2, shadow `0 20px 40px -24px rgb(0 0 0 / .8)` | interactive cards |
| 5 Spotlight | `.surface-3` + border light | pointer-following border light, Signal glow on focus | the one featured item per section |
| 6 Floating | `surface-4` | line-3, `0 24px 60px -20px rgb(0 0 0 / .9)`, 12 px radius | menus, popovers, mega-panel |

Noise: a 128 px tiled SVG `feTurbulence` data URI at 2–3 % opacity on levels 0–1 to stop gradient
banding. Static (no animated noise).

### 5.5 Typography
Keep the faces (Manrope display, Inter text, JetBrains Mono data): they are loaded, self-hosted,
Cyrillic-tuned and add no cost. Personality comes from **range and role**, not a new face.

| Role | Face / weight | Size (360 → 1440) | Tracking | Example |
| --- | --- | --- | --- | --- |
| Hero statement | Manrope 800 | 2.6rem → 6.5rem | −0.045em | "AI systems built for real operations." |
| Section statement | Manrope 700 | 2rem → 4rem | −0.035em | "AI suggests. People decide." |
| Product explanation (H3) | Inter 600 | 1.25 → 1.5rem | −0.015em | card titles |
| Body | Inter 400 | 1rem / 1.65 | 0 | |
| Technical label | JetBrains Mono 500 | 0.75rem, uppercase allowed | +0.06em | `FIG 03 · APPROVAL GATE` |
| System status | JetBrains Mono 500 | 0.8125rem | 0 | `● healthy · p95 412 ms` |
| Metric numeral | JetBrains Mono 500, tabular | 2rem → 3.5rem | −0.02em | `99.4%` (demo only) |
| Metadata | JetBrains Mono 400 | 0.75rem | 0 | dates, reading time |

Hero keyword treatment: one phrase in Spectrum (`background-clip: text`) at hero scale only;
everything else white. Bulgarian: test every display size with the longest BG strings; display
type uses `text-wrap: balance` and never breaks mid-word (`hyphens: manual`).

### 5.6 Iconography
* 24 px grid, 1.5 px stroke, round caps — current icons are fine as glyphs.
* Drop the 40 px icon boxes for most uses. Icons sit bare, or in a **port** (a 28 px circle with a
  1 px line-2 ring) when they represent a system node.
* Add a 6 px **node dot** in the concept's functional colour (cyan data, azure model, violet agent,
  amber approval, green ops) — echoing the logo's dot.
* System concepts get dedicated glyphs: Data (stacked discs), Model (prism), Agent (node with three
  ports), Tool (socket), Approval (gate with a check), Observability (pulse line), Identity (key).

### 5.7 3D strategy
* **One object: the AI System Core** (section 6.2). Built as an isometric SVG (30° projection) with
  three stacked plates and orbiting nodes. It *looks* 3D, renders server-side, is fully crisp and
  translatable (labels are HTML), and costs no JS for the static state.
* **2.5D elsewhere:** isometric plates in the architecture builder, a perspective tilt
  (`rotateX(8deg) rotateY(-12deg)`, static) on the telemetry surface, layered parallax ≤ 3° on fine
  pointers only.
* **WebGL (optional, phase 8):** a React Three Fiber version of the core for desktop, loaded after
  idle, only when `pointer: fine`, no reduced motion, no `Save-Data`, `deviceMemory ≥ 4`. The SVG
  version remains the LCP element and the fallback. Ship it only if a side-by-side review says it
  adds something the SVG cannot (real parallax/lighting); otherwise skip it.
* Never: spheres of particles, brains, robots, floating cubes, rotating globes.

### 5.8 Motion strategy
Tokens:

| Token | Value | Use |
| --- | --- | --- |
| `--dur-instant` | 80 ms | press, toggle |
| `--dur-fast` | 140 ms | hover colour, focus, dropdown fade |
| `--dur-base` | 200 ms | cards, nav underline, accordion |
| `--dur-slow` | 320 ms | panels, drawers |
| `--dur-reveal` | 560 ms | section reveal, diagram draw |
| `--dur-flow` | 2.4–4 s | light travelling along a connector (loop) |
| `--dur-ambient` | 24–40 s | hero light-field drift (loop) |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | entering, hover |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` | state changes |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` | flows, loops |

What moves, and what it means:

| Element | Motion | Communicates |
| --- | --- | --- |
| Buttons | section 8.4 | cause → effect |
| Cards | lift 2 px, border light, icon nudge | "this is interactive" |
| Navigation | underline slides between items (200 ms); mega-panel fades + 4 px drop | location, hierarchy |
| Dropdowns | 140 ms opacity + 4 px translate from origin | where it came from |
| Scroll reveals | heading + visual only, 12 px rise, 560 ms, once, CSS `view()` timeline | arrival, not decoration |
| System diagrams | dash flow along active connectors; nodes brighten when reached | direction of data |
| Approval gate | the light *stops* at the gate, gate pulses amber once, then passes | human control |
| Agent relationships | edge draws 300 ms when a node is added; related edges brighten on focus | relationship |
| Metrics (demo) | one count-up 600 ms on first view; sparklines draw 800 ms | change over time |
| Loading | skeleton shimmer (exists); long tasks show a progressing phase rail | progress |
| Success | check stroke draws 320 ms + healthy colour | completion |
| Validation | instant border/icon/text change, no shake | error location |
| Page transitions | View Transitions cross-fade 160 ms where supported; none otherwise | continuity |

Heavy motion only in: hero, approval gate, AI operations, agent constellation/builders.
Under `prefers-reduced-motion: reduce`: no transforms, no loops, no count-ups; flows are shown as
static highlighted paths; colour/opacity state changes remain (they carry meaning).
Any loop longer than 5 s gets a visible pause/play control (WCAG 2.2.2).

### 5.9 Interaction strategy
* Feedback starts on `pointerdown`/hover within one frame; no delayed hovers.
* Hover never reveals information that is not also available on focus and on touch.
* Interactive diagrams are keyboard-operable lists rendered as diagrams (each node is a `button`;
  arrow keys move along edges; focus shows the same highlight as hover).
* Touch: no pointer effects; tap = focus state; carousels are swipeable *and* have buttons.

### 5.10 Buttons
Primary (Signal CTA), Secondary (Outline light), Tertiary (Link with spectrum underline), Danger
(unchanged). Full spec in 8.4.

### 5.11 Cards — seven families
| Family | Surface | Signature detail | Interaction |
| --- | --- | --- | --- |
| **Product Tool** | surface-2, 20 px radius, recessed preview well on top | live mini-preview of the tool (SVG) + `TOOL` label + status chip | border light, preview animates on hover/focus, whole card is a link |
| **Solution** | surface-1, image-less, large H3, functional dot | "what flows" mini diagram (3 nodes) | lift 2 px, arrow nudge, mini-flow runs once |
| **Architecture** | transparent over grid, isometric node | port glyph + connector stubs | node highlight + connected edges brighten |
| **Agent** | surface-2, violet node dot, role + tools + approval rule rows | "Human owner" row with amber dot | focus ring in Spectrum line; edges to its tools brighten |
| **Metric** | recessed well, mono numeral, sparkline, `DEMO` chip | tabular numerals, delta chip | tooltip with exact value on hover *and* focus |
| **Operational Status** | surface-1 row, status dot, service, last event, time | heartbeat dot (2 s pulse, healthy only) | expand row for log lines |
| **Editorial** | paper or surface-1, no border, large type, figure label | category + reading time in mono | title underline in Spectrum line |

### 5.12 Forms
* Inputs on `surface-recessed`, 1 px `#62788f`, 10 px radius, 48 px min height.
* Focus: border `signal-cyan` + 3 px ring `rgb(34 211 238 / .25)`; label stays visible above.
* Error: `incident` border + icon + message (aria-describedby, already wired); no shake.
* Success: check draws in the field's end slot.
* Multi-step forms show the phase rail (same component as the lifecycle).

### 5.13 Navigation
* Header: 64 px, `canvas` at 70 % with blur 12 px; on scroll `surface-4` at 85 %. No change in
  height (no layout shift).
* Active state: a 2 px Spectrum-line underline that **slides** between items (one shared element,
  `transform` only).
* **Services mega-panel** (floating surface): two columns — *AI & automation* with mini-flow
  glyphs, *Core operations* compact — plus a right rail "Start here: AI & e-commerce audit".
* **Tools panel** (when the tools hub ships): each tool with a 120 × 72 live preview and status
  (`Live` / `Beta`). Only existing tools are listed; nothing "coming soon" is linked.
* **Client Portal entry:** a quiet `Client login` text link with a key glyph, shown only when the
  portal route exists (feature flag); never a primary CTA.
* Language switch: compact segmented control (exists) — keep.
* Primary CTA: the Signal button at `sm` size.

### 5.14 Hero
Section 7, item 1, plus signature 6.2.

### 5.15 Dashboards (AI Operations surfaces)
* 12-column grid of tiles on a recessed band; tiles are Metric and Operational Status cards.
* Every tile header carries `DEMO · synthetic` (mono, 11 px, `approval` colour on a 10 % amber
  wash) and the band has a caption stating that nothing on it is real.
* Tiles: System health (status rows), Requests (sparkline), Latency p50/p95 (dual line), Cost per
  day (bars), Quality / evals (score + pass/fail chips), RAG retrieval (hit rate), Incidents
  (timeline with severity), Changes (deploy markers on the latency chart).
* Data: deterministic, seeded, stored in content files with BG/EN labels; no randomness at render.

### 5.16 Diagrams
* Always in `DiagramFrame` (exists) with a figure label `FIG nn · title` and a caption.
* Nodes = ports with functional dots; edges = 1.5 px `line-3`, active edges = Spectrum line with a
  travelling 24 px light segment (`stroke-dasharray` + `stroke-dashoffset` animation).
* Text inside diagrams is HTML (positioned), not SVG text, so it wraps and translates.

### 5.17 Section composition
Rotate through these compositions; no two adjacent sections share one:
`Canvas` (full-bleed visual + overlay text) · `Asymmetric split` (5/7) · `Bento` (mixed tile sizes)
· `Statement` (one sentence, huge type, negative space) · `Architecture` (diagram-first) ·
`Product surface` (tilted UI) · `Telemetry band` (full width, recessed) · `Editorial` (paper).
Vertical rhythm alternates `compact / spacious` so the scroll has tempo.

### 5.18 Mobile adaptation
* The hero visual appears **within the first 1.5 screens**: core at 300–340 px tall directly under
  the CTAs, labels as a legend list below it.
* Bento collapses to one column with 2-up small tiles; telemetry shows 4 tiles + "see all" toggle
  (no horizontal scroll, no overflow).
* Diagrams switch to vertical flow (`AiOpsDiagram vertical` already does this).
* No pointer effects, no parallax, ambient drift off (`pointer: coarse`), flows still animate
  (cheap, meaningful) unless reduced motion.
* Targets ≥ 44 px; mega-panels become a full-height sheet.

---

## 6. Deliverable 4 — Signature elements

1. **The Spectrum signal.** cyan → azure → violet, taken from the logo, appears *only* where
   something is active: the primary CTA on hover, the nav underline, live connectors, the focused
   node, the current lifecycle phase. Visitors learn "light = alive". Recognisable without the logo
   because no other colour in the UI behaves this way.
2. **The AI System Core.** An isometric stack of three plates — *Data* (cyan), *Intelligence*
   (azure: models, RAG), *Agents & automation* (violet) — with an *Operations* ring (green) around
   it and a *Human control* gate (amber) on the output path. Six labelled ports: DATA, AI, AGENTS,
   AUTOMATION, HUMAN CONTROL, OPERATIONS. Light rises through the plates and exits through the
   gate. It explains the company in one image: layered architecture, governed output, operated
   over time. (An improvement on an abstract "core" blob: the layers *are* the explanation.)
3. **The Approval Gate.** Wherever an AI action has consequences, the flow visibly stops at an amber
   gate, the gate pulses once, a human-owner glyph confirms, then the light passes. Used in the
   hero, the human-control section, the agent canvas and service pages. It makes the brand promise
   ("AI suggests, people decide") a visual mechanism.
4. **Figure-labelled telemetry.** Mono `FIG nn` labels, recessed wells, tabular numerals, sparklines
   and `DEMO · synthetic` chips. Engineering-drawing meets observability console.
5. **Border light.** Interactive surfaces carry a 1 px light that follows the pointer along the
   border (static highlight on focus/touch). Subtle, consistent, cheap.

---

## 7. Deliverable 3 — Homepage, section by section

Existing components that are reused are named in brackets.

### 1. Hero — "AI System Core"
* **Purpose:** in five seconds: AI systems built for real business operations, with human control.
* **Layout:** desktop 5/7 asymmetric; text left, core right bleeding to the viewport edge; phase
  rail under both. Height ≈ 100 svh − header, min 640 px.
* **Typography:** hero statement 6.5rem/0.98 (EN) — e.g. "AI systems built for real operations."
  (BG equivalent, test length); keyword in Spectrum; lead 1.25rem `fg-muted`, max 46ch.
* **Colours:** `canvas-deep` + hero light field + noise; spectrum on the keyword and active port.
* **Visual:** AI System Core (SVG isometric) with six HTML-labelled ports.
* **3D:** isometric projection; optional WebGL in phase 8.
* **Motion:** light pulses rise through the plates every 4 s, travel to the gate, hold 600 ms, pass;
  ambient light drifts 32 s loop; phase rail highlights Discover → Improve in sync (6 phases × 4 s).
  Pause control bottom-right of the visual.
* **Hover/focus:** ports are buttons; focusing one dims the rest, brightens its connections and
  shows a one-line explanation in a caption area (not a tooltip).
* **Mobile:** statement 2.6rem; CTAs; then the core at 320 px; ports as a legend list; phase rail
  becomes a 2 × 3 grid.
* **CTA hierarchy:** Primary Signal CTA "Book a consultation"; secondary outline "See how we build"
  (scrolls to architecture); tertiary text link to the Automation Advisor.

### 2. Stack strip (replaces the credibility strip)
* **Purpose:** technical credibility without fake logos.
* **Layout:** full-width thin band on `canvas`, mono labels in a single line on desktop
  (`SHOPIFY · WOOCOMMERCE · NEXT.JS · FASTAPI · POSTGRESQL · LLM APIs · RAG · DOCKER`), two lines
  on mobile.
* **Typography:** mono 12 px `fg-subtle`; separators line-2.
* **Motion:** none (deliberately still after the hero).
* **CTA:** none.

### 3. Statement
* **Purpose:** change tempo; state the positioning.
* **Layout:** centred single sentence, 4rem, max 18ch, spacious padding; a 1 px Spectrum line draws
  under one phrase on reveal.
* **Example:** "We build AI that runs in production — and we stay to operate it."
* **Mobile:** 2rem, left-aligned.

### 4. Services as a system map (bento) [ServiceShowcase data]
* **Purpose:** what we do, organised as one system.
* **Layout:** bento, 12 columns: three Solution cards for AI & automation span 4 columns each with
  a mini-flow; core operations as 4 compact tiles spanning 3; the audit as a full-width "Start here"
  bar with a phase-rail glyph.
* **Colours:** functional dots per discipline; Spotlight surface on AI Managed Services only.
* **Motion:** mini-flow runs once on hover/focus; border light.
* **Mobile:** single column; core tiles 2-up.
* **CTA:** card links with descriptive text ("Explore process automation", fixes the "Learn more"
  SEO issue); one secondary "All services".

### 5. Failure modes (replaces the paper problem index) [ProblemIndex data]
* **Purpose:** recognise your problem; route to the fix.
* **Layout:** dark "diagnostic log": each row = severity dot (rose/amber), symptom (H3),
  cause (muted), `→ ROUTE TO` solution chip. Asymmetric: heading block left sticky (EditorialSplit).
* **Motion:** row hover/focus draws a connector from the symptom to its solution chip.
* **Mobile:** stacked rows, chip below.
* **CTA:** solution chips are links.

### 6. Human control — the Approval Gate [AiPipeline content]
* **Purpose:** the differentiator.
* **Layout:** full-width architecture canvas on `canvas-deep`: Event → API → AI suggestion (violet)
  → Rules → **Gate (amber)** → Business action (green). Statement above: "AI suggests. People decide."
* **Motion:** scroll-triggered once: light travels, stops at the gate, gate pulses, owner glyph
  ticks, light continues; replay button. Reduced motion: final state with all labels.
* **Mobile:** vertical flow.
* **CTA:** text link "How we design approvals" → AI solutions page.

### 7. AI Operations (AI Managed Services) [ManagedFeature, AiOpsDiagram]
* **Purpose:** prove we operate systems, not just ship them.
* **Layout:** telemetry band: left 4 columns copy + plans list; right 8 columns tilted product
  surface with 6 demo tiles (health, requests, p95 latency, cost/day, eval score, incidents).
* **Colours:** recessed wells, healthy green, one amber incident acknowledged, ops light field.
* **Motion:** sparklines draw on first view, heartbeat dots, one count-up; nothing loops faster
  than 2 s.
* **Labels:** `DEMO · synthetic data` on every tile and the band caption.
* **Mobile:** 4 tiles in 2 × 2, no tilt.
* **CTA:** primary "Request an AI assessment"; secondary "AI Managed Services".

### 8. Build your AI team — agent constellation
* **Purpose:** tease the signature tool; show agents as a designed system.
* **Layout:** canvas-composition: Human owner (amber) top; three agents (violet) — e.g. Support
  agent, Catalogue agent, Ops agent — each wired to data/tools (cyan/azure) and to an approval gate.
* **Motion:** constellation assembles once (edges draw 300 ms staggered 80 ms); focus an agent →
  its edges brighten.
* **Mobile:** vertical tree.
* **CTA:** link to the tool when it exists; until then to the Automation Advisor (existing).

### 9. Tools [AdvisorShowcase]
* **Purpose:** let visitors try something now.
* **Layout:** one large Product Tool card (Automation Advisor, live) with a recessed input → output
  preview; additional tools only when they ship.
* **Motion:** typed sample input once, output rows reveal (labelled sample).
* **CTA:** primary "Try the Advisor".

### 10. Lifecycle [ProcessSteps]
* **Purpose:** how we work; same six phases as the hero rail (one object, two scales).
* **Layout:** horizontal track; each phase a column with outcome; a light marker progresses with
  scroll (CSS `view()` timeline, progressive).
* **Mobile:** vertical track.
* **CTA:** "Our process" text link.

### 11. Insights (paper — the only light band) [ArticleCard]
* **Purpose:** expertise, SEO.
* **Layout:** editorial: featured article large left, three rows right; figure labels.
* **Motion:** title underline in Spectrum line on hover/focus.
* **CTA:** "All insights".

### 12. FAQ [Faq] — compact, EditorialSplit, no decoration.

### 13. Final CTA [CtaBand emphasis]
* **Purpose:** convert.
* **Layout:** `canvas-deep` + horizon light; statement 4rem; one Signal CTA + email/phone.
* **Motion:** the only other Spectrum fill on the page is this CTA; the horizon light is static.

---

## 8. Deliverable 6 — Implementation specification

### 8.1 Token additions (`app/globals.css`, `@theme` + `:root`)
```css
@theme {
  --color-canvas-deep: #04070d;
  --color-canvas: #070b14;
  --color-surface-recessed: #05090f;
  --color-surface-1: #0b111c;
  --color-surface-2: #0f1726;
  --color-surface-3: #152034;
  --color-surface-4: #1b2940;
  --color-fg: #f2f6fc;
  --color-fg-secondary: #cdd8e6;
  --color-fg-muted: #9fb0c4;
  --color-fg-subtle: #8497ad;
  --color-signal-cyan: #22d3ee;
  --color-signal-cyan-soft: #67e8f9;
  --color-signal-azure: #3b82f6;
  --color-signal-azure-soft: #60a5fa;
  --color-signal-violet: #8b5cf6;
  --color-signal-violet-soft: #a78bfa;
  --color-approval: #f2c46d;
  --color-healthy: #5fd4a0;
  --color-incident: #f47a8a;
  --color-field-line: #62788f;
  --ease-in-out-flow: cubic-bezier(0.65, 0, 0.35, 1);
}
:root {
  --spectrum: linear-gradient(100deg, #67e8f9 0%, #60a5fa 50%, #a78bfa 100%);
  --spectrum-line: linear-gradient(90deg, #22d3ee, #3b82f6 50%, #8b5cf6);
  --glow-signal: 0 10px 30px -12px rgb(59 130 246 / 0.55), 0 0 0 1px rgb(139 92 246 / 0.35);
  --line-1: rgb(148 170 200 / 0.10);
  --line-2: rgb(148 170 200 / 0.16);
  --line-3: rgb(148 170 200 / 0.28);
  --dur-instant: 80ms; --dur-fast: 140ms; --dur-base: 200ms; --dur-slow: 320ms;
  --dur-reveal: 560ms; --dur-flow: 3.2s; --dur-ambient: 32s;
  --ring: #7dd3fc;  /* focus ring, 11.8:1 on canvas, 8.8:1 on surface-4 */
}
```
Migration: keep v2 token *names* as aliases (`surface-page` → `canvas`, `brand` → `signal-cyan`,
`brand-2` → `signal-violet-soft`, `warning` → `approval`, `success` → `healthy`, `danger` →
`incident`) so existing pages keep working; the re-tuned Tailwind scales stay. Note: `brand`
moves from `#69d9df` to `#22d3ee`; re-run the contrast script for every pair before merging.

### 8.2 Surface classes
`.surface-recessed`, `.surface-1` … `.surface-4`, `.light-field-hero`, `.light-field-horizon`,
`.light-field-ops`, `.noise` exactly as in 5.3/5.4. `.card` maps to `.surface-1`; existing
`.panel` to `.surface-2` + panel shadow.

### 8.3 Effect classification and fallbacks
| Effect | Tech | JS | Fallback |
| --- | --- | --- | --- |
| Light fields, noise | CSS (static gradients, SVG data URI) | 0 | none needed |
| Ambient drift | CSS transform on a pseudo-element, 32 s | 0 | off under reduced motion / coarse pointer |
| Spectrum CTA | CSS `@property` colour interpolation | 0 | instant colour swap if unsupported |
| Border light | CSS vars + one rAF pointer listener per card group | < 1 KB | static top highlight |
| Scroll reveals, lifecycle progress | CSS `animation-timeline: view()` in `@supports` | 0 | content static and visible |
| AI System Core (static) | inline SVG (server component) + HTML labels | 0 | is the fallback |
| Core flows / gate | CSS animations on SVG strokes | 0 | static highlighted paths |
| Core port interaction | small client island | ≤ 4 KB gz | list of ports with descriptions |
| Telemetry sparklines | inline SVG paths, CSS stroke draw | 0 | static lines |
| Count-up | client island, IntersectionObserver | ≤ 1 KB | final numbers |
| Agent constellation / builders | SVG + HTML nodes, client island | ≤ 12 KB gz | accessible list/form |
| Page transitions | View Transitions API | 0 | none |
| Core WebGL upgrade (optional) | React Three Fiber, dynamic import after idle | ~150 KB gz | SVG core |
| Lottie | not used | — | — |

Budgets: homepage JS added in phases 1–7 ≤ 25 KB gz total; no new web fonts; LCP element stays
text or the SVG core; CLS ≤ 0.05; mobile Lighthouse performance not below the recorded baseline
(`docs/PERFORMANCE_BASELINE.md`: 88–94) and LCP not above it.

### 8.4 Signal button (primary CTA)
```css
@property --c1 { syntax: "<color>"; inherits: false; initial-value: #67e8f9; }
@property --c2 { syntax: "<color>"; inherits: false; initial-value: #7dd3fc; }
@property --c3 { syntax: "<color>"; inherits: false; initial-value: #7dd3fc; }
.btn-signal {
  color: #06121c;                        /* ≥ 6.95:1 on every stop */
  background: linear-gradient(100deg, var(--c1), var(--c2) 50%, var(--c3));
  box-shadow: inset 0 1px 0 rgb(255 255 255 / .35), 0 8px 24px -14px rgb(34 211 238 / .6);
  transition: --c1 260ms var(--ease-out), --c2 260ms var(--ease-out), --c3 260ms var(--ease-out),
              box-shadow var(--dur-fast) ease, transform var(--dur-fast) var(--ease-out);
}
.btn-signal:hover { --c1: #67e8f9; --c2: #60a5fa; --c3: #a78bfa; box-shadow: var(--glow-signal);
                    transform: translateY(-1px) scale(1.01); }
.btn-signal:hover .btn-arrow { transform: translateX(4px); }       /* 140ms */
.btn-signal::after { /* highlight sweep: 30% white band, -120% → 120%, 700ms, once on hover enter */ }
.btn-signal:active { transform: scale(.985); transition-duration: var(--dur-instant); }
.btn-signal:focus-visible { outline: 2px solid var(--ring); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .btn-signal, .btn-signal:hover, .btn-signal:active { transform: none; }
  .btn-signal::after { display: none; }
}
```
* Sizes unchanged (sm 36 / md 44 / lg 52 px min height).
* Secondary "Outline light": `surface-2` fill; border is a Spectrum line at 0 % → 100 % opacity on
  hover via `background: linear-gradient(surface-2) padding-box, var(--spectrum-line) border-box`.
* Tertiary link: text `signal-cyan-soft`, underline is a 1 px Spectrum line scaling 0 → 1 from left.
* Disabled: no gradient, `surface-3` fill, `fg-subtle` text, no transforms.

### 8.5 Card families (React API sketch)
```tsx
<ToolCard href title description status="live|beta" preview={<AdvisorPreview />} />
<SolutionCard href title description flow={["Inquiry", "AI triage", "CRM"]} accent="cyan|azure|violet" />
<ArchitectureNode kind="data|model|agent|tool|approval|ops|identity|user" label active? />
<AgentCard name role tools={[]} approvalRule owner />
<MetricTile label value unit delta series={number[]} demo />      // demo is required
<StatusRow service status="healthy|degraded|incident" lastEvent time demo />
<EditorialCard article variant="featured|row" figure="FIG 04" />   // extends ArticleCard
```
All are Server Components except where noted interactive (border light uses one shared client
listener `BorderLightProvider`; MetricTile count-up is an optional island).

### 8.6 New primitives
`LightField` (variant), `Noise`, `SpectrumText`, `FigureLabel` (`FIG nn · title`), `Port`
(functional dot + glyph), `FlowEdge` (SVG path with optional travelling light), `ApprovalGate`,
`PhaseRail` (6 phases, `current`, `autoplay` with pause), `DemoChip`, `PauseControl`,
`SystemCore` (SVG + HTML labels + client island for ports).

### 8.7 Accessibility checklist per component
* Every animated loop: pause control, stops off-screen, reduced-motion static state.
* Diagrams: `<figure>` + figcaption + an ordered list of nodes/edges (visually hidden when the
  diagram is shown, or visible legend on mobile).
* Interactive canvases: every action available via buttons/forms; canvas mirrors state.
* Focus ring `--ring` 2 px offset 3 px everywhere; composite links via `.focus-frame` (exists).
* Contrast re-verified with the scratch contrast script for all new pairs (≥ 4.5 text, ≥ 3 UI).
* Touch targets ≥ 44 px; ports in diagrams get 44 px invisible hit areas.

### 8.8 Content and i18n
* New copy (hero statement, port explanations, telemetry labels, demo captions) goes into
  `src/content/{bg,en}` and dictionaries; EN typed against BG. Test the longest BG strings at 360 px.
* Demo data lives in content files, deterministic, with `isDemo: true`, rendered with `DemoChip`.

### 8.9 Verification per PR
`scripts/test.ps1` (api, web, e2e), production build, screenshot tool at 360/390/768/1024/1440
(BG + EN, overflow must be 0), reduced-motion screenshots (`emulateMedia`), keyboard walkthrough
of new interactive parts, `scripts/lighthouse.ps1 -Label <pr>` compared with the baseline.

---

## 9. Sources

* [How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui) — LCH themes, elevation, Inter Display.
* [Linear homepage](https://linear.app) — structure (product UI, figure labels).
* [LogRocket: linear design](https://blog.logrocket.com/?p=186781) — 2025 Linear site reduced colour.
* [Vercel Geist materials](https://vercel.com/geist/materials) — surface vs floating material scale.
* [Vercel-inspired design spec (unofficial)](https://www.shadcn.io/design/vercel) — hero-only gradient.
* [LangChain homepage](https://www.langchain.com) — lifecycle structure.
* [Temporal homepage](https://temporal.io) — illustrative orchestration visuals.
* [GreenSock forum: animating gradients](https://gsap.com/community/forums/topic/24837-animating-gradients/) — Stripe WebGL gradient, battery note.
* [A flowing WebGL gradient deconstructed](https://phaser.io/news/2025/05/a-flowing-webgl-gradient-deconstructed)
* [Crafting a modern spotlight effect](https://dev.to/ibelick/crafting-a-modern-spotlight-effect-with-react-and-css-h1h), [Magic UI magic card](https://magicui.design/docs/components/magic-card) — border light technique.
* [Ryan Mulligan: CSS @property and the new style](https://ryanmulligan.dev/blog/css-property-new-style/), [Gigazine on @property buttons](https://gigazine.net/gsc_news/en/20240909-css-property) — typed gradient animation, Firefox 128 support.
* [Dr. Web: CSS scroll animations](https://www.drweb.de/css-scroll-animationen-ohne-javascript/), [Mozilla Connect thread](https://connect.mozilla.org/t5/ideas/implement-css-scroll-driven-animations-animation-timeline/idc-p/119840) — scroll-driven animation support.
* [Unlighthouse: don't lazy-load LCP](https://unlighthouse.dev/learn-lighthouse/lcp/lcp-lazy-loaded), [R3F performance notes](https://skillselion.com/skills/bbeierle12/skill-mcp-claude/r3f-performance) — 3D hero performance.
* [Tubik: UI design trends](https://blog.tubikstudio.com/?p=17271), [Superdesign: AI design prompts 2026](https://www.superdesign.dev/blog/ai-design-prompts-2026) — motion with an off switch; dark/gradient demand.
* Agent canvas patterns: [Developers Digest agent builder](https://www.developersdigest.tech/agent-builder), [Future AGI workflow builder](https://docs.futureagi.com/docs/agent-playground/features/build-workflow), [DemandSphere visual builder](https://www.demandsphere.com/platform/agents/visual-builder/).
