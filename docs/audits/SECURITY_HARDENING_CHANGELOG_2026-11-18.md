# Дневник на промените — 2026-11-18 (второ изпълнение)

Клон `audit/security-2026-11-18`, PR [#107](https://github.com/aiskrev/aicommercestudio/pull/107) (отворен, не е слят). Втората част от работата е добавена към същия PR, за да остане историята на прегледа на едно място.

| Промяна | Причина | Файлове |
| --- | --- | --- |
| CodeQL alert (`py/clear-text-logging-sensitive-data`, високо) в PR #107 | новата команда `mfa-status` печата броячи през общия `_print`; CodeQL го свърза с „парола“ | `apps/api/app/cli.py`: премахната метрика за възстановителните кодове; печатат се само `bool`/`int` с явно преобразуване |
| Чувствителни маршрути не падат към брояч в паметта | при срив на споделения лимит и няколко процеса паметта умножава позволеното | `app/rate_limit.py` (`strict`, `SharedLimiterUnavailable`), `app/deps.py` (`enforce_rate_limit(strict=…)`, `limit_check_unavailable`), `app/routers/admin_auth.py` (вход, MFA стъпка, `login-unknown`), `app/routers/advisor.py` (платен ИИ) |
| `Cache-Control: no-store` за всеки API отговор | N-03 | `app/middleware.py` |
| `/.well-known/security.txt` (404, докато собственикът не зададе мониториран контакт и срок) | N-01 | `apps/web/src/lib/security-txt.ts`, `apps/web/src/app/.well-known/security.txt/route.ts`, тестове, `infra/deploy/compose.yml`, `infra/deploy/production.env.example` |
| `password/reset` в Cloudflare правило 1 (предложение) | липсваше в списъка на защитените пътища | `infra/cloudflare/rate-limits.json` |
| Доклади | Фази 2–13 | `docs/audits/GITHUB_SECURITY_HARDENING.md`, `DATABASE_ROLE_AND_RLS_VERIFICATION.md`, `CLOUDFLARE_PRODUCTION_CONFIG_REVIEW.md`, `BACKUP_RESTORE_VERIFICATION.md`, `SECURITY_OWNER_ACTIONS_EXECUTION_2026-11-18.md`, `SECURITY_VALIDATION_RESULTS_2026-11-18.md`, `FINAL_SECURITY_RELEASE_DECISION.md` |

## Какво не е променяно
Флагове, цени, защитено съдържание (портрет, контакти, лого, профил на основателя), `release_gates`, ruleset в GitHub, Cloudflare, сървър, база. `RATE_LIMIT_BACKEND` остава `memory`.

## Връщане
Отмяна на комитите на клона. `security.txt` се изключва с премахване на променливите; ограничителят — с `RATE_LIMIT_BACKEND=memory`.
