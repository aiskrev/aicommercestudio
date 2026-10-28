# SEO implementation

Last updated: 2026-10-23. Scope: the public Bulgarian site (`apps/web`). Admin pages are `noindex, nofollow`.

> **What this document does not claim.** No keyword tool, Google Search Console, Google Analytics
> or CrUX (field Core Web Vitals) data was available. Every keyword below is an **editorial
> hypothesis**, not verified search volume. Nothing here states or implies traffic growth,
> rankings, or conversion improvements. Performance numbers are **local lab measurements**
> (Lighthouse in Docker), not real-user data.

## 1. Checklist

Status: ✅ implemented and verified automatically · 🟡 implemented, verified manually or partially ·
⬜ needs real data / owner action.

| # | Requirement | Status | Implementation | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Bulgarian keyword-to-page map | ✅ (hypotheses) | `content/bg/seo.ts` and `content/en/seo.ts`: 37 pages each (including the ten domain hubs and the founder profile), primary + secondary keywords, intent, rationale, `volumeStatus: "unverified"` | `seo-map.test.ts`: unique primary keywords, no cross-page secondary/primary overlap, every service, domain hub and article mapped, all paths in sitemap |
| 2 | Distinct intent per page | ✅ | Commercial service pages vs informational articles on the neighbouring topic (e.g. SEO service ↔ "технически SEO одит" article; automation service ↔ small-business automation article); `rationale` documents each split | same test (no cannibalisation) |
| 3 | H1/H2, titles, descriptions | ✅ | One H1 per page; service H2s are service-specific (`services-depth.ts`); titles contain the primary keyword; descriptions 70–175 chars | `seo-map.test.ts` (title contains keyword, unique H2s), `content.test.ts` (length/uniqueness), e2e `seo.spec.ts` crawls **every sitemap URL**: exactly one H1, unique `<title>`, description ≥ 70 chars |
| 4 | Useful, original service information | ✅ | Every service page has: problems, scope, **technical checks** (5–6 concrete items), deliverables, a 4-step workflow, **what we need from you**, FAQ, related articles. No prices, guarantees or invented figures | `content.test.ts` (no TODO / guarantees), `seo-map.test.ts` (depth content present) |
| 5 | Internal linking | ✅ | Service → related services + related articles; article → related services, related articles, in-text contextual links; topic pages → service; home → latest articles; services hub with ItemList | `seo-map.test.ts` (all references exist; every article reachable from a service or another article; inline links point to real pages), e2e `links.spec.ts` (no broken internal link) |
| 6 | Canonicals, sitemap, robots, Open Graph | ✅ | Self-referencing canonicals; `sitemap.xml` with `lastModified` (article `updatedAt`); `robots.txt` disallows `/admin` and `/api`; OG + Twitter tags with generated image; `noindex, follow` for draft legal pages and thin topic pages (both excluded from the sitemap) | `routing-and-seo.test.ts`, `seo-map.test.ts` (sitemap policy), e2e `seo.spec.ts` (self-canonical, `og:title`, no `noindex` on sitemap URLs; legal + thin topic pages are `noindex` but return 200) |
| 7 | Structured data without fictional details | ✅ | `Organization` (brand name, `legalName` Iskrev Consulting Ltd, URL, area served, the approved e-mail and phone from `lib/company.ts`, `founder` → the Person), `Person` on the founder profile (`name`, `alternateName` in BG, `jobTitle`, `worksFor` Iskrev Consulting Ltd, `affiliation` → Organization, `image`, `knowsAbout`, e-mail, telephone; no `sameAs`), `WebSite`, `Service`, `FAQPage`, `BreadcrumbList`, `Article`, `ItemList`, `CollectionPage`. **Deliberately omitted:** address, phone, `LocalBusiness`, `aggregateRating`, `review`, `sameAs`, logo of clients, prices, author person | e2e: every JSON-LD block on every sitemap page parses and has `@context`/`@type`; article page has `Article` + `dateModified` |
| 8 | Performance / Core Web Vitals | 🟡 | Hero entrance animation removed (an element that starts at `opacity: 0` delays LCP); no third-party scripts; static generation for all public pages; CLS 0 measured. A font-preload experiment was measured and **rejected** (see §5) | Lighthouse, 3 runs per page (§5). **No measurable improvement** over the pre-change baseline beyond run-to-run variance |
| 9 | Prominent, non-intrusive quote CTAs | ✅ | "Поискай оферта" in service hero and engagement section (pre-selects service + quote type); inline CTA in the middle of every article; mobile-only sticky bar that appears after 80 % of the viewport, hides over footer / CTA sections / forms, never on `/kontakti`, dismissible for the session | e2e `seo.spec.ts` (CTA opens quote form with the right service), `mobile.spec.ts` (sticky bar appears, hides at footer, absent on contact, dismiss persists) |
| 10 | Contact-form conversion with privacy + accessibility | ✅ | Validation on blur (not on every keystroke); character counter; optional "fill an example structure" button (rejected if submitted unchanged); email hint linked with `aria-describedby`; no new required fields, no new data collected | Vitest `ContactForm.test.tsx`, e2e `seo.spec.ts` (helper + blur validation), existing contact/quote journeys |
| 11 | Editorial structure for articles and case studies | ✅ | Article types (guide / checklist / comparison / explainer), 5 topic categories at `/statii/tema/<slug>`, key points, table of contents, tables, related content; `CaseStudy` model with a publish guard | `seo-map.test.ts` (metadata, categories, tables, case-study guard) |
| 12 | Three articles | ✅ | `/statii/tehnicheski-problemi-pri-online-magazinite`, `/statii/ai-avtomatizatsiya-v-malkiya-biznes`, `/statii/shopify-ili-woocommerce` | e2e crawl + article feature test |
| 13 | No invented client results / rankings / growth | ✅ | Example calculation in the automation article is labelled hypothetical; the platform comparison contains no prices (readers are told to check current provider fees) | `content.test.ts` (rejects affirmative guarantees such as "гарантираме ръст / първо място"), manual review of all six articles |
| 14 | No invented case studies | ✅ | `caseStudies` is empty; `/proekti` and `/proekti/<slug>` return **404** until a case study passes `isPublishable()` | `seo-map.test.ts` (guard), e2e (404) |
| 15 | Opportunities vs verified volume | ✅ | `volumeStatus` + `evidence` fields; a test fails if an entry is marked verified without evidence | `seo-map.test.ts` |
| — | Search Console, Keyword Planner, field CWV | ⬜ | Requires a live domain and accounts | — |

