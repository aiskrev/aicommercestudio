# Design system

> Superseded for visual decisions by [UI_DESIGN_SYSTEM.md](UI_DESIGN_SYSTEM.md) (premium redesign, 2026-10-24). Kept for history.

Source of truth: `apps/web/src/app/globals.css` (tokens + component classes) and
`apps/web/src/components/ui/primitives.tsx` (React primitives). No UI library, no icon font,
no third-party scripts.

## Colour tokens & contrast

Measured WCAG 2.1 contrast ratios (text on the darkest and lightest surfaces used):

| Token | Value | Use | Contrast |
| --- | --- | --- | --- |
| `--surface-page` / `ink-950` | `#050811` | page background | — |
| `--surface-raised` / `ink-900` | `#0a1020` | alternating sections, highlighted cards | — |
| `ink-800` | `#121a2c` | card surface (approx.) | — |
| `--text-primary` | `#f8fafc` | headings | ≥ 15:1 |
| `--text-secondary` / `slate-300` | `#cbd5e1` | body text | ≥ 10.7:1 |
| `--text-muted` / `slate-400` | `#94a3b8` | secondary and small text — **the minimum for any text** | ≥ 6.2:1 |
| accent `cyan-300` | `#67e8f9` | links, eyebrows, focus ring | ≥ 10.9:1 |
| field border `--border-strong` | `#5b6b85` | input boundaries (non-text, needs 3:1) | 3.7:1 |
| primary button | `#050811` on `#22d3ee → #3b82f6` | CTA | 11.1 – 5.4:1 |

`slate-500` (≈3.3–4.2:1) and `slate-600` fail AA for text and are not used for text anywhere.
Purple (`violet-400/500`) is used only as a restrained gradient accent, never for body text.

## Typography

Inter (body) + Manrope (headings), self-hosted via `next/font` with Latin and Cyrillic subsets.
Headings disable Manrope's Bulgarian localized glyphs (`locl`) for consistency with the body font.

| Class | Size | Use |
| --- | --- | --- |
| `.t-display` | clamp(2.35rem → 4.25rem) | homepage H1 |
| `.t-h1` | clamp(2.1rem → 3.4rem) | page H1 |
| `.t-h2` | clamp(1.75rem → 2.6rem) | section titles |
| `.t-h3` | 1.125rem / 600 | card titles |
| `.t-lead` | clamp(1.05rem → 1.25rem), muted | intro paragraphs |
| `.t-eyebrow` | 0.75rem, uppercase, tracked, cyan | section labels |

## Spacing & layout

Container `max-w-7xl` with 16 / 24 / 32 px gutters; sections `py-16 sm:py-24`; card padding 20–32 px;
radius 0.8 rem (fields), 1.25 rem (cards), 1.75 rem (feature panels). Alternating sections use `Section alt`.

## Components

| Component | Classes / API | States |
| --- | --- | --- |
| Button | `Button`, `ButtonLink`, `buttonClass(variant, size)`; variants `primary`, `secondary`, `ghost`, `danger`, `dangerOutline`; sizes `sm`, `md`, `lg` | hover, active (1px press), focus-visible ring, disabled, `loading` (spinner + `aria-busy`, disabled) |
| Card | `.card`, `.card-interactive` (hover lift + glow, focus ring via `:has(:focus-visible)`), `.card-accent` (gradient hairline border) | hover, keyboard focus |
| Field | `.field` (input/select/textarea), `.checkbox` | hover, focus (cyan ring), invalid (`aria-invalid`), disabled |
| Badge | `Badge`, `.badge`, `.badge-accent` | — |
| Alert | `Alert tone="info|success|warning|error"` | used for form, page and admin errors |
| Skeleton | `Skeleton`, `.skeleton` (shimmer) | admin `LoadingState`, `StatsSkeleton` |
| Empty state | `EmptyState` (admin) | icon, title, description, optional action |
| Accordion | `Faq` (native `<details>`) | animated open/close where `::details-content` is supported |
| Process diagram | `ProcessTimeline` | horizontal on desktop, vertical on mobile |
| Navigation | `Header` | services mega menu (Escape / outside click / focus return), full-height mobile panel with scroll lock and focus management |

## Motion

All animations use `transform`, `opacity` or `stroke-dashoffset` (hero data packets) — no layout
animation, no JavaScript animation loop. `prefers-reduced-motion: reduce` shortens every animation and
transition to ~0 and hides purely decorative motion (`.motion-decorative`, e.g. moving data packets);
skeleton shimmer becomes static.

## Accessibility checklist

- Skip link to `#main`; landmarks (`header`, `nav` with labels, `main`, `footer`); breadcrumbs `aria-current`
- Visible `:focus-visible` ring (cyan, 2px, offset) on all interactive elements, including stretched-link cards
- Menus: `aria-expanded` / `aria-controls`, Escape closes and returns focus, mobile menu moves focus into the panel
- Forms: labels for every field, required markers with screen-reader text, `aria-invalid` + `aria-describedby`
  error messages, error summary with focus management, `aria-busy` while submitting, success announced via `role="status"`
- Decorative SVG/graphics are `aria-hidden`; icons are `focusable="false"`
