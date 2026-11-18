# Действия, които изискват собственика — 2026-11-18

Нищо от това не е изпълнявано. Всяко действие е с очакван резултат и връщане.

## 1. GitHub (SEC-A01)
| Действие | Как | Очаквано | Връщане |
| --- | --- | --- | --- |
| Задължителна проверка `Deploy config guard` | след като PR с `ruleset-main-single-maintainer.json` е слят: `gh api -X PUT repos/aiskrev/aicommercestudio/rulesets/27436434 --input infra/github/ruleset-main-single-maintainer.json` | в ruleset има 9 задължителни проверки | същата команда с `infra/github/ruleset-main.json` |
| Втори рецензент (по избор) | при втори допустим акаунт: `ruleset-main-strict.json` (1 одобрение, код-собственик, одобрение след последния push) | автор ≠ одобряващ | връщане към горния файл |
| Dependency graph, Dependabot security updates | Settings → Code security | `…/dependency-graph/sbom` отговаря 200; задачата `Dependency review` минава през action-а | изключване |
| „Require actions to be pinned to a full-length SHA“ | Settings → Actions → General | `sha_pinning_required: true`; всички действия във workflows вече са по SHA | изключване |

**Практичен модел за един поддържащ:** нула одобрения е честно признание, че няма втори човек; реалната бариера за производство е средата `production` с 1 задължителен рецензент (потвърдена), плюс задължителните проверки и `strict` политиката. Не включвайте изискване за одобрение, което никой не може да даде — ще блокира всяко сливане освен през админ-заобикаляне.

## 2. Роля на базата (SEC-02 / SEC-A03)
Преди следващия Release:
1. Проверете, че `API_DB_USER=acs_app_api` и `API_DB_PASSWORD` са в `/opt/ai-commerce-studio/.env` (без да ги отпечатвате).
2. `docker compose --profile migrate run --rm -T migrate python -m app.cli db-role-check` → код 0.
3. Копирайте новия `compose.yml` само след това.

## 3. MFA на служителите (SEC-A02)
1. `docker compose --profile migrate run --rm -T migrate python -m app.cli mfa-status` (след внедряване на тази промяна) → `missing: 0`.
2. Ако `missing > 0`: всеки служител се записва от `/admin/account`; при загубено устройство: `python -m app.cli reset-mfa --email …`.
3. Само тогава: `ADMIN_MFA_REQUIRED=true` в `.env` и рестарт на API. Връщане: `false` и рестарт (запазените MFA остават).

## 4. Споделен лимит (SEC-05)
Не включвайте, докато има един API процес. Ако добавите процес: `RATE_LIMIT_BACKEND=postgres` **и** `WEB_CONCURRENCY=N`, после тествайте вход и публична форма. Без `postgres` API няма да стартира.

## 5. Cloudflare и сървър (SEC-07, N-02, N-03)
Следвайте [CLOUDFLARE_SECURITY_CHECKLIST](../CLOUDFLARE_SECURITY_CHECKLIST.md): SSL/TLS Full (strict), WAF, лимити, Access пред `/admin`, актуален списък IP, правило, което не кешира `/api/*`. Сървър: само портове 22/80/443 (по правило само през Cloudflare), API и PostgreSQL не са публични.

## 6. Копия и мониторинг (SEC-10)
Изпълнете проба за възстановяване върху изолиран сървър; настройте сигнал за продължителни 5xx; потвърдете копието извън сървъра.

## 7. Решения, които не са мои
Файлове (скенер, квоти, срок — [UPLOAD_RELEASE_GATE_REVIEW](../UPLOAD_RELEASE_GATE_REVIEW.md)); Stripe в тестов режим; пощенски доставчик (SPF/DKIM/DMARC); срокове за съхранение и подпис на юрист/счетоводител; контакт за `security.txt`.