## 2. Keyword map (unverified hypotheses)

Source of truth: [`apps/web/src/content/bg/seo.ts`](../apps/web/src/content/bg/seo.ts) (Bulgarian) and
[`apps/web/src/content/en/seo.ts`](../apps/web/src/content/en/seo.ts) (English, separate keywords chosen
for English-language searches — not translations of the Bulgarian ones). All rows have
`volumeStatus: "unverified"`. Paths in the maps are internal paths; the public URL is
`localizePath(locale, path)` (e.g. `/uslugi/ai-managed-services` → `/bg/uslugi/ai-managed-services`,
`/en/services/ai-managed-services`). New in this release: `/uslugi/ai-managed-services` —
BG primary “поддръжка и мониторинг на AI агенти”.

**International SEO:** every page has a self-referencing canonical, `hreflang` alternates for `bg`
and `en` plus `x-default` (→ Bulgarian), `og:locale` / `og:locale:alternate`, localized JSON-LD
(`inLanguage`, localized URLs). The sitemap lists both languages with reciprocal alternates. See
[INTERNATIONALIZATION.md](INTERNATIONALIZATION.md).

| Path | Primary keyword | Intent |
| --- | --- | --- |
| `/` | AI решения за онлайн магазини | commercial |
| `/uslugi` | услуги за онлайн магазини | commercial |
| `/uslugi/poddrazhka-na-online-magazini` | поддръжка на онлайн магазин | transactional |
| `/uslugi/seo-optimizatsiya` | SEO оптимизация на онлайн магазин | transactional |
| `/uslugi/ai-instrumenti-za-biznesa` | AI инструменти по поръчка | transactional |
| `/uslugi/avtomatizatsiya-na-procesi` | автоматизация на бизнес процеси | transactional |
| `/uslugi/analizi-i-konversii` | оптимизация на конверсиите | transactional |
| `/uslugi/api-integratsii-oblak-i-sigurnost` | API интеграции | transactional |
| `/uslugi/tehnicheski-odit` | технически одит на онлайн магазин | transactional |
| `/ai-resheniya` | изкуствен интелект за бизнеса | commercial |
| `/za-kogo` | технически партньор за онлайн търговци | commercial |
| `/proces` | процес на работа | navigational |
| `/za-nas` | A.I. Commerce Studio | navigational |
| `/kontakti` | заявка за оферта | transactional |
| `/statii` | статии за онлайн магазини | informational |
| `/statii/tehnicheski-problemi-pri-online-magazinite` | технически проблеми при онлайн магазините | informational |
| `/statii/ai-avtomatizatsiya-v-malkiya-biznes` | AI автоматизация в малкия бизнес | informational |
| `/statii/shopify-ili-woocommerce` | Shopify или WooCommerce | commercial |
| `/statii/tehnicheski-seo-odit-na-online-magazin` | технически SEO одит на онлайн магазин | informational |
| `/statii/ai-asistent-za-klienti` | AI асистент за клиенти | informational |
| `/statii/avtomatizatsiya-s-choveshko-odobrenie` | автоматизация с човешко одобрение | informational |

