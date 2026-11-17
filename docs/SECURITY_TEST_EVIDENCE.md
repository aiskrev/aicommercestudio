# Доказателства от тестове — 2026-11-17

Всичко по-долу е изпълнено на клона `fix/security-hardening-2026-11-17` в изолиран Docker проект (`secaudit`, отделна база, порт 5499, изтрит след изпълнението) или локално в еднократни контейнери. Срещу производството — само безопасни GET/HEAD.

| Проверка | Резултат | Забележка |
| --- | --- | --- |
| API `pytest` (пълният набор) | **1800 минали, 1 пропуснат** (945 s) | 1799 + 1 нов тест за SEC-02. Пропуснатият: `test_compliance.py:77` „web copy not mounted“ — не е нов |
| `ruff check` и `ruff format --check` | чисто (291 файла) | – |
| SEC-02: `test_production_api_refuses_to_start_on_the_owner_role_unless_accepted_explicitly` | мина | собственик → `RuntimeError`; изрично изключение → стартира; `acs_app_api` → стартира |
| SEC-02: `test_production_forces_secure_cookies_and_hides_docs` (преработен да ползва `acs_app_api`) | мина | – |
| SEC-02: `docker compose config` без и със `API_DB_USER`/`API_DB_PASSWORD` | без → грешка „required variable API_DB_USER is missing“; със → URL с `acs_app_api` | ръчно, в копие на `compose.yml`; в CI го повтаря `Deploy config guard` |
| SEC-01: сондата за граф | 200 → `enabled` (изход 0); 404 → `disabled` (0, предупреждение); 403 → `denied` (1); 502 (3 опита) → `unavailable(502)` (1) | подменен `gh`; не е реален GitHub |
| SEC-01: резервна проверка | `pip-audit==2.10.1 -r requirements.txt`: няма известни уязвимости; `npm audit` уеб (`--omit=dev --audit-level=high`): 0; e2e: 0 | локално, 2026-11-17 |
| Нови GitHub проверки на PR | виж PR | `Dependency review` (graph off → резервен път), `Deploy config guard` |
| Уеб unit тестове, e2e, портал | **не са пускани наново** | уеб кодът не е променян в този клон; за него важат зелените проверки на `301dbdf` |
| Производство (GET/HEAD) | `/api/health/ready` → `ok/ok/ok`; `/BG/uslugi` → 308 → `/bg/uslugi`; `HEAD /api/health` → 200 | – |

## Какво НЕ е изпълнено
- Нови противникови тестове (междунаемателни, CSRF, XSS, SSRF, качване) — **не са писани и не са пускани**. Разчетено е на съществуващите: инвентар на 153 маршрута (`test_route_authorization_inventory.py`), „stranger“ тестове, `test_api_login_role.py`, `test_ops_security.py` — те са част от 1800-те минали.
- Тестове на конкурентност/рестарт на ограничителя на честота.
- Скенер на контейнери, Lighthouse/CSP Report-Only, Playwright e2e за BG/EN, достъпност — не са пускани за тази промяна.
- Всичко върху реалния Cloudflare, сървър, пощенски доставчик и Stripe.

## SEC-09: Python пакети с хешове (добавено в същия клон)
| Проверка | Резултат |
| --- | --- |
| Dev образът се сглобява с `pip install --require-hashes` | мина (49 пакета runtime, 75 dev) |
| Умишлено развален хеш в копие на `requirements.txt` | pip: „THESE PACKAGES DO NOT MATCH THE HASHES“ — отказва |
| `pip check` | без счупени зависимости |
| `pip-audit --require-hashes` за `requirements.txt` и `requirements-dev.txt` | „No known vulnerabilities found“ |
| `ruff check` | чисто |
| API `pytest` (пълният набор, изолирана база) върху образа с хешове | **1800 минали, 1 пропуснат** (936 s), същото като преди |
| Реално изпълнение на GitHub CI и първият Dependabot PR за pip | виж PR — **не е проверено** локално |
