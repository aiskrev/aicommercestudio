# Роля на базата и изолация на наематели — проверка, 2026-11-18

Без идентификационни данни и без клиентски данни. Всичко е върху синтетична схема в изолиран PostgreSQL контейнер.

## Какво е потвърдено (VERIFIED_SOURCE / VERIFIED_LOCAL)
| Контрол | Доказателство |
| --- | --- |
| `API_DB_USER` и `API_DB_PASSWORD` са задължителни | `docker compose config` без тях → грешка „required variable API_DB_USER is missing“; със тях → URL с `acs_app_api` (проверено днес, `infra/deploy/compose.yml`) |
| API отказва старт в производство на роля ≠ `acs_app_api` | `create_app` → `RuntimeError`; тест `test_production_api_refuses_to_start_on_the_owner_role_unless_accepted_explicitly` |
| Аварийното изключение е изключено по подразбиране | `allow_owner_database_role: bool = False`; в `production.env.example` не е зададено |
| `acs_app_api` не заобикаля нищо и не притежава таблици | `test_the_role_cannot_bypass_anything` (rolsuper/rolbypassrls/createrole/createdb = false; 0 притежавани таблици) |
| Тенант таблиците са затворени без обвързване | `test_tenant_tables_are_closed_without_a_binding` (по таблица, „permission denied“) |
| Обвързване вижда само своята организация | `test_a_binding_sees_only_its_own_organisation` |
| `bootstrap` не променя организация | `test_bootstrap_cannot_change_an_organisation` |
| Ролята не променя схемата и не пренаписва историята | `test_the_role_cannot_change_the_schema_or_rewrite_history` |
| **Нови:** пулирана връзка не пренася контекст | `test_a_pooled_connection_carries_no_tenant_context_to_the_next_request` (3 последователни ползвания на връзка след commit), `test_a_rolled_back_binding_does_not_leak_either` (след rollback) — и двата връщат `current_user = acs_app_api`, празна `app.ops_org`, и „permission denied“ върху `ops_organizations` |
| Контекстът е транзакционен | `app/ops/rls.py`: `SET LOCAL ROLE` + `set_config(…, true)`; в `after_begin` за всяка нова транзакция |
| API не може да приеме ролята на собственика | прочетено от `pg_auth_members` в мигрираната тестова база: `acs_app_api` е член **само** на `acs_app_runtime` и `acs_app_bootstrap`; и двете са `NOLOGIN` и не са членове на нищо; собственикът на схемата не е сред ролите, на които API е член |
| Грантове оцеляват при възстановяване | 362 реда в `role_table_grants` за трите роли в източника и във възстановената база (виж BACKUP_RESTORE_VERIFICATION) |

Междунаемателни тестове за SELECT/UPDATE/DELETE между организации A и B съществуват в `tests/test_ops_security.py` и свързаните „stranger“ тестове (инвентар на 153 маршрута); в този проход **не са добавяни нови** HTTP тестове за документи и фактури. Маркирано: **не са повторени като отделна динамична проба срещу производствена среда**.

## FORCE ROW LEVEL SECURITY
Не е включено. Обосновка в [находките](SECURITY_FINDINGS_2026-11-18.md#решение-за-force-row-level-security-sec-a03): API ролята не притежава таблиците и е под RLS; `FORCE` засяга само собственика (миграции, `maintenance`, CLI), без да затваря реален път, а рискува именно тези законни операции. Условие за преразглеждане: тест на всяка CLI команда като собственик под `FORCE`.

## `db-role-check` на сървъра — НЕ е изпълнен от мен
Нямам достъп до сървъра и не ползвам SSH ключа на Release. Контролът е **INFERRED**: Release `44116233973` разгърна кода със защитата и външната проверка мина, т.е. API е стартирал; при роля ≠ `acs_app_api` и без `ALLOW_OWNER_DATABASE_ROLE=true` процесът би спрял. Това не заменя проверката. Командата за собственика (виж OWNER_ACTIONS): `docker compose --profile migrate run --rm -T migrate python -m app.cli db-role-check` → очакван код 0. Ако не е 0: не променяйте привилегии на сляпо; прочетете изхода (не отпечатва пароли) и върнете `compose.yml` към предишното копие.

## Съвместимост на `compose.yml`
Новият файл с `:?` вече е в `main`; дали е копиран на сървъра, **не е проверимо**. Преди копиране: `diff` между `/opt/ai-commerce-studio/compose.yml` и репото и запазено `compose.yml.bak`.
