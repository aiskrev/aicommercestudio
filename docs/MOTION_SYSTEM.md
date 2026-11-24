# Motion system

A restrained, cohesive interaction and motion layer over the public site (`apps/web`). It changes
no copy, price, URL, section, metadata, structured data, form logic, analytics or consent behaviour.
Interaction tables per element: [`DESIGN_SYSTEM.md` → Interaction system](DESIGN_SYSTEM.md#interaction-system).

## Principles

* **Only `transform` and `opacity` move.** Colours, borders and shadows may transition; nothing
  animates width, height, top/left or margins in the page flow, so motion never causes layout shift.
  (The two exceptions are measured, not animated in flow: the segmented-tab indicator, which is
  absolutely positioned, and the accordion's `::details-content` block size, which is the browser's
  own disclosure animation.)
* **Content is never hidden by motion.** Every entrance either keeps the element opaque (the hero H1
  and CTAs only rise) or starts from a state the server renders as visible.
* **Once, then static.** No permanent floating or looping motion in heroes or diagrams. Entrances and
  reveals run once per page view.
* **State, not theatre.** Demo steps, tabs and forms animate only in response to real state changes;
  no simulated delays.
* **Touch and keyboard first.** Hover effects exist only under `(hover: hover) and (pointer: fine)`;
  keyboard focus gets the same visual result as hover plus a ring. Nothing is reachable by hover alone.
* **Reduced motion is global.** `prefers-reduced-motion: reduce` collapses every duration to an
  instant, removes transforms on hover/focus and disables entrances and reveals (they then never hide
  anything). State is still shown through colour, border, focus ring and text.

## Tokens (`app/globals.css`, `:root`)

| Token | Value | Use |
| --- | --- | --- |
| `--motion-instant` | 100 ms | press feedback |
| `--motion-fast` | 140 ms | colour/border, focus halo, outgoing panel |
| `--motion-base` | 220 ms | cards, menus, tabs indicator, incoming panel, accordion |
| `--motion-slow` | 360 ms | active-step ping |
| `--motion-emphasis` | 460 ms | hero entrance |
| `--motion-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | state changes |
| `--motion-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering, movement |
| `--motion-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | leaving |
| `--motion-stagger` / `--motion-stagger-tight` | 55 ms / 40 ms | hero entrance and reveal groups / a freshly filtered set |
| `--motion-sequence` | 150 ms | one step of a drawn sequence (integration flow) |
| `--motion-swap-delay` | 90 ms | incoming panel waits for the outgoing one (`.swap-stack`) |
| `--motion-sheet` | 260 ms | mobile menu sheet opening |
| `--reveal-shift` | 12 px (8 px below 48rem) | scroll-reveal distance |
| `--reveal-duration` | 380 ms | scroll-reveal duration |
| `--lift` / `--lift-card` | −2 px / −3 px | hover/focus lift: buttons / cards |
| `--press-scale` | 0.99 | pressed buttons |
| `--nudge` / `--nudge-card` | 3 px / 2 px | arrow movement: buttons / cards |

The older aliases (`--duration-press/fast/base/slow/reveal`, `--ease-out-soft`, `--ease-standard`)
point at the same values, so existing components follow the scale without edits.

## Primitives

### Scroll reveal — `components/motion/reveal.ts` + `MotionRuntime.tsx`

```tsx
<div {...reveal()}>…</div>        // the element fades in and rises once
<ul {...revealGroup()}>…</ul>     // its direct children do, 55 ms apart
```

* The server renders `data-reveal=""`, which has **no styles**: without JavaScript, in print and for
  crawlers the content is simply visible.
* `MotionRuntime` (mounted once in the locale layout, renders nothing) creates **one
  IntersectionObserver** per page. An element is set to `pending` (transparent, shifted) only after
  the observer has reported it *outside* the viewport, so anything on screen at load never blinks.
  On entry it becomes `in` (transition 380 ms), then `done` after 1.4 s, which drops the reveal
  styles so the element's own hover transitions apply again. It never re-hides.
* Off with reduced motion and where IntersectionObserver is missing. On client navigation the
  observer is rebuilt; anything left `pending` is forced to `done` so nothing stays hidden.
* No scroll/pointer listeners and no layout reads.
* Used by: `SectionHeading` (never on an H1), `DiagramFrame`, `CtaBand`, the home service cards and
  tools/demos group, the package explorer, the integration flow, the AI solutions orchestration block.

### Hero entrance — `.fc-enter` / `.fc-rise` (CSS only)

Eyebrow → heading → lead → actions → points → preview, `--i × 55 ms`, 460 ms. `.fc-enter` fades and
rises 12 px; `.fc-rise` (the H1, the lead and the CTA row) only rises 10 px and is **opaque from the
first frame**, so the LCP element (the H1 on the homepage, the lead on service and hub pages on
phones) is painted immediately and the CTA is usable at once. Runs without
JavaScript. Used on the homepage, `PageHero`, service pages and hub pages.

### Cross-fading panels — `.swap-stack`

All panels share one grid cell, so the frame always has the height of the tallest panel (no
collapse, no jump, no CLS). The outgoing panel fades out in 140 ms and is then `visibility: hidden`
(out of the accessibility tree and tab order, plus `inert`/`aria-hidden`); the incoming one fades in
over 220 ms from 5 px. `data-swapped="false"` suppresses the animation on first render. Used by the
product showcase, the website-type comparison summary and the process stepper. Panels use
`align-content: start`, so the spare height of the stack stays below a shorter panel.

`.swap-stack-fluid` (product showcase): below 64rem the panels differ by up to ~270 px, so only the
shown panel takes space there and fades in; the height change follows a tap, which CLS excludes.
From 64rem the shared cell applies.

### Segmented tabs indicator — `components/ui/Tabs.tsx`

One absolutely positioned pill slides to the selected tab (transform, 220 ms). It is measured only
when the selection or the list size changes (ResizeObserver), never on scroll. Until measured (and
without JavaScript) the selected tab keeps its own background. WAI-ARIA tabs with ← → Home End.

## Components

| Area | Behaviour |
| --- | --- |
| Primary/secondary buttons | hover −2 px (220 ms), press back to 0 px + scale 0.99 (100 ms), arrow +3 px (220 ms) on hover and focus, strong focus ring; disabled/busy: no movement. Busy label keeps the button width. |
| Navigation | underline grows from the left (220 ms), 45 % on hover/focus, 100 % for the current section or open menu; dropdowns fade in from −4 px (220 ms), close instantly; mobile sheet 260 ms in / 220 ms out, Escape closes and returns focus to the toggle. The header fit measurement (`data-compact`) is unchanged. |
| Hero | staggered entrance above; static backdrop and preview (the former drifting colour fields and floating previews/chips were removed). |
| Cards | one behaviour for the four service cards (`.fc-card`), package cards, tool cards and demo cards (`.motion-card` / `.card-interactive`): lift 3 px, stronger border and shadow, 220 ms, arrow +2 px; keyboard focus inside the card looks the same plus a ring. |
| Product/demo selector | sliding indicator + cross-fade, constant height, ARIA tabs with arrow keys. |
| Website-type comparison | the chosen column's tint and header underline transition (220 ms); the summary cross-fades; radio marks animate; a polite `sr-only` status announces the chosen type and its summary (toggling `aria-hidden` alone is not announced reliably). |
| Process stepper (6 stages) | progress hairline fills to the selected stage (220 ms, transform), selected stage gets a brand underline, panel cross-fades; ARIA tabs with ← → ↑ ↓ Home End. |
| Integration flow | drawn once when scrolled to: node → connector → node, 150 ms apart; static afterwards; whole diagram at once without JS / reduced motion. |
| Package filters | segmented indicator; the newly shown set fades in 40 ms apart, only after a filter change (not on load). |
| AI workflow demo | each step shows its real state: the dot pings once when it becomes active/waiting, the connector fills and the check mark pops when done — only on clicks, no timers. The disclosure stays above the controls. |
| FAQ | native `<details>`; height and answer opacity 220 ms where `::details-content` is supported; chevron turns in the same time. |
| Contact/quote form | field focus halo (140 ms), validation messages fade in (no shake), enquiry-type cards transition border/tint, success panel pops in once. Honeypot, consent and submit logic untouched. |

## Reduced motion, touch, forced colours

* `@media (prefers-reduced-motion: reduce)` at the end of `globals.css`: all animation/transition
  durations → 0.001 ms; no transforms on hover/focus/press; entrances, panel swaps, step pings,
  validation fades and the mobile sheet animation are removed. Reveal rules exist only under
  `no-preference`, so nothing is ever hidden. Verified by `e2e/tests/motion.spec.ts`.
* Hover rules sit in `(hover: hover) and (pointer: fine)`; touch gets no stuck hover state. The
  reveal distance is smaller on phones (8 px).
* Forced colours: decorative layers are hidden; focus rings use system colours.

## Performance budget

* No animation dependency. Motion JavaScript: `MotionRuntime` (one observer) + the tab indicator
  effect + the sheet closing timer — well under 2 KB gzip.
* All sections stay Server Components; motion is CSS on server-rendered markup. The client pieces
  that already existed (tabs, stepper, comparison, demo, header) only gained small state.
* The LCP heading is never transparent; reveal never applies above the fold at load; no scroll
  handlers. Measurements: see the PR description and `PERFORMANCE_BASELINE.md`.

## Verification notes

* **Fast scrolling and deferred sections.** Sections with `.fc-defer` (`content-visibility: auto`,
  placeholder 60rem) change height as they render. A jump in large steps can carry a reveal target past
  the viewport without a single rendered frame on screen; it then stays `pending` (hidden only while off
  screen) and is revealed when it is really scrolled to. The invariant tested in
  `e2e/tests/motion.spec.ts` is therefore: no `pending` target is ever on screen, and after a slow pass
  through the page nothing is left pending (375, 768, 1024 and 1440 px). "On screen" means rendered
  (`checkVisibility({ contentVisibilityAuto: true })`): inside a skipped deferred section a forced layout
  can report a target inside the viewport although the section is not painted at all; such a target is
  revealed as soon as its section renders near the viewport (verified at 320 px).
* **Segmented-tab indicator** transitions `width`/`height` as well as `transform`: it is absolutely
  positioned, so this never moves other content (no CLS); a transform-only version would distort the
  rounded corners when the tabs differ in width.
* **Not implemented (optional in the brief):** magnetic hero CTA and pointer tilt of the hero preview —
  they need pointer listeners on every page for a 2–3 px effect.
