# Bulgarian language and style review

Branch `content/bg-language-style` (from `origin/main`). Scope: public Bulgarian copy under
`apps/web/src/content/bg/` and `apps/web/src/i18n/dictionaries/bg.ts`.

**Honest coverage statement.** This pass was *targeted*, not exhaustive. The existing Bulgarian is
already in good shape (earlier editorial passes), so most of it was deliberately kept. What was read
in full and what was only scanned is listed in section 5; the unreviewed files are listed in
section 10 so nothing is silently assumed to be done.

## 1. Editorial principles applied

Voice: an experienced Bulgarian engineer explaining a system to another professional. Direct verbs
(«Изграждаме», «Следим», «Получавате»), short sentences, no consulting filler. Established English
terms stay (API, webhook, RAG, CI/CD, GitOps, Kubernetes, landing zone, SLA/SLO, RBAC, MFA).
Governance meaning was never weakened: approval before consequential actions, immutable and
attributed records, no invented claims. Formal plural for every CTA.

## 2. Terminology glossary (decisions)

| Concept | Preferred BG | Notes |
|---|---|---|
| AI | AI | Compact UI/product text. «изкуствен интелект» only in flowing prose and slogans. |
| LLM, RAG, API, webhook, MCP, CI/CD, GitOps, SRE, FinOps, RBAC, MFA, OIDC | unchanged | Surrounding Bulgarian only. |
| human approval | одобрение от човек / «одобрява човек» / «чака решение от човек» | Vary wording; keep «одобрение» (approval) distinct from «преглед» (review). |
| written scope | «писмена оферта с ясен обхват» / «договорен обхват» / «предварително договорен обхват» / «ясно описан обхват» | Chosen per context; not globally replaced. |
| managed service | «AI Managed Services» as the product name; «управлявана услуга» in prose | |
| observability | «наблюдаемост» in technical copy; «наблюдение» in business copy | Distinct from monitoring («мониторинг»). |
| landing zone | «landing zone» («облачна landing zone») | Not «основна зона». |
| workflow | работен поток / процес | Chosen per sentence. |
| production | «в продукция», «непродукционна среда» | Already consistent in the corpus. |
| pipeline | currently «конвейер» (18 uses) | **Open question**, see section 10. |
| audit log | журнал / неизменен журнал | |
| fallback, rate limit, guardrail, embedding, prompt | English term kept where specialists use it | |

## 3. High-impact changes

| Before | After | Reason |
|---|---|---|
| Превръщаме AI и облака в системи, които работят за бизнеса ви | Изграждаме AI и облачни системи, които работят за бизнеса ви | Direct verb, less translated; positioning unchanged. |
| Работим по писмен обхват, а важните действия се одобряват от човек. | Обхватът се уточнява писмено, преди да започнем, а важните действия одобрява човек. | Natural word order, active voice, same governance. |
| Системите си казват за промени с подписани webhooks, а оркестраторът извиква API идемпотентно. | Системите съобщават за промени чрез подписани webhooks, а оркестраторът извиква целевите API идемпотентно. | Removes the conversational/anthropomorphic phrase. |
| Действия с ефект чакат решение от човек; решенията се записват неизменно и с идентичност. | Действията с реален ефект чакат одобрение от човек, а всяко решение се записва в неизменен журнал заедно с идентичността на този, който го е взел. | Keeps approval, immutability and attribution explicit. |
| Документирани и тествани системи, които се наблюдават и които екипът ви може да поддържа. | Документирани и тествани системи с наблюдение, които екипът ви може да поддържа сам. | Shorter, one relative clause. |
| Ние се грижим той да работи надеждно, сигурно и ефективно всеки ден. | Грижим се той да работи надеждно и сигурно всеки ден. | Drops the English-style subject pronoun and the filler «ефективно». |
| Хора правят тази работа, с писмен обхват. | Работата се върши от хора, в ясно описан обхват. | |
| Нужда от развързване на системите. | Системите трябва да са слабо свързани. | «Развързване» is a calque of «decoupling». |
| Взрив на обема / Опасен план | Рязък скок на обема / План с рискови промени | Calques from English. |

## 4. Global changes

* **CTA family unified to the formal plural**: «Поискай оферта» → «Поискайте оферта» (button, mobile
  bar, `common.requestQuote`), «Поискай консултация» → «Поискайте консултация», «Покажи всички» →
  «Покажете всички» (×2), «Покажи всички измерения» → «Покажете всички измерения», «Запази и вземи
  връзка» → «Запазете и вземете връзка», «Затвори менюто» → «Затворете менюто» (matches the already
  formal «Отворете менюто»).
* Validation: «Невалиден телефонен номер.» → «Въведете валиден телефонен номер.» (same pattern as the
  e-mail message).
* «Писмен обхват» varied by context (see glossary) in `home.ts`, `domains.ts`, `offer-pages.ts`,
  `tools.ts`, `workshops.ts` and the shared dictionary.
