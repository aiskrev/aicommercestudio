# Internationalization (BG / EN)

One Next.js application and one API serve both languages. Bulgarian (`bg`) is the default and the
reference language; English (`en`) is a full, professionally written translation (not machine
translated in the browser).

## URLs

Every public URL carries its locale. Internal route folders use the Bulgarian segment names; English
URLs are rewritten to them by `src/proxy.ts` (decision logic in `src/lib/locale-routing.ts`).

| Page | Bulgarian | English |
| --- | --- | --- |
| Home | `/bg` | `/en` |
| Services | `/bg/uslugi` | `/en/services` |
| Service | `/bg/uslugi/seo-optimizatsiya` | `/en/services/seo-optimization` |
| AI Managed Services | `/bg/uslugi/ai-managed-services` | `/en/services/ai-managed-services` |
| AI solutions | `/bg/ai-resheniya` | `/en/ai-solutions` |
| AI advisor | `/bg/ai-automation-advisor` | `/en/ai-automation-advisor` |
| Tools hub | `/bg/instrumenti` | `/en/tools` |
| Tool | `/bg/instrumenti/ai-gotovnost`, `ai-ekip`, `roi-kalkulator`, `avtomatizatsii`, `ai-reshenie` | `/en/tools/ai-readiness`, `ai-team`, `roi-calculator`, `automation-finder`, `solution-builder` |
| Planned tool intro ("Coming soon", `noindex`) | eight slugs in `lib/tool-slugs.ts`, e.g. `/bg/instrumenti/finops-i-ai-razhodi` | e.g. `/en/tools/finops-ai-cost` |
| AI Agent Library | `/bg/ai-agenti`, `/bg/ai-agenti/<slug>` | `/en/ai-agents`, `/en/ai-agents/<slug>` (slugs in `src/lib/agent-slugs.ts`) |
| Industries | `/bg/za-kogo` | `/en/industries` |
| Process | `/bg/proces` | `/en/process` |
| About | `/bg/za-nas` | `/en/about` |
| Founder & CEO | `/bg/za-nas/osnovatel` | `/en/about/founder` (`EN_SUBSEGMENTS["za-nas"]`) |
| Contact | `/bg/kontakti` | `/en/contact` |
| Insights | `/bg/statii`, `/bg/statii/<slug>`, `/bg/statii/tema/<topic>` | `/en/insights`, `/en/insights/<slug>`, `/en/insights/topic/<topic>` |
| Case studies | `/bg/proekti` | `/en/case-studies` (404 until verified case studies exist) |
| Legal | `/bg/poveritelnost`, `/bg/biskvitki`, `/bg/obshti-usloviya` | `/en/privacy`, `/en/cookies`, `/en/terms` |
| Admin | `/admin` (no locale in the URL, see below) | |

Segment mapping: `EN_SEGMENTS` / `EN_SUBSEGMENTS` in `src/i18n/config.ts`. Tool slugs come from
`lib/tool-slugs.ts` into `EN_SUBSEGMENTS.instrumenti` (a Bulgarian slug under `/en/tools/` redirects
to the English one), agent slugs under `EN_SUBSEGMENTS["ai-agenti"]`. Service, article and
topic slugs are translated per locale in the content files; cross-locale identity uses a stable
`key` (`Service.key`, `Article.key`, `EditorialCategory.key` = the Bulgarian slug).

Query parameters are translated as well: `usluga ↔ service`, `tip=oferta ↔ type=quote`
(`localizeSearch`).

### Routing rules (`decideRoute`)

| Request | Result |
| --- | --- |
| `/` | **307** to `/<preferred>` — the `acs_locale` cookie if the visitor chose a language, else `/bg`. No IP, Accept-Language or geolocation detection. |
| `/uslugi/...` (legacy unprefixed) | **308** to `/bg/uslugi/...` (query kept) |
| `/bg/...` | served as is |
| `/en/services/...` | rewritten to the internal `/en/uslugi/...` |
| `/en/uslugi/...` (Bulgarian segment under `/en`) | **308** to the canonical English URL |
| `/admin/*` | session-cookie guard, unchanged |

## Language switcher

`src/components/layout/LanguageSwitcher.tsx` — `BG | EN` in the desktop header and inside the
mobile menu panel. Each option is a real link to the **equivalent page** (`alternateLocalePath`
with the slug map from `buildSlugMap()`); pages without a translation fall back to the other
language's home page. Only the service and quote-mode parameters survive a switch (tracking or other
parameters are dropped). Links carry `hreflang`, `lang` and an accessible label (“Switch to English”
/ “Превключи на български”), the current language is marked with `aria-current`.

Because the `[locale]` segment is the root layout (`<html lang>`), switching is a full navigation.

### Preference cookie

`acs_locale` = `bg` | `en`, `Path=/`, `SameSite=Lax`, 1 year, `Secure` on HTTPS. Set **only** when
the visitor clicks the switcher; it is a functional cookie (listed in the cookie policy) used for
the `/` redirect and the admin language. Not HttpOnly (set from the browser), contains nothing
personal.

## Where texts live

| Kind | Files |
| --- | --- |
| UI strings (navigation, forms, validation, a11y labels, errors) | `src/i18n/dictionaries/bg.ts` (type `Dictionary`), `en.ts` (`en: Dictionary`) |
| Page content (home, services, articles, legal, advisor, AI Managed, SEO map) | `src/content/bg/*.ts`, `src/content/en/*.ts`; `getContent(locale)` in `src/content/index.ts` |
| Admin panel | `src/i18n/admin/bg.ts` (type `AdminDictionary`), `en.ts`; labels built in `src/lib/admin-labels.ts` |
| API messages | `apps/api/app/i18n.py` (error and validation catalogues) |
| Advisor (API) | `apps/api/app/advisor/service.py` (`MESSAGES`), `safety.py` (replacements, approval text), `ai/advisor_mock.py` + `ai/advisor_mock_en.py` (demo templates), `advisor/prompt.py` (output language) |

