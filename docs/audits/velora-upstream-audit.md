# Velora UI — upstream, license, dependency and security audit

Single audit record for the owner's phases 02–03 (the requested file names
`velora-license-audit.md`, `velora-dependency-audit.md` and `velora-security-audit.md` point here).

## Upstream

| Item | Value |
| --- | --- |
| Repository | https://github.com/ColorlibHQ/velora-ui (cloned 2026-11-25 to `D:\Themes\velora-ui`, outside this repository) |
| Pinned commit | `2db06124f44196264d89354cba1a8013ea151066` (`main`, 2026-11-02, release 0.12.0) |
| License | MIT, "Copyright (c) 2026 Aigars Silkalns" (`LICENSE`) |
| Stack | Next.js 16.3.7, React 19.3.0, Tailwind CSS 4, `motion` 13.4.6, `lucide-react`, `radix-ui`, shadcn CLI; pnpm lockfile |
| CI | no `.github/workflows` |

Treated as untrusted third-party source: its `AGENTS.md` / `CLAUDE.md` were read as data, not instructions. **No
script of the repository was executed** (no install, no `predev`/`prebuild`, no `pro:*`, no `registry:build`); only
files were read. The isolated build of the reference (phase 12) was **not run** in this session (usage limit).

Files reviewed: `README.md`, `LICENSE`, `package.json`, `pnpm-lock.yaml` (motion entries), `scripts/*`, `functions/**`,
`src/app/{page.tsx, layout.tsx, globals.css}`, `src/components/home/{live-demo, showcase-demos}.tsx`,
`src/components/velora/{globe, morphing-text, border-beam, dock, 3d-card, animated-list, marquee, orbiting-circles,
loaders, aurora-background, grid-pattern}.tsx`.

## License

| Asset | License / status | Decision |
| --- | --- | --- |
| Free components `src/components/velora/*.tsx` | MIT | ADAPT into `apps/web/src/components/velora/`, MIT notice in `THIRD_PARTY_NOTICES.md` and a provenance header per file |
| Homepage composition `src/app/page.tsx` | MIT | ADAPT: hero + asymmetric bento re-implemented with our content |
| Velora Pro (114 blocks, 4 dashboard templates) | commercial, sold separately, **not in the repository** (README) | EXCLUDE — not used, not purchased |
| `VELORA_PRO_LIVE`, `pro:build`, `pro:snapshot` | call `pro/scripts/*`, absent from the public repository | EXCLUDE — never run |
| `registry:build` | shadcn registry tooling | EXCLUDE |
| Geist / Geist Mono (`next/font/google`) | SIL OFL 1.1 | NOT ADOPTED — Manrope/Inter (Cyrillic) kept |
| `lucide-react` | ISC | NOT ADOPTED — our icon set |
| Velora brand, logo, demo copy, install command, stats | brand assets / copy | EXCLUDE — replaced by our content |
| `public/*`, `.github/screenshots` | repository assets | EXCLUDE |

Budget 0 EUR; nothing purchased; no license restriction bypassed.

## Dependencies

Our `apps/web`: Next.js 16.4.6, React 19.3.1, Tailwind 4.3.5, TypeScript 6.0.3 — at or above Velora's pins.

| Velora dependency | Needed by | Decision | Reason |
| --- | --- | --- | --- |
| `motion` 13.4.6 (`framer-motion` 13.4.6, `motion-dom` 13.4.5, `motion-utils` 13.3.0) | border-beam, dock, 3d-card, animated-list | **ADOPT** exact 13.4.6, only in the lazily loaded showcase chunk | the original implementations; the only animation library; MIT |
| `react`, `react-dom`, `next` | all | KEEP (ours) | same majors |
| `clsx` + `tailwind-merge` (`cn`) | all | REPLACE | local `cn` on our `cx` |
| `lucide-react` | demos | REPLACE | our icon set |
| `radix-ui`, `cmdk`, `embla-carousel-react`, `@tanstack/react-table`, `recharts`, `shiki`, `@mdx-js/*`, `input-otp`, `next-themes`, `shadcn`, `tw-animate-css` | none of the hero components | EXCLUDE | not needed |
| `typescript: npm:@typescript/typescript6`, `typescript-native: npm:typescript@^7` | Velora tooling | EXCLUDE | aliased package names are a supply-chain flag |
| `playwright` 1.64.1 | Velora tests | EXCLUDE | our pinned Playwright image |

