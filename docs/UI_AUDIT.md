# UI audit — A.I. Commerce Studio (before the premium redesign)

Date: 2026-10-24. Branch `redesign/premium-ui`, base commit `40b03e0` (clean working tree).
Method: real browser screenshots with Playwright (Chromium) of 16 routes at 1440 px and 390 px
(full page + viewport slices), overflow measured at 1440 / 1024 / 768 / 390 / 360 px, plus code
review of `globals.css`, primitives and page components.
Baseline artefacts (not committed): `apps/web/e2e/screenshots/before/` — regenerate with the command
in [UI_IMPLEMENTATION_REPORT.md](UI_IMPLEMENTATION_REPORT.md#screenshots).

## Summary

The site is technically solid (accessible, fast, bilingual) but looks like a well-made generic
"dark AI agency" template: one near-black surface everywhere, glowing gradients, an orbital node
diagram in the hero and the same rounded card grid repeated in almost every section. Nothing
visually says *e-commerce engineering* or *controlled automation*, which is the actual
differentiator.

## Findings (prioritised by impact)

| # | Severity | Area / route | Problem | Why it hurts | Redesign action |
| --- | --- | --- | --- | --- | --- |
| 1 | **High** | Home hero (`/bg`, `/en`) — `HeroVisual` | Orbital "AI orchestration" hub with six floating nodes and glow rings. | Reads as decorative AI stock art; says nothing about how the studio works; indistinguishable from AI agency templates. | Replace with a product-style **workflow run panel**: store event → API payload → AI structured output → rule checks + human approval → business action, clearly labelled as a demo with illustrative data. |
| 2 | **High** | Home, services, problems, industries, advantages, use cases, engagement, AI control | The same rounded "icon badge + title + text" card in ~8 consecutive sections. | No rhythm or hierarchy; the eye cannot tell which section matters; page feels long and repetitive (12 sections ≈ 12,100 px at 1440). | Give each section its own composition: bento service grid, light editorial problem index, pipeline diagram, stepped process, capability matrix, editorial insights list. Cut the duplicated use-case and technology-strip sections. |
| 3 | **High** | Service grid (home, `/uslugi`) — `ServiceCard` | Uniform 3-column grid, 7th service as a full-width outlier card; hard-coded counters `01`–`07`. | Visually awkward last row; counters add noise and imply a ranking. | Asymmetric 12-column bento (2 + 3 + 2) with two featured tiles, per-service motif, no counters. |
| 4 | **High** | Global — `globals.css` | One near-black surface (`#050811`) for every section, gradient text, glow blobs, violet + cyan + blue gradients on buttons. | Monotone, "neon" impression; low perceived craft; gradient headlines reduce legibility. | New token system: deep navy page, two elevated surfaces, a light editorial surface for contrast sections, a single teal brand accent + periwinkle secondary, solid primary button, no gradient text. |
| 5 | **Medium** | Typography — `h3`/card titles (Manrope) | Small Manrope headings in Cyrillic look unevenly spaced (`-0.02em` tracking); body muted text is pale grey on black. | Bulgarian looks less polished than English; long reading feels tiring. | Manrope only for display sizes (≥ 28 px) with milder tracking; Inter for small headings; add JetBrains Mono for technical labels; body text one step brighter. |
| 6 | **Medium** | Eyebrows / labels | Uppercase, 0.16em tracking, cyan, with gradient hairline — on every section. | Repetitive decoration; wide-tracked Cyrillic caps are hard to read. | Mono label with a small square marker, less tracking, used sparingly. |
| 7 | **Medium** | Process (`/bg` home, `/proces`) | Six circles on a line with small text. | Generic; text cramped at 1440, stacks into a long list on mobile. | Stepped editorial sequence with sticky heading on desktop and a vertical rail on mobile. |
| 8 | **Medium** | "AI suggests, people decide" | Four cards with arrows inside a glowing box. | The key message (AI suggestion vs authorised action) is not visualised. | Pipeline with explicit *AI may* / *needs approval* lanes and a structured-output preview. |
| 9 | **Medium** | Insights preview | Three identical article cards. | No editorial hierarchy. | One featured article + list rows with category, date and reading time. |
| 10 | **Medium** | Service detail pages | Every service uses the same hero + card grids; no visual tied to the discipline. | Seven pages feel like one template. | Discipline-specific conceptual hero visual (maintenance cycle, crawl/index map, app architecture, process flow, measurement framework, system architecture, audit checklist) and editorial "signs" list. |
| 11 | **Medium** | `/bg/uslugi`, `/en/services` at 360 px | Horizontal overflow of 7 px / 3 px. | Sideways scrolling on small phones. | Fix in the new grid (min-width 0, no fixed widths). |
| 12 | **Low** | Header | Pill buttons, glowing gradient CTA, brand wordmark with blue "Studio". | Slightly loud for a premium consultancy. | Compact header, solid CTA, refined wordmark, quieter language switcher. |
| 13 | **Low** | Final CTA | Long title, two equal buttons, bullet points. | Diffuse conversion moment. | Concise statement (“Имате технически проблем или идея за автоматизация?” / “Have a technical challenge or an automation idea?”), one primary CTA. |
| 14 | **Low** | Contact / advisor | Functional and clear, but share the same glowing card styling. | Inconsistent with the new identity once tokens change. | Inherit new tokens; calmer form surfaces; keep all behaviour. |
| 15 | **Low** | Admin | Readable; filters wrap unevenly at 1440; table dense but OK. | Minor. | Inherit tokens; no behavioural change. |

## Accessibility baseline

* Contrast: primary/secondary text pass AA; muted `#94a3b8` on `#050811` ≈ 7:1 (pass).
* Focus: visible 2 px cyan outline on all interactive elements (pass).
* Reduced motion: global rule disables animations (pass).
* Touch targets: header language links ≈ 32 px high on mobile (borderline) → raise to ≥ 40 px.
* Semantics: one H1 per page, landmarks, labelled forms (pass; verified by the existing e2e suite).

## Responsiveness baseline (horizontal overflow in px, `overflow.json`)

All 16 routes: 0 px at 1440 / 1024 / 768 / 390. At 360: `services-bg` 7 px, `services-en` 3 px.
