# Контролен списък за пускане в производство (след одита от 2026-11-12)

**Този документ не пуска нищо.** Нито една от стъпките не е изпълнена от одита. Всяка се прави от собственика или с негово изрично одобрение в този момент.
Основа: `main` @ `88aed98` + PR на одита. Подробностите за сървъра са в [infra/deploy/README.md](../infra/deploy/README.md) и [COMMERCIAL_STAGING_RUNBOOK.md](COMMERCIAL_STAGING_RUNBOOK.md);
изводите от одита – в [SECURITY_AUDIT_FINAL.md](SECURITY_AUDIT_FINAL.md).

## 0. Какво се променя в производство при следващото „Release“

| Какво | Откъде | Забележка |
| --- | --- | --- |
| Целият код от `main` след последното пускане (`03e62c4`, 2026-11-11): PR #77, #78, #79, #80 и този PR | история на Git | всичко публично е ново: Future Commerce дизайн, нов хедър, нови страници |
| Миграции `0027`–`0032` | `apps/api/alembic/versions` | добавящи (само нови таблици/колони); прилагат се само с „migrate-and-deploy“ **след резервно копие**; производството е на `0026` |
| Нов том `project_files` в API | `infra/deploy/compose.yml` | прилага се с новия `compose.yml` на сървъра (`/opt/ai-commerce-studio`): ръчна стъпка на собственика; без него API стартира, но качванията не са включени |
| Нова променлива `PROJECT_UPLOAD_MAX_BYTES` в уеб услугата | `infra/deploy/compose.yml` | празна = 10 MiB; няма ефект докато качванията са изключени |
| Caddy: отказ на `TRACE/TRACK/CONNECT` | `infra/reverse-proxy/Caddyfile.cloudflare` | по избор; приложете и `caddy validate` преди презареждане |

Всички флагове остават изключени (`CUSTOMER_ACCOUNTS_ENABLED`, `ADVISOR_WORKSPACE_ENABLED`, `PROJECT_CONFIGURATOR_ENABLED`, `QUOTE_BASKET_ENABLED`, `QUOTATIONS_ENABLED`, `COMMERCIAL_PROJECTS_ENABLED`, `PROJECT_DOCUMENTS_ENABLED`, `PROJECT_UPLOADS_ENABLED`, `PROJECT_CLIENT_UPLOADS_ENABLED`, `PROJECT_NOTIFICATIONS_ENABLED`, `BILLING_PROVIDER=disabled`).
Производственият старт отказва повечето от тях и без одобренията по-долу (`app/config.py`, `app/release_gates.py`).

## 1. Преди сливане на PR

- [ ] Прегледани [SECURITY_AUDIT_FINAL.md](SECURITY_AUDIT_FINAL.md), [PENETRATION_TEST_REPORT.md](PENETRATION_TEST_REPORT.md), [UI_UX_AUDIT.md](UI_UX_AUDIT.md), [PERFORMANCE_BEFORE_AFTER.md](PERFORMANCE_BEFORE_AFTER.md) от собственика.
- [ ] Защитеното съдържание не е променено: портретът, контактите (`lib/company.ts`), профилът на основателя, логото (`protected-content.test.ts`, `company.test.ts` минават).
- [ ] GitHub CI зелен: `API`, `Web`, `End-to-end`, `Client portal e2e`, **и новите** `Secret scan`, `CodeQL ×2`, `Dependency review`, `SBOM`. При червен CodeQL – разглеждане, не заглушаване.
- [ ] Търговският (`-Suite commercial`) и правният (`-Suite legal`) пакет – локално, виж [TEST_RESULTS.md](TEST_RESULTS.md) за последното изпълнение.

## 2. След сливане – настройки на GitHub (чакат одобрение, виж [GITHUB_SETTINGS_PROPOSAL.md](GITHUB_SETTINGS_PROPOSAL.md))

- [ ] Ruleset за `main` от `infra/github/ruleset-main.json` (след като проверките са се изпълнили поне веднъж).
- [ ] Включени Dependabot security updates.
- [ ] Actions: само избрани, изисква се закрепване по SHA.

## 3. Проверки на сървъра ПРЕДИ пускане (само четене, от собственика)

