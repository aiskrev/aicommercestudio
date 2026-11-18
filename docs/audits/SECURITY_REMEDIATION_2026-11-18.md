# Корекции — 2026-11-18

Клон `audit/security-2026-11-18`. Нищо не е слято или разгърнато.

| Промяна | Файлове | Ефект | Отмяна |
| --- | --- | --- | --- |
| Споделен ограничител в PostgreSQL | `apps/api/app/rate_limit.py` (фасада `Limiter`, `SharedRateLimiter`), `apps/api/app/accounts/limits.py` (`consume`), `apps/api/app/config.py` (`rate_limit_backend`) | с `RATE_LIMIT_BACKEND=postgres` броячите са общи за всички API процеси и оцеляват при рестарт; по подразбиране поведението е **същото** като досега (памет) | `RATE_LIMIT_BACKEND=memory` или отмяна на комита |
| Защита при старт | `apps/api/app/main.py` (`rate_limit_backend_error`) | в производство `WEB_CONCURRENCY>1` без `postgres` → API не стартира | – |
| MFA: помощ за въвеждане | `apps/api/app/cli.py` (`mfa-status`), `apps/api/app/main.py` (предупреждение) | собственикът вижда колко служители нямат MFA, преди да я направи задължителна; нищо не е принудено | – |
| Тестове за изолация | `tests/test_api_login_role.py` (+2), `tests/test_shared_rate_limit.py` (нов, 10), `tests/test_admin_mfa.py` (+1) | виж [доказателствата](SECURITY_TEST_EVIDENCE_2026-11-18.md) | – |
| Предложение за ruleset | `infra/github/ruleset-main-single-maintainer.json` | добавя `Deploy config guard`; не изисква втори рецензент | не е приложено |
| Доклади | `docs/audits/*-2026-11-18.md`, ред в `README.md` | – | – |

## Какво НЕ е променяно (и защо)
- Никакъв deploy, ключ, DNS, Cloudflare, Stripe или флаг. `RATE_LIMIT_BACKEND` остава `memory` по подразбиране.
- Без FORCE RLS, строг CSP, скенер за файлове, смяна на `postgres` образа и `security.txt` — обосновано в [находките](SECURITY_FINDINGS_2026-11-18.md).
- Не е добавен Trivy: Python и npm са покрити от `pip-audit --require-hashes` и `npm audit`; сканирането на образи иска изграждане на образа в CI и решение за прага.

## Съвместимост и внедряване
Без нова променлива в `.env` поведението не се променя. Единственото ново съобщение при старт е предупреждението `admin_mfa_not_required`, и то само ако MFA не е задължителна. Ограничителят при грешка на базата не връща грешка на потребителя — преминава на брояч в паметта.