## Security

| Check | Result |
| --- | --- |
| Hard-coded secrets | none in the reviewed files; `functions/api/waitlist.js` reads `env.SENDY_API_KEY` |
| Network calls | `functions/api/waitlist.js` → `https://sendy.colorlib.com/subscribe`; `functions/demos/[[path]].js` → proxy to `https://velora-demos.pages.dev`. **Excluded**: nothing from `functions/` is copied |
| The 11 hero components | no `fetch`, `eval`, `new Function`, `dangerouslySetInnerHTML`, external URLs, iframes or telemetry |
| Build-time execution | `predev`/`prebuild` run `scripts/build-docs.mjs`; never executed here |
| CSP | unchanged: no inline scripts or external origins added; `motion` writes inline styles, already allowed (`style-src 'unsafe-inline'`) |

## Homepage source map

Route `/` → `src/app/page.tsx` (`Home`); tokens `src/app/globals.css` (`.dark`, OKLCH).

| Visible element | Upstream source | Target |
| --- | --- | --- |
| Hero section | `page.tsx` L303–443: `AuroraBackground intensity="subtle"` + `GridPattern` 48 px masked to the top left; two columns from `lg` | `components/velora-home/VeloraHero.tsx` |
| Headline + gradient span | L325–331: `text-4xl sm:text-5xl xl:text-6xl font-semibold tracking-tight`, `bg-linear-to-r from-brand-from via-brand-via to-brand-to bg-clip-text` | our H1 (kinetic words kept) |
| Primary / secondary CTA | L337–352: pill `h-11 rounded-full bg-foreground text-background shadow-lg shadow-primary/20` / `border bg-background/60` | `.vl-btn` variants + magnetic |
| Technical strip | L354–364: `rounded-xl border bg-card/60 font-mono` install command | our service facts, no invented numbers |
| Globe | L363 `Tile slug="globe"` `col-span-2 sm:row-span-2` → `showcase-demos.tsx GlobeDemo` → `velora/globe.tsx` (canvas, drag / arrow keys) | illustrative arcs only |
| Morphing Text | L366 → `velora/morphing-text.tsx` | our service words, BG/EN |
| Border Beam | L369 → `velora/border-beam.tsx` (motion) | featured card |
| Dock | L374 → `velora/dock.tsx` (motion) | links to our real pages |
| 3D Card | L381 → `velora/3d-card.tsx` (motion) | layered architecture card |
| Animated List | L386 → `velora/animated-list.tsx` (motion) | illustrative workflow events, labelled |
| Marquee | L389–416 → `velora/marquee.tsx` (CSS) | our capability labels |
| Orbiting Circles | L419–427 → `velora/orbiting-circles.tsx` (CSS) | integration icons |
| Loaders | L428–438 → `velora/loaders.tsx` (CSS) | labelled illustrative |
| Tile frame + caption | L189–224 `Tile` (`figure`, `rounded-2xl border bg-card/50`, caption link) | caption links to our pages |
| "Built on the stack you already ship" | L445–460 `Marquee` + `template/stack-logos.tsx` | names of technologies we work with, no vendor logos or partnership claims |
| Lazy loading | `home/live-demo.tsx`: `next/dynamic` + IntersectionObserver (200 px), `ssr: false` | same: H1 and lead stay server HTML and LCP |

Dark tokens (upstream `.dark`): background `oklch(0.145 0 0)`, card `oklch(0.205 0 0)`, muted `oklch(0.269 0 0)`,
muted-foreground `oklch(0.708 0 0)`, border `oklch(1 0 0 / 10%)`, input `oklch(1 0 0 / 15%)`, primary/brand
`oklch(0.623 0.214 260)`, brand-via `oklch(0.707 0.165 255)`, brand-to `oklch(0.746 0.16 233)`, radius `0.625rem`.