- [ ] `docker compose exec api python -m app.cli db-role-check` → `restricted role: OK` (потвърждава H-1; нова команда в този PR, затова първо се изпълнява при следващото пускане, не преди него).
- [ ] `/api/health/ready` → `"host": "ok"`; последният дъмп < 26 ч.; външното копие в OneDrive е прясно.
- [ ] Свободно място на диска < 85 %; `docker image ls` – има предишния образ за връщане.
- [ ] Cloudflare: SSL режим „Full (strict)“, UFW пуска 443 само от диапазоните на Cloudflare (`infra/deploy/README.md`).
- [ ] Прегледани и (ако се одобрят) приложени предложенията в `infra/cloudflare/` (правила 2 и 3 за ограничаване на честотата, Access пред `/admin`). **Не са приложени.**

## 4. Пускане (по ред; всяка стъпка е отделно одобрение)

1. Зареждане на образите: GitHub → Actions → Release → `build-only` (образите `sha-<комит>` за API и уеб, с `SITE_URL`, `PUBLIC_CONTACT_*` от променливите на хранилището).
2. Копиране на новия `infra/deploy/compose.yml` в `/opt/ai-commerce-studio/compose.yml` (добавя том и променлива; преглед на разликата преди това).
3. `migrate-and-deploy`: резервно копие → `alembic upgrade head` (0027–0032) → `db-api-role` → `seed` → нов образ → проверка на готовност отвън. Ако проверката падне, `rollback` се стартира автоматично.
4. Проверка след пускане: `/api/health/ready` (`ok`), `/bg`, `/en`, `/bg/kontakti` (формата изпраща), `robots.txt`, `sitemap.xml`, вход на персонала с MFA, заглавията на сайта (`curl -I`: HSTS, CSP), `docker logs api --since 10m | grep -c '"level": "ERROR"'` = 0.
5. Lighthouse върху живия сайт от лаптоп, мобилен профил (виж [PERFORMANCE_BEFORE_AFTER.md](PERFORMANCE_BEFORE_AFTER.md) за метода) – запис на LCP/CLS; сравнение с лабораторните стойности.

## 5. Връщане

* Автоматично: стъпка „Return to the previous release“ при неуспешна външна проверка.
* Ръчно: `ssh deploy rollback`. Миграциите са добавящи: връщането на кода е безопасно без връщане на базата; пълно възстановяване – от дъмпа (`scripts/restore-db.ps1`, `docs/DEPLOYMENT.md`).
* Спира се и се връща, ако: грешките 5xx > 10 за 15 мин., `host` ≠ `ok` повече от един цикъл, формата за контакт не работи, или хедърът не побира (`BLOCKER-ACC-HEADER-01` е затворен – тестът го пази).

## 6. Включване на функции – НЕ част от това пускане

Всяка се включва отделно, на тестов сървър първо, с писмено решение на собственика (и юрист/счетоводител, където е посочено в [COMMERCIAL_EXPANSION_DECISIONS.md](COMMERCIAL_EXPANSION_DECISIONS.md)):

| Функция | Отворени блокери (към 2026-11-12) |
| --- | --- |
| Конфигуратор и кошница | `BLOCKER-COM-STORAGE-01` (политика за бисквитки/съхранение), D-13, D-15 |
| Оферти към клиент | `BLOCKER-COM-ACCEPT-01` (значение и текст на отговора на клиента), D-06 |
| Клиентски акаунти | `EMAIL_DELIVERY_VERIFIED` (пощенска кутия, SPF, DKIM, DMARC), срокове за запазване (D-28), роля `acs_app_api`, MFA за клиенти (D-22) |
| Проекти и документи | акаунти, D-30; **качвания:** `BLOCKER-COM-UPLOAD-01` + [UPLOAD_SECURITY_PLAN.md](UPLOAD_SECURITY_PLAN.md) (скенер, архив на тома, тест за възстановяване) |
| Плащания | решение на собственика, счетоводител и юрист (D-04, D-11, D-12, D-42, D-43); Stripe тестови ключове; **не** `sk_live` |

## 7. След пускане – седмица 1

- [ ] Ежедневен преглед на `/api/health/ready`, грешките 5xx и поща за запитвания.
- [ ] Първи успешен седмичен тест за възстановяване ([OBSERVABILITY_PLAN.md](OBSERVABILITY_PLAN.md), т. 3), когато бъде внедрен.
- [ ] Втори човек с достъп до аларми и ключа за външното копие (офлайн копие на частния ключ – решение на собственика от 2026-11-10 е още отворено).