TypeScript enforces completeness: `en` is typed with the Bulgarian shape, so a missing key fails
`tsc`. Unit tests (`src/lib/i18n.test.ts`) additionally check identical key sets, no empty strings,
no Cyrillic in English UI/content (except the language name “Български”) and no raw keys.

## SEO

* `buildMetadata` (`src/lib/seo.ts`): localized title/description, canonical = the page's own
  localized URL, `alternates.languages` with `bg`, `en` and `x-default` (→ Bulgarian), Open Graph
  `locale` (`bg_BG` / `en_US`) and `alternateLocale`. Pages that exist in one language only
  (`availableIn`) emit only that alternate.
* Structured data is localized (`inLanguage`, localized URLs, `areaServed` per locale).
* `sitemap.xml` lists every indexable URL of both languages with reciprocal `hreflang` alternates;
  draft legal pages and thin topic pages are `noindex` and omitted.
* Separate keyword maps: `src/content/bg/seo.ts`, `src/content/en/seo.ts` (search volumes are
  marked unverified).

## Backend

* Allowed locales `bg | en`; anything else → `bg`.
* `Accept-Language` selects the language of error `detail` and field messages (codes are stable).
  Validators raise `PydanticCustomError(<type>, …)`; the handler translates by type.
* `LeadCreate.locale` (default `bg`) is stored in `leads.locale` (migration `0004`), shown and
  filterable in the admin and counted on the dashboard (`by_locale`). Invalid values → 422.
* Success messages of `POST /api/public/leads` and `/quote-requests` follow `locale`.
* Team notification e-mails stay in Bulgarian and include the customer's language. Bilingual
  customer acknowledgement templates exist (`notifications.CUSTOMER_ACKNOWLEDGEMENT`) but **no code
  path sends them** until a provider and privacy review are in place.
* Advisor: `AdvisorRequest.locale` selects the output language. The Anthropic provider is told to
  write in that language; the demo engine uses deterministic English templates (still labelled as a
  demonstration, not AI). Disclaimers, notices, removal markers and the enforced write-approval are
  bilingual; claim/side-effect filters cover both languages. `GET /advisor/status` follows
  `Accept-Language`.
* The mock lead triage text stays Bulgarian (internal, rule-based); the admin shows a note when the
  admin language is English.

## Admin panel

No locale in admin URLs. The admin root layout reads `acs_locale` (`src/lib/admin-locale.ts`), sets
`<html lang>`, and provides strings through `AdminI18nProvider` / `useAdminI18n()`. The admin has
its own BG | EN toggle (login page and sidebar) that writes the same cookie and refreshes the server
components. Admin API calls send `Accept-Language`, so server messages match.

## Why a custom solution instead of next-intl

The project already had a typed `getDictionary(locale)` / `getContent(locale)` layer and a
`[locale]` route tree. Extending it kept the stable routing, gave compile-time completeness checks
for large typed content objects (not only flat message keys) and added no dependency. next-intl
would mainly have replaced the message lookup and still required the same route mapping, so it was
not introduced.

## Adding a third language (e.g. `de`)

1. `src/i18n/config.ts`: add the code to `locales`, `localeMeta` (html lang, OG locale, label,
   date locale) and a segment map (like `EN_SEGMENTS`) for translated URLs; extend
   `localizePath` / `toInternalPath` / `localizeSearch` for that map.
2. Add `src/i18n/dictionaries/de.ts` (`de: Dictionary`), `src/content/de/*` (typed against the
   Bulgarian shape) and `src/i18n/admin/de.ts`; register them in the index files.
3. `buildSlugMap()` and the switcher: extend the slug maps to more than two languages (the switcher
   currently toggles between two).
4. API: add the code to `Locale`/`SUPPORTED` in `app/i18n.py`, every catalogue entry, the
   `LeadLocale` enum + a migration extending `ck_leads_locale`, advisor messages and demo templates.
5. SEO: the sitemap and `buildMetadata` iterate over `locales` automatically; add a keyword map.
6. Tests: extend the parity / no-foreign-script tests and add e2e routes.

## Testing requirements

* Unit (`src/lib/i18n.test.ts`): same keys in every dictionary, no empty strings, no Bulgarian
  script in English UI/content, no raw keys.
* Routing/SEO unit tests (`src/lib/routing-and-seo.test.ts`): redirects, rewrites, switcher
  mapping, canonical/hreflang, bilingual sitemap with reciprocal alternates.
* E2E (`e2e/tests/i18n.spec.ts`, `seo.spec.ts`, `links.spec.ts`, `mobile.spec.ts`): real pages in
  both languages, switcher on desktop and mobile, localized validation and API messages, admin
  language, every sitemap URL crawled, no overflow at phone width.

## Adding or changing text

1. Add the key to the Bulgarian file, then the English one (tsc fails until both exist).
2. For a new page: create it under `src/app/[locale]/…` with the Bulgarian segment name, add the
   English segment to `EN_SEGMENTS`, use `buildMetadata({ locale, path })`, add it to the sitemap's
   `STATIC_PATHS` and both SEO maps.
3. Run `.\scripts\test.ps1 -Suite web` (types, lint, i18n tests) and `-Suite e2e` for routing.
