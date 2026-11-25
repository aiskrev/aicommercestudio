# Motion system — "Operational AI in motion"

The interaction and motion layer of the public site (`apps/web`). The homepage reads as a motion-led technology
studio: a kinetic headline over a pointer-reactive technical field, service cards that behave like portals, a
scroll-driven process narrative, a data packet that travels the integration flow and an AI demo whose stage changes
with every real step. It changes no copy, price, URL, section, metadata, structured data, hreflang, form logic,
analytics, consent or localisation. Interaction tables per element:
[`DESIGN_SYSTEM.md` → Interaction system](DESIGN_SYSTEM.md#interaction-system).

## Principles

* **Only `transform` and `opacity` move** (including the `translate`/`rotate` individual properties). Colours,
  borders and shadows may transition; nothing animates width, height, top/left or margins in the page flow. Two
  measured exceptions are absolutely positioned and never move other content: the sliding indicators (segmented
  tabs, package filter pill, comparison rail) and the accordion's `::details-content` block size.
* **Content is never hidden by motion.** The kinetic headline, the lead and the hero CTAs are opaque from the first
  frame; every other entrance starts from a state the server renders as visible (`data-reveal=""` has no styles).
* **Motion follows state.** Tabs, filters, the comparison and the AI demo animate only when their real state
  changes; there are no timers, no simulated latency and no autoplay.
* **One ambient loop per scene, paused off screen.** The hero has one faint scan line; the final call to action has
  a slow grid drift and an orbit. Both stop while their section is off screen (`data-loop` → `data-offscreen`).
* **Pointer effects are a bonus for fine pointers.** Magnetic CTAs, the hero field and the service-card tilt and
  spotlight exist only for a mouse on `(hover: hover) and (pointer: fine)`. Touch gets press feedback; keyboard focus
  gets the hover result plus a ring and never moves anything; nothing is reachable by hover alone.
* **Reduced motion is global.** `prefers-reduced-motion: reduce` collapses every duration to an instant and removes
  pointer, magnetic, loop, packet and scrubbed motion; the pointer layer is not even installed. State is still shown
  through colour, border, focus ring and text.
* **No animation library.** CSS, the Web Animations API (package FLIP) and scroll-driven animations where supported.
  Motion, GSAP and Lenis were not needed and are not used.

## Tokens (`app/globals.css`, `:root`)

| Token | Value | Use |
| --- | --- | --- |
| `--motion-instant` | 90 ms | press feedback (scale 0.975) |
| `--motion-fast` | 160 ms | colour/border, outgoing detail |
| `--motion-base` | 240 ms | hover, arrows (5 px), menus, magnetic easing |
| `--motion-slow` | 360 ms | incoming panels, sliding indicators, pings |
| `--motion-emphasis` | 520 ms | reveals, scene pieces, checks |
| `--motion-hero` | 760 ms | kinetic headline, hero layers, portal entry |
| `--motion-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering, movement |
| `--motion-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | state changes |
| `--motion-ease-exit` (alias `--motion-ease-in`) | `cubic-bezier(0.4, 0, 1, 1)` | leaving |
| `--motion-stagger` / `-tight` / `-hero` | 60 / 40 / 80 ms | reveal groups / a filtered set / headline phrases |
| `--motion-sequence` | 90 ms | pieces of a demo scene |
| `--motion-swap-delay` | 90 ms | incoming panel waits for the outgoing one |
| `--motion-sheet` | 260 ms | mobile menu sheet |
| `--reveal-shift` / `--reveal-duration` | 24 px (14 px below 48rem) / 520 ms | scroll reveal |
| `--lift` / `--lift-card` / `--lift-portal` | −2 / −3 / −7 px | buttons / cards / service portals |
| `--press-scale` | 0.975 | pressed buttons |
| `--nudge` / `--nudge-card` | 5 px / 4 px | arrows: buttons / cards (240 ms) |
| `--magnet` / `--magnet-label` | 7 px / 3 px | magnetic CTA: container / label on top |
| `--field-range` | 14 px | hero technical field, deepest layer |
| `--tilt` | 2° | service portal tilt |

Per-stack timing: showcase out 240 ms / in 360 ms; comparison, process and demo stage out 200 ms / in 300 ms. The
older aliases (`--duration-*`, `--ease-out-soft`, `--ease-standard`) point at the same scale.

## Primitives

### Scroll reveal — `components/motion/reveal.ts` + `MotionRuntime.tsx`

```tsx
<div {...reveal()}>…</div>        // the element fades in and rises once
<ul {...revealGroup()}>…</ul>     // its direct children do, 60 ms apart; data-from="left|right|rise|scale" per child
```

* The server renders `data-reveal=""`, which has **no styles**: without JavaScript, in print and for crawlers the
  content is visible.
* One IntersectionObserver per page. An element becomes `pending` (transparent, shifted) only after the observer has
  reported it *outside* the viewport, so nothing on screen at load blinks; on entry it becomes `in` (520 ms), then
  `done` after 1.4 s, which drops the reveal styles. It never re-hides; on navigation anything pending is forced to
  `done`.
* `data-from` on the children of a group sets the axis (service portals: left, right, rise, scale; 760 ms).
* `.fc-flow-figure` and `.sys-checks` use the same states to start their own sequences instead of fading.

### Pointer layer — `components/motion/pointer.ts` (installed by `MotionRuntime`)

One delegated `pointermove` listener on the document, throttled to one update per animation frame, mouse only, not
installed without a fine hovering pointer or with reduced motion. It only writes custom properties; the CSS bounds
the result:

| Attribute | Properties | Result |
| --- | --- | --- |
| `[data-magnetic]` (hero primary, header CTA, final CTA) | `--mag-x/--mag-y` ∈ [−1, 1] | `translate` ≤ 7 px, label ≤ 3 px more, eased 240 ms |
| `[data-portal]` (four service cards) | `--px/--py` (%), `--tx/--ty` ∈ [−1, 1] | spotlight position, tilt ≤ 2° |
| `[data-field]` (hero) | `--fx/--fy` ∈ [−1, 1] | field layers ≤ 14 px, preview layers ±6–12 px (`.fc-depth`, `--d`) |

`translate` composes with `transform`, so the magnetic offset never fights the hover lift or the press scale.
Leaving an element (or the window) removes its properties and it eases back. `installLoopPausing()` observes
`[data-loop]` and toggles `data-offscreen`.

### Sliding indicator — `components/motion/indicator.ts`

`useSlidingIndicator(list, indicator, items, selected)` places one absolutely positioned element on the selected item
(measured when the selection or the list size changes, never on scroll; 360 ms). Used by `Tabs` (segmented tabs,
package filter pill) and the comparison rail. `useSwapDirection(order, value)` gives `next`/`prev` for directional
panels (no effect, React's "adjust state while rendering").

### Directional panels — `.swap-stack`

All panels share one grid cell (constant height, no CLS). With `data-dir` the outgoing panel leaves towards x ∓16 px
at scale 0.985 (exit curve) and is then `visibility: hidden`; the incoming one arrives from x ±18 px (ease-out) after
90 ms. Interruptible: the outgoing panel transitions from wherever it is, the incoming one restarts. Inactive panels
are `aria-hidden`/`inert`. `.swap-stack-fluid` (showcase) keeps only the shown panel in the flow below 64rem.

### Kinetic headline — `components/motion/KineticHeading.tsx`

The homepage H1 is split into phrases at commas; each word is a mask (`.kw`, `clip-path`) holding a word that rises
into it (`.kw-in`, 760 ms, phrases 80 ms apart, words 20 ms apart). Words, never characters. The text content is
unchanged, and each word starts partly inside its mask at full opacity, so the H1 is painted with the first
contentful paint and stays the LCP element (verified: LCP − FCP ≤ 17 ms in `motion-signature.spec.ts`).

## The homepage, section by section

| Section | Behaviour |
| --- | --- |
| Hero | Kinetic headline; lead and CTAs rise at full opacity; preview layers arrive from three directions (main rises with scale, store from the right, workflow from the left), chips pop. **Technical field** (`HeroField`, SVG circuit) behind the preview: two depth layers follow a fine pointer (≤ 14 px) and the preview layers counter-move. **One ambient loop**: a faint scan line crosses the field every 9 s, paused off screen. **Scroll response** (`animation-timeline: scroll()`, progressive): over the first 80 vh the preview stage lifts 56 px and the field sinks and fades. Magnetic primary CTA. |
| Header | Magnetic quote button (fine pointer only). |
| Service portals (4 cards) | Enter from four axes; hover: lift −7 px, pointer spotlight, a border trace that runs once round the card (1.6 s), tilt ≤ 2°; details panel as before; keyboard focus: lift and spotlight without tilt; touch: press scale only, details always shown. |
| Product showcase | Directional panel swap (out 240 ms, in 360 ms) and the mock-up's pieces follow 60 ms apart; sliding tab pill; ARIA tabs unchanged. |
| Website-type comparison | Active rail: a ring slides to the chosen option (360 ms); summary out 200 ms / in 300 ms in the direction of the choice; the polite `compare-announce` status stays. |
| Process | **Desktop** (≥ 64rem wide, ≥ 40rem tall, no reduced motion): a 300 vh scroll narrative; the stages and the panel are pinned (`position: sticky`, centred under the header); six invisible sentinels and one IntersectionObserver at a 45 % reading line select the stage; the rail is scrubbed by the scroll (`view-timeline`, `contain` range). Clicks and arrow keys still select, and scroll the page to that stage's part of the narrative. No scroll hijacking. **Phones and tablets**: a vertical stepper with a rail and stage dots, no pinning. Without JavaScript: not pinned (`<noscript>` style). |
| Integration flow | Desktop: a data bus above the five nodes; the bus fills, a packet (transform only) travels from the first node to the last and each node pulses once as it arrives — scrubbed by the scroll where `animation-timeline` exists, otherwise once when revealed (700 ms + i × 600 ms). Phones: a packet runs down each beam in turn. Reduced motion / no JS: the complete diagram, no packet. |
| Package filters | Sliding pill (360 ms); cards that stay glide to their new place (FLIP with the Web Animations API, 420 ms desktop / 280 ms phones), new cards scale and fade in 40 ms apart; a second change mid-flight starts from where the card is. Prices come from the server as before. |
| AI workflow demo | A stage above the steps with six visually distinct scenes — idle, receive (a message slides into the inbox), classify (one of three tags is hit), extract (marked lines move into fields), draft (lines are drawn), approval (a person and two choices; the verdict appears only after the click). Driven only by the demo's state; restart returns to idle; the disclosure stays above the controls. Decorative (`aria-hidden`): the steps list and the polite status carry the text. |
| Engineering practices | "System checks": a hairline runs across, then each group's check ticks, 140 ms apart. No scores, numbers or results. |
| Founder, FAQ, footer | Calm: no new motion. The protected portrait is untouched. |
| Final call to action | The grid drifts one cell in 12 s and an orbit turns in 14 s (paused off screen); magnetic primary CTA. |

## Reduced motion, touch, forced colours, print

* `@media (prefers-reduced-motion: reduce)`: all durations → 0.001 ms; no transforms on hover/focus/press; no
  `translate` from the pointer layer (which is not installed); scan, packet, beam packets, border trace, spotlight
  and node pulses are hidden; headline, drift, orbit, stage scroll response, checks, scene pieces and the scrubbed
  rail do not animate; the process narrative is not pinned. Reveal rules exist only under `no-preference`. Verified
  by `e2e/tests/motion.spec.ts` and `motion-signature.spec.ts` (no running animation after a full scroll).
* Touch: pointer effects never run (mouse events only, fine-pointer query); press feedback on buttons and service
  cards; the service cards' details are always shown.
* Forced colours: the field, scan, orbit, trace, packet and spotlight are hidden.
* Print: every reveal target, headline word and check is shown in place; loops and packets are hidden.

## Performance budget

* No dependency added. Motion JavaScript: `MotionRuntime` (reveal observer, pointer layer, loop pausing), the
  indicator hooks, the narrative observer and the FLIP effect. Measured transfer: see
  [`PERFORMANCE_BASELINE.md`](PERFORMANCE_BASELINE.md) → Motion rework.
* All sections stay Server Components except the ones that already were client components; the hero field and the
  headline are server-rendered markup with CSS.
* The pointer layer writes custom properties once per frame and reads one rectangle per active element; no scroll
  listeners anywhere (the narrative uses an IntersectionObserver, the scrubbing is CSS).
* The process section is not `content-visibility: auto` any more: its 300 vh narrative would not fit the 60rem
  placeholder of `.fc-defer`.

## Verification notes

* **Fast scrolling and deferred sections.** Sections with `.fc-defer` change height as they render, so a target can
  be carried past the viewport without a rendered frame; it then stays `pending` until really scrolled to. Tested
  invariant (`motion.spec.ts`): no `pending` target is ever on screen, and after a slow pass nothing is left pending
  (375–1440 px). "On screen" means `checkVisibility({ contentVisibilityAuto: true })`.
* **Scroll-driven animations** are progressive (`@supports (animation-timeline: view())`); without them the hero has
  no scroll response, the process rail follows the selected stage (transition) and the flow runs once on reveal.
* **New tests**: `e2e/tests/motion-signature.spec.ts` (headline text and LCP, magnetic bounds and release, keyboard,
  field bounds and loop pausing, portal tilt ≤ 2°, narrative stage order and controls, packet and pulses, FLIP and
  prices, demo scenes, checks order, reduced motion, touch, no JavaScript) and `components/motion/pointer.test.ts`.