**How to verify:** check each primary and secondary keyword in Google Keyword Planner (location
Bulgaria, language Bulgarian) and, once the site is live, in Search Console → Performance. Then set
`volumeStatus: "verified"` and `evidence: "<tool>, <date>"`. Re-assign keywords whose real queries
land on a different page than planned. Low-volume terms are not a reason to delete a page that
serves customers; they are a reason not to expect traffic from it.

## 3. Indexation rules

| Page type | Indexed | In sitemap | Rule |
| --- | --- | --- | --- |
| Home, hubs, services, articles, about, process, contact | yes | yes | — |
| Legal pages (`/bg/poveritelnost`, `/bg/biskvitki`, `/bg/obshti-usloviya`, `/en/privacy`, `/en/cookies`, `/en/terms`) | **no** (`noindex, follow`) | no | while `LEGAL_TEXTS_ARE_DRAFTS = true` in `content/bg/legal.ts` (re-exported for English) — set to `false` after legal review |
| Topic pages `/bg/statii/tema/<slug>`, `/en/insights/topic/<slug>` | only with ≥ 2 articles | only when indexed | `MIN_ARTICLES_FOR_INDEXED_CATEGORY` in `content/index.ts`; currently only *Автоматизация* qualifies |
| Case studies `/bg/proekti`, `/en/case-studies` | — | — | 404 until a publishable case study exists |
| Admin, API | no | no | `X-Robots-Tag: noindex, nofollow`, disallowed in `robots.txt` |

## 4. Editorial guidelines

### Adding an article
1. Add an object to `content/bg/articles-new.ts` (or a new file spread into `articles`).
2. Required: `slug` (Latin transliteration), `title` (≤ 70 chars, otherwise add `metaTitle`),
   `description` (70–175 chars), `type`, `category`, `publishedAt`, `updatedAt`, `keyPoints` (3–5),
   `relatedServices`, `relatedArticles`, `sections`.
