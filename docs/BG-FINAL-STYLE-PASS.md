# Bulgarian final style pass

Branch `content/bg-final-style-pass` (from `origin/main` `ec25aa4`). A targeted pass over the remaining
literal translations, corporate phrasing and terminology inconsistencies. It follows
`docs/BG-LANGUAGE-STYLE-REVIEW.md` and is **not** another global rewrite: everything that already read
naturally was kept (section 12). English copy, routes, slugs, prices, legal meaning and application
behaviour are untouched. Not committed and not deployed.

## 1. Files changed

Bulgarian content: `content/bg/{founder,home,pages,domains,tools,offer-pages,workshops,reference,ai-managed,services,tool-team,tool-readiness,tool-finder,tool-engineering}.ts`,
`i18n/dictionaries/bg.ts`.
Code (one optional field, no behaviour change): `content/types.ts` (`DomainContent.ctaLead?`) and
`components/sections/DomainHub.tsx` (`domain.ctaLead ?? labels.ctaLead`).
Shared data that mirrors the content: `lib/workshop-keys.json` + `apps/api/app/workshop_keys.json`
(identical copies), `lib/catalogue-seed.json` + `apps/api/app/catalogue/seed_v1.json`,
`lib/team-texts.json` + `apps/api/app/team/texts.json` (regenerated with the repository's own
`UPDATE_*=1` switches; one line, one line and two lines changed).
Tests that pin changed wording: `components/sections/founder.test.tsx`, `e2e/tests/founder.spec.ts`
(the founder heading only; the protected-content tests are unchanged).

## 2. Routes affected

`/bg`, `/bg/za-nas`, `/bg/za-nas/osnovatel`, `/bg/uslugi` and every service and domain page (shared CTA
lead, "Как работим заедно"), the ten domain hubs, `/bg/instrumenti`, `/bg/instrumenti/ai-ekip`,
`/bg/instrumenti/ai-reshenie`, `/bg/rabotni-sreshti` and the landing-zone assessment
(`/bg/rabotni-sreshti/otsenka-na-oblachna-osnovna-zona`, slug unchanged), `/bg/demo-tsentar`,
`/bg/referentni-stsenarii`, `/bg/integratsionni-modeli`, `/bg/kontakti` (next steps, the workshop list).
All checked routes return 200 with no change of URL.

## 3. Exact phrases changed (before → after → reason)

