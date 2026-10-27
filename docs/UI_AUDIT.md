# UI audit — A.I. Commerce Studio (before the premium redesign)

> **Historical (status 2026-10-27).** This is the audit of the design before the premium redesign
> (base `40b03e0`). The issues it lists were addressed by the redesigns now in `main`.

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

---

## Round 2 — editorial redesign brief (2026-10-24)

Base: branch `redesign/premium-ui` @ `42173f5` (the first redesign; `main` still has the original
design). Work continues on `design/premium-editorial-redesign`. Baseline: 10 key pages × 5 widths
(1440 / 1024 / 768 / 390 / 360) in `apps/web/e2e/screenshots/baseline2/`.

| # | Severity | Files | Finding | Impact | Planned solution |
| --- | --- | --- | --- | --- | --- |
| R1 | **High** | `sections/ServiceBento.tsx`, home, `/uslugi` | Featured tiles are maintenance and AI Managed Services; AI development and automation look like supporting services. | The offering's lead proposition (AI + automation) is not visually leading. | Two curated groups: *AI & automation* (three large panels: custom AI, automation, AI Managed Services) and *core operations* (four compact rows); groups derived from service keys, nothing hard-coded by count. |
| R2 | **High** | home, `advisor/AdvisorPromo.tsx` | The AI Automation Advisor appears only as a promo banner. | No tangible proof of engineering competence. | Product showcase: example input → structured output preview (labelled sample), what it does, link to the real tool. |
| R3 | **High** | home | No homepage feature for AI Managed Services and no compact credibility strip after the hero. | The newest service is only one tile; first scroll lacks trust signals. | Dedicated AI Managed Services feature (lifecycle + plans, no prices/SLA) and a concise capability strip (platforms, practices — no logos, no numbers). |
| R4 | Medium | `home/HeroWorkflow.tsx` | On phones the full workflow panel (~800 px) follows the CTA. | Long first scroll on mobile. | Compact mobile variant (key steps only, details from `sm`). |
| R5 | Medium | `uslugi/ai-managed-services/page.tsx` | 13 dense sections; navigation chips only in the hero; long lists of equal weight. | Hard to scan; key information buried. | Sticky in-page navigation, grouped capability chapters with progressive disclosure, clearer plan comparison, CTAs between chapters. |
| R6 | Medium | `layout/Footer.tsx` | Four equal link columns. | Generic, no editorial hierarchy. | Statement + CTA row, grouped service/company/legal columns, quiet meta row. |
| R7 | Medium | `contact/ContactForm.tsx`, `kontakti/page.tsx` | One long list of fields. | Form feels heavier than it is. | Visual grouping (inquiry type, about you, project), calmer surfaces; schema/API unchanged. |
| R8 | Low | `ProcessSteps` on home | Vertical sequence repeats the rhythm of the problem index. | Less variety. | Horizontal timeline on desktop (vertical on mobile). |
| R9 | Low | `sections/HeroVisual.tsx`, dictionaries `ui.heroVisual` | Orbital hero component no longer used. | Dead code. | Remove after checking references. |
| R10 | Low | `globals.css` `.t-label` | Uppercase mono labels used often. | Visual noise, harder Cyrillic reading. | Sentence-case labels; uppercase only for tiny metadata. |