3. Add a keyword-map entry with a primary keyword no other page uses and `volumeStatus: "unverified"`.
4. Link it from at least one service (`relatedArticles` in `services-depth.ts`) or another article.
5. Run `.\scripts\test.ps1 -Suite web` — `seo-map.test.ts` fails on broken references, duplicate
   keywords, missing metadata or unreachable articles.

### Writing rules
- Write for the person with the problem: concrete checks, decisions and trade-offs.
- No invented statistics, prices, client names, results or "studies show" without a cited source.
- Example numbers must be labelled as hypothetical and show the calculation.
- Comparisons of third-party products: describe capabilities and trade-offs, not current prices
  (they change); link readers to the provider for fees.
- Update `updatedAt` when the content changes materially; it feeds `dateModified` and the sitemap.

### Case studies
A case study is only rendered when `isPublishable()` in `content/bg/editorial.ts` returns true:
`verification.realProject` and `verification.clientApproved` are true, `approvedBy` and `approvedAt`
are filled in, and **every** result has a `source` and `measuredAt`. Keep written client approval
outside the repository. Never publish anonymised "composite" stories as case studies.

## 5. Performance measurements (lab only)

Method: Lighthouse 13.5.0 (mobile preset, simulated throttling) in the Playwright container
against the production build in Docker (`http://web:3000`), **3 runs per page, medians**.
Lab numbers on a shared developer machine vary considerably between runs and between Docker
sessions; differences under ~0.3 s LCP or ~150 ms TBT are not meaningful here.

| Page | Before (single run, pre-change) | After — session A (median of 3) | After — session B (median of 3) |
| --- | --- | --- | --- |
| `/` | perf 88 · LCP 3.2 s · TBT 280 ms | 88 · 3.14 s · 270 ms | 97 · 2.49 s · 99 ms |
| `/uslugi/poddrazhka-na-online-magazini` | 92 · 3.1 s · 160 ms | 90 · 3.13 s · 214 ms | 92 · 3.21 s · 112 ms |
| `/kontakti` | 87 · 3.2 s · 300 ms | 88 · 3.17 s · 266 ms | 85 · 3.39 s · 310 ms |
| `/statii/ai-asistent-za-klienti` | 97 · 2.4 s · 130 ms | 94 · 2.42 s · 206 ms | 96 · 2.49 s · 126 ms |
| `/statii/shopify-ili-woocommerce` | — (new) | 93 · 2.42 s · 239 ms | 97 · 2.48 s · 111 ms |

CLS 0.000, SEO 100 and Accessibility 100 on every run. Best Practices is reduced only by local HTTP.

**Conclusion:** no measurable performance change in either direction from this iteration. Article
pages grew by ~30 KB (more content); JavaScript transfer is unchanged (~158 KB, dominated by the
React/Next.js framework chunk). TBT comes almost entirely from framework hydration.

**Rejected experiment:** preloading only the Cyrillic font files (2 preloads instead of 4) improved
LCP on `/kontakti` and the service page but made the home and article pages worse and introduced
CLS (0.008–0.024) from late Latin glyph swaps. It was reverted.

**Next steps that need a live site:** field data (CrUX / Search Console Core Web Vitals report),
real-device testing, and a CDN with HTTP/2+ and long-lived caching for `/_next/static`.

## 6. Next actions (owner)

1. Verify the keyword map in Keyword Planner and Search Console (§2).
2. After legal review set `LEGAL_TEXTS_ARE_DRAFTS = false` — legal pages become indexable automatically.
3. Company contact data is approved and central (`lib/company.ts`; `PUBLIC_CONTACT_*` can override it per build). Add an address, registration number or `sameAs` only with approved values. The e-mail in structured data does not mean the mailbox is live (see IMPLEMENTATION_STATUS).
4. Submit `sitemap.xml` in Search Console; monitor coverage and the Core Web Vitals report.
5. Add articles to reach ≥ 2 per topic so topic pages become indexable.
6. Add a case study only with written client approval and sourced results.