| Before | After | Reason |
| --- | --- | --- |
| Нека обсъдим следващата Ви инициатива | Нека обсъдим проекта ви | Ceremonial; capital «Ви» broke the platform's lowercase address; «инициатива» → «проект». |
| Ако планирате инициатива в областта на AI, cloud, platform engineering или технологичната трансформация, свържете се с Iskrev Consulting Ltd, за да обсъдим възможността, техническия контекст и най-подходящия подход за реализация. | Ако планирате проект с AI, облачни платформи или платформен инженеринг, свържете се с нас. Ще обсъдим целите, техническия контекст и най-подходящата първа стъпка. | Removes «обсъдим възможността» and «подход за реализация»; one natural sentence per idea. |
| Александър Искрев е основател и CEO на Iskrev Consulting Ltd и технологичният лидер зад A.I. Commerce Studio. С над две десетилетия опит в enterprise архитектурата и инженерната реализация той консултира организации при проектирането, модернизацията и експлоатацията на сигурни, устойчиви и мащабируеми технологични платформи. | Александър Искрев е основател и CEO на Iskrev Consulting Ltd и създател на A.I. Commerce Studio. Има над 20 години опит в архитектурата и изграждането на корпоративни технологични платформи. Консултира организации при създаването, модернизирането и поддръжката на облачни, AI и критични инфраструктурни решения. | Profile intro in the direction the brief gave; no new facts. |
| … опит в enterprise AI, cloud платформи, DevOps, Site Reliability Engineering и критична инфраструктура. | … опит в корпоративни AI решения, облачни платформи, DevOps, SRE и критична инфраструктура. | One strategy per sentence instead of English nouns inside Bulgarian grammar. |
| Той създава Iskrev Consulting Ltd, за да помага на организациите уверено да преминават от AI амбиция към реални production решения, съчетавайки стратегическо технологично консултиране с практическа архитектура, инженерна реализация и оперативно лидерство. | Основал е Iskrev Consulting Ltd, за да помага на организациите да стигнат от идея за AI до работещи системи в реална среда. Съчетава стратегическо консултиране, практическа архитектура, изграждане на системите и ръководство на експлоатацията им. | «AI амбиция», «production решения», «инженерна реализация», «оперативно лидерство». |
| Международни enterprise програми … комплексни международни инициативи в … hybrid cloud, software-defined инфраструктура, … storage, security, automation, observability и disaster recovery | Международни корпоративни програми … сложни международни проекти в … хибриден облак, софтуерно дефинирана инфраструктура, … съхранение на данни, сигурност, автоматизация, наблюдаемост и възстановяване след аварии | A list of general concepts in Bulgarian; product names (Azure, AWS, Kubernetes) and the client names stay. Facts and numbers unchanged. |
| Enterprise AI и AI platform engineering (title and text) | Корпоративен AI и платформи за AI | Established terms kept where they are terms of art (RAG, embedding, vector pipelines, model serving, GPU платформи); the rest is Bulgarian. |
| … да изграждат production-grade системи и да прилагат оперативната дисциплина, необходима AI услугите да създават дългосрочна стойност. | … да изградят системи, готови за реална експлоатация, и да въведат дисциплината в работата им, която е нужна, за да носи AI дългосрочна полза. | |
| AI може самостоятелно | Какво AI може да прави самостоятелно | Incomplete construction. «Изисква одобрение» and «Винаги се записва» are kept; the three headings fit on one line on desktop and wrap cleanly at 375 px. |
| Действията с реален ефект чакат решение от човек. | Действието изчаква одобрение от човек. | Varied wording per place (below); the governance meaning is unchanged. |
| Действията с реален ефект върху клиенти, цени или поръчки изискват одобрение от човек. | Промени, които засягат клиенти, цени или поръчки, се изпълняват само след одобрение от човек. | The sentence given in the brief. |
| AI агентите … не ги изпълняват самостоятелно, когато те имат реален ефект. Ето как класифицираме действията: | … не изпълняват самостоятелно онези, които засягат клиенти, цени, поръчки или чувствителни данни. Ето как ги класифицираме: | Names what is affected (the table below it also covers sensitive data). |
| Работи сега | Налично | A status label that read as «is executing work». Filter «Работят сега» → «Налични». |
| Работи сега, без регистрация. Резултатът е първа оценка. (Demo centre legend) | Достъпен е веднага, без регистрация. Резултатът е първа оценка. | A sentence, not a status label. |
| Съставете решение (CTA) | Проектирайте решение | Architecture work. The description now reads «Проектирайте решение с агенти, интеграции и точки за одобрение и получете архитектурна схема за обсъждане.» The output line still says it is a schema, not a built system. |
| Опишете задачата си и ще ви предложим подходящ обхват и модел на сътрудничество. / Опишете задачата си. Ще уточним обхвата и модела на сътрудничество и ще изпратим писмена оферта. | Опишете задачата си. Ще уточним обхвата и следващите стъпки. | The written-quote commitment stays in the shared trust points («Писмена оферта с ясен обхват»). |
| Предлагаме обхват, модел на сътрудничество и писмена оферта. (contact) / … етапи и модел на сътрудничество. (process) | … обхват, начин на работа и писмена оферта. / … обхват, етапи и начин на работа. | |
| Модели на сътрудничество (service-page heading) | Как работим заедно | Same heading the domain pages already use. |
| Фиксиран обхват, договорен писмено предварително: интервюта, … | Обхватът се уточнява писмено предварително. Работата включва интервюта, преглед на документи и конфигурация и писмен доклад. … | The redundancy named in the brief. |
| Покрива само средите и акаунтите в договорения обхват. | Покрива само средите и акаунтите, включени в договорения обхват. | The wording suggested in the brief. |
| Оценка на базовата облачна среда (landing zone); основната облачна зона; Целеви модел на основната зона | Оценка на cloud landing zone; cloud landing zone; Целеви модел на landing zone | One recognised term in the title, summary and deliverable; both JSON copies updated. |
| инициатива / инициативи (10 places) | проект / проекти | Roadmap line, the readiness and team tools («Кой ще отговаря за AI проекта?», «Води проекта»), workshop agenda. |
| …в продукция / продукцията / продукционните манифести (technical pages) | …в production / production среда / манифестите за production | Technical architecture and engineering pages use «production». |
| Непродукционна среда (customer-facing tiers and the intake form) | Тестова среда | Plain Bulgarian for a business reader. |
| Продукция (rollout phase in the AI team tool) | Работеща система | Customer-facing; the phase is the live, running system. |
| Класическа автоматизация на работния поток; …счупи работен поток | Класическа автоматизация на процеса; …счупи автоматизация | «Процес» for a business process, as the brief asks. |
| Управлявани AI услуги (link label) | AI Managed Services | The official product name the link leads to. |
| founderNote texts in three domain hubs | «корпоративната архитектура и платформите за AI», «софтуерно дефинирана инфраструктура» | Same vocabulary as the biography. |

## 4. Shared terminology decisions

* **Human approval:** concrete wording by context («Ключовите решения остават при хората», «Действието
  изчаква одобрение от човек», «Промени, които засягат клиенти, цени или поръчки, се изпълняват само след
  одобрение от човек»). Review, approval, decision and audit record stay distinct. No sentence is now
  repeated across pages; the repeated items left are labels («Човешко одобрение», «Точка за одобрение»).
