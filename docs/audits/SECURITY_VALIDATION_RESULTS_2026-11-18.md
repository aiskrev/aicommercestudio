# Резултати от проверките — 2026-11-18 (второ изпълнение)

Среда: еднократни Docker контейнери (`python:3.15-slim` по digest за API, `node:26-alpine` за уеб, `postgres:17-alpine`), отделна мрежа и база; след проверките са изтрити. Срещу производството — само безопасни GET/HEAD. Нищо не е отбелязано като преминало без изпълнение.

| Проверка | Среда | Резултат |
| --- | --- | --- |
| `ruff check .` и `ruff format --check .` | API контейнер | чисто; 292 файла форматирани |
| Пълен API `pytest -q` | API контейнер, изолирана PostgreSQL | **1818 минали, 1 пропуснат** (903 s). Пропуснатият: `test_compliance.py:77` „web copy not mounted“ — не е нов. Спрямо 1800/1 в началото: +10 тестове на ограничителя, +5 нови (строг режим, `no-store`), +2 за пулирана връзка, +1 за `mfa-status` |
| Строг режим на ограничителя | същото | минава: строг hit → `SharedLimiterUnavailable`; 503 `rate_limit_unavailable` с `Retry-After: 5`; обикновен маршрут продължава; връщане след срив; вход на админ → 503 без имейл в тялото; публичен маршрут не е 503 |
| Всеки API отговор е `no-store` | същото | минава за `/api/health`, `/api/health/ready`, `/api/public/catalogue` |
| Уеб: `npm run typecheck`, `eslint` върху новите файлове, `vitest run` | уеб контейнер, `npm ci` | типове чисти; **90 файла, 1143 теста минали** (включват 9 нови за `security.txt`) |
| Уеб: `next build` | същото | компилира; маршрутът е `ƒ /.well-known/security.txt` (динамичен) |
| Уеб: `next start`, `GET /.well-known/security.txt` без променливи | същото | **404**, без `Location` (пренасочване от locale proxy няма) |
| Уеб: същият маршрут със зададени променливи | само unit тест на маршрута | не е проверен на работещ сървър → **NOT VERIFIED на сървър** (покрит е от `route.test.ts`) |
| `docker compose config` без/със `API_DB_*` | Docker Compose | без → грешка; със → `acs_app_api`; новите `SECURITY_*` са празни по подразбиране |
| Учение за възстановяване (синтетична схема) | PostgreSQL контейнер | дъмп 1,2 s, възстановяване 2,9 s, идентични броячи/политики/индекси/грантове — виж [BACKUP_RESTORE_VERIFICATION](BACKUP_RESTORE_VERIFICATION.md) |
| GitHub CI на PR #107 (първоначален връх `198bb0a`) | GitHub Actions | 10 от 11 зелени (вкл. `Dependency review`, `Deploy config guard`, Playwright, API, уеб); **`CodeQL` падна** с 1 високо предупреждение в `cli.py` — поправено локално, резултатът след push е в PR |
| Производствени GET/HEAD | Интернет | health ok; документация 404; TRACE 405; заглавия както в [PRODUCTION_VERIFICATION](PRODUCTION_VERIFICATION_2026-11-18.md) |

## Не е изпълнено / NOT VERIFIED
- Playwright e2e и портален e2e **локално**: не са пускани (само в GitHub CI на PR; зелени на първоначалния връх). Не са пускани и след последните промени локално.
- Нови противникови тестове срещу HTTP: не са добавяни освен посочените; Stripe — без нови тестове (покритието е достатъчно по прегледа).
- `actionlint`: workflow файловете не са променяни в този проход (последно пуснат за `release.yml` в предишния).
- Сканиране на образи (Trivy), ZAP, Lighthouse, достъпност, пълно BG/EN e2e: не са изпълнявани.
- Всичко на сървъра, в Cloudflare, пощата и Stripe: NOT VERIFIED.