* Tests and e2e specs that assert the changed labels were updated in the same change
  (`Header.test.tsx`, `i18n.spec.ts`, `ia.spec.ts`, `mobile.spec.ts`, `seo.spec.ts`,
  `team-costs.spec.ts`, `public.spec.ts`). The e2e specs were **not run** (no Playwright stack here).

## Validation

Run in Docker (`ai-commerce-studio-web-tests` image, current sources mounted): `npm run typecheck`
clean, `npm run lint` clean, `vitest` 857/857 passed (baseline before edits: 857/857). Three edited
sentences are part of the service-catalogue seed, so `src/lib/catalogue-seed.json` was regenerated
with `UPDATE_CATALOGUE_SEED=1` (3 lines changed, all from this review). Playwright e2e and a visual
check were not run.

## 5. Page-specific changes and coverage

Read in full and edited where needed: `i18n/dictionaries/bg.ts`, `content/bg/home.ts`,
`content/bg/pages.ts` (tools page, services page, industries, about, process, AI solutions),
`content/bg/reference.ts` (page chrome, first scenarios, pattern texts), the opening of
`content/bg/ai-managed.ts`.

Scanned by pattern across all `content/bg/*.ts` (filler, calques, CTA verbs, scope wording,
terminology counts), with matching lines inspected: everything else.

Edited lines outside the files above: `services.ts` and `ai-managed.ts` (filler), `services-offer.ts`
(«покрива с тестове» → «проверява с тестове»), `legal.ts` (only the quoted name of the mobile bar
button, see section 9).

## 6. Kept intentionally

Reviewed and left unchanged because they already read naturally: the FAQ in `home.ts` (including «Не.
Много проекти започват с поддръжка, SEO или интеграции…» and «Често проста автоматизация е по-подходяща —
и го казваме.»), the contact page copy («Разкажете ни за проекта си», «Колкото по-конкретно опишете
задачата…»), «Работещата AI система не остава същата…», the process steps on the home page and
`processPage`, the about page principles, the approval-policy table, and the terse scenario and
pattern texts in `reference.ts`. Disclaimers using «не гарантираме» were kept as-is (they are the
intended limitation language).

## 7. Technical or UI issues found

* The audit's concatenations («01Вашите данни и системи», «Започнете оттукРаботи сега») are
  **extraction artefacts**: `SystemMap.tsx` renders the number in an `aria-hidden` span beside the
  title, and the «Започнете оттук» badge sits next to the «Работи сега» badge in separate elements. No
  string was edited for them. The remaining examples («WooCommerceExcel / Google SheetsКуриерски
  услуги», «Работна срещаИндивидуален обхват») follow the same chip/badge pattern but were not
  individually traced.
* No rendering defect was found; no layout was visually checked (see section 10).

## 8. EN/BG semantic mismatches

None found in the strings reviewed. The EN version was not edited.

## 9. Legal copy not touched

`content/bg/legal.ts` was not restyled. One exception, to keep the text true: it names the mobile bar
button, so «Поискай оферта» became «Поискайте оферта» to match the button. Flag for the lawyer's next
review. `founder.ts` was **not touched** (protected in `CLAUDE.md`).

## 10. Remaining questions and work not done

1. **Founder profile** (`content/bg/founder.ts`, protected): the home blurb still reads like AI
   marketing. Proposal for approval, keeping the facts:
   «Той създава Iskrev Consulting Ltd, за да помага на организациите да стигат от идея за AI до
   работещи системи в продукция. Работи на границата между стратегия и инженерство: консултира,
   проектира архитектурата, ръководи реализацията и поема експлоатацията.»
   Also `contactCta.heading` uses capital «Ви» («следващата Ви инициатива»), while the rest of the site
   uses «ви». The profile is heavy on English («production-grade», «knowledge системи», «vector
   pipelines»); it needs the owner's rewrite or sign-off.
2. **«Конвейер» vs «pipeline»**: 18 uses incl. the SEO keyword «CI/CD конвейери». Bulgarian
   practitioners mostly say «pipeline». Changing it touches SEO keywords and Bulgarian plural forms, so
   it needs a decision.
3. **Not reviewed in full**: `services.ts`, `services-depth.ts`, `services-template.ts`,
   `services-offer.ts`, `domains.ts`, `tool-*.ts`, `tools.ts`, `advisor.ts`, `articles*.ts`,
   `workshops.ts`, `agent-library.ts`, `seo.ts`, `editorial.ts`, most of `ai-managed.ts` and the middle
   of `reference.ts`. They passed the pattern scans but a line-by-line pass remains.
4. **Out of scope here**: customer account UI (`i18n/account.ts`), staff admin UI
   (`i18n/admin/bg.ts`, e.g. «Покажи ключа», «Поискай промени»), components with hard-coded Bulgarian,
   `aria-label`s other than those in the shared dictionary.
5. **Not done**: browser review of the listed sample pages (no Node on this machine; checks ran in
   Docker), mobile navigation and layout-length checks, e2e run, the 4.3 MB audit file was not processed
   line by line (only its header and the cited examples).
6. `nav.servicesFoundation` = «E-commerce основа» reads slightly odd; left alone because the context
   was not clear.