* **Written scope:** the shortest wording that keeps the commitment; price, duration, SLA and response-time
  disclaimers were not touched.
* **Production:** «production» in technical content, «реална среда / работеща система / тестова среда» in
  customer-facing copy.
* **Landing zone:** «cloud landing zone» as the title, «landing zone» in prose.
* **Workflow:** «процес» for business, «работен поток» kept where it is natural (technical lists, AI
  Managed Services).
* **Official names kept:** AI Managed Services, Managed AI Operations, Advanced AI Reliability & Optimization,
  and the domain title «Управлявани AI и платформени операции» (navigation and SEO title).

## 5. CTAs standardised

Formal plural everywhere («Поискайте оферта» was already fixed). Capitalised «Ви/Ваш» only remained in the
founder heading and is now lowercase; the other «Ваш…» hits are the first word of a heading. Each domain hub
now has an intro sentence under its CTA that matches the service (ten sentences, e.g. «Разкажете ни какво
искате да свържете. Ще прегледаме системите ви и ще предложим подход.»); the shared sentence remains the
fallback for service pages, articles and topics.

## 6. Founder / About changes

`content/bg/founder.ts`: homepage paragraphs, profile meta description (shortened to stay under the
175-character limit that `founder.test.tsx` enforces), intro, the five sections, the contact block and the
«Ръководство» card, plus the three founder notes in the domain hubs. **Facts preserved:** name, role, Iskrev
Consulting Ltd, A.I. Commerce Studio, 20+ years, the degrees, the named clients, the five software-defined
data centres for 5G, architecture, engineering leadership, AI, cloud, critical infrastructure. Nothing added.
The three closing lines are kept unchanged. The contact details are not touched (they come from
`lib/company.ts`); the portrait and the protected-content tests are untouched.

## 7. Status labels

`tools.liveBadge` «Налично» (cards, hub, home preview, tool pages), `statusLive` «Налични» (filter),
the demo-centre legend sentence. «Налични сега» (a section heading) and «Очаквайте скоро» were already fine.

## 8. Landing-zone terminology

The literal «облачна основна зона» that the brief expected is **not** in the current sources or in the
verification corpus (0 hits); the working title was «Оценка на базовата облачна среда (landing zone)», also
half-translated. Replaced as in section 3. Slug `otsenka-na-oblachna-osnovna-zona` unchanged.

## 9. Managed-services terminology

No prose used «Управлявани AI и платформени операции»; it appears only as the domain name and SEO title,
which stay. The link label became the product name. Body copy already describes the actual service
(«наблюдение, поддръжка, оценка, разходи и инциденти»).

## 10. Extraction artefacts found (no source change)

* «Проект с фиксиран обхват Точна цена в писмена оферта»: two separate `<span class="badge">` elements.
* «Заявка за оферта Писмена оферта за конкретен проект»: label and hint in two separate `block` spans.
* «AI и LLM приложения Агенти и асистенти»: title and items in separate `span`s.
Same pattern as the earlier pass: crawler output, not defects.

## 11. Validation

| Check | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint` (Docker) | clean |
| `vitest` (web) | 908 tests; all pass (the repository-wide `company.test.ts` timed out once under load, passes alone in 2.6 s, as before) |
| Catalogue, team-text and workshop-key snapshots | regenerated; web and API copies byte-identical |
| API tests that read the copies (`catalogue*`, `team`, `opportunities`, `units`) | 163 passed |
| Protected content (`protected-content.test.ts`, `company.test.ts`, `founder.test.tsx`) | pass, unchanged |
| Dev server, 17 routes incl. the manual-review list | all 200, no route changed; new phrases present, old ones absent; no horizontal overflow at 375 px on the founder, tools, solution builder, landing-zone and cloud pages; the three orchestration headings are one line on desktop |
| Playwright e2e, production build | not run locally (the founder e2e heading was updated to match) |

## 12. Reviewed and kept

All the reference examples in the brief; «Съставете екип от AI агенти» (the AI team builder, a genuine
«compose a team»); «Проект с фиксиран обхват» and «Точна цена в писмена оферта» (accurate, short); the
process steps, «Накратко», FAQ; «Наблюдаемост» in every technical context (no business-facing use needed
changing); «непродукционна» removed only where customer-facing; the structured-data `knowsAbout` list is
English data, not Bulgarian copy; closing slogans of the founder page.

## 13. Remaining questions

1. «Конвейер» vs «pipeline» (18 uses, including the SEO keyword «CI/CD конвейери») is still open from the
   previous report.
2. The founder text is now plain, but the owner should read it once: «Основал е … ръководство на
   експлоатацията им» replaces «оперативно лидерство», and «създател на A.I. Commerce Studio» is the wording
   the brief asked for.
3. Some customer pages still say «production» in tool outputs (readiness and engineering assessments);
   they are technical assessments, left as they are.
