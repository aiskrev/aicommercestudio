# Cloudflare и Caddy — преглед на конфигурацията, 2026-11-18 (SEC-07, N-02, N-03)

**Разделение:** „Предложение в репото“ ≠ „активно в Cloudflare“. Нямам достъп до Cloudflare и не съм променял нищо там. Всичко в колоната „Живо“ е само това, което се вижда отвън с GET/HEAD.

## Наблюдавано отвън (OBSERVED_PRODUCTION)
| Елемент | Резултат |
| --- | --- |
| Достъп през Cloudflare | `server: cloudflare`, `via: 1.1 Caddy`, `cf-ray` присъства → трафикът минава през Cloudflare и Caddy |
| HSTS | `max-age=31536000; includeSubDomains`, без `preload` (по избор, не е включено; `preload` изисква проверка на всички поддомейни) |
| TRACE | 405 |
| `/api/docs`, `/api/openapi.json` | 404 |
| `/admin` | 307 → `/admin/login?next=%2Fadmin` — страницата за вход е достъпна; **Cloudflare Access пред `/admin/*` не се наблюдава** |
| `/api/health/ready` | преди тази промяна — без `Cache-Control` (N-03) |

## Не може да се провери отвън (NOT VERIFIED)
SSL/TLS режим „Full (strict)“, валидност на origin сертификата, WAF managed rules, custom правила, лимити, Access политики, актуален списък на Cloudflare IP в Caddy, достъп до origin директно (по IP), отворени портове (API/PostgreSQL), SSH ограничения, IPv6.

## Пътища в правилата — сверка с действителния код (VERIFIED_SOURCE)
| Правило в `infra/cloudflare/rate-limits.json` | Реален маршрут | Резултат |
| --- | --- | --- |
| `/api/accounts/login`, `/register`, `/password/forgot` | `routers/accounts.py:317`, `:246`, `:365` | съвпадат |
| **`/api/accounts/password/reset`** | `routers/accounts.py:380` | **липсваше** — добавен в правило 1 (предложение, не е приложено) |
| `/api/admin/auth/login`, `/api/admin/auth/mfa/verify` | `routers/admin_auth.py` (`prefix /api/admin/auth`, `POST /mfa/verify`) | съвпадат |
| `starts_with(/api/public/)` за POST | публични форми | съвпада |
| Stripe webhook | `POST /api/billing/stripe/webhook` (`routers/billing.py:134`) | **умишлено изключен** от лимитите; подписът се проверява в приложението |

Правила за Cloudflare Free план: броят правила/периоди зависи от плана — проверете в таблото преди прилагане (бележката в самия JSON го казва). Лимитите на Cloudflare са по `ip.src` + колокация; зад корпоративен NAT много души делят IP, затова в таблото са по-широки от лимитите в приложението (5 опита/10 с за вход е щедро за човек, но тясно за споделен IP; приложението заключва акаунта отделно).

## Кеш
- **Приложение (направено в кода):** всеки отговор на FastAPI носи `Cache-Control: no-store`, освен ако маршрут не си зададе друго (никой публичен маршрут не иска кеширане). Тест `test_every_api_answer_is_marked_no_store` (`/api/health`, `/api/health/ready`, `/api/public/catalogue`). Това затваря N-03 **в кода**; на живо — едва след Release.
- **Cloudflare (предложение):** `infra/cloudflare/cache-rules.json` — потвърдете, че кеш правило „bypass“ покрива `/api/*`, `/admin/*`, `/portal/*` и локализираните страници за сметка (`/bg/konto/*`, `/en/account/*` — точните пътища **не съм проверявал в таблото**; проверете ги спрямо `apps/web/src/app/[locale]`). Страницата `/bg` носи `s-maxage=31536000` (статична, генерирана при сборка) — това е умишлено за публичните страници; сметките и админът не са такива.

## Cloudflare Access (N-02) — подготвено, не е приложено
- Приложение „Self-hosted“: пътища `ai-commercestudio.com/admin/*` и `ai-commercestudio.com/api/admin/*`.
- Политика „Allow“: само конкретни служебни идентичности (имейл на собственика), изискване за MFA на доставчика на идентичност, **кратка сесия (напр. 8 ч)**.
- **Внимание:** административният API се вика от браузъра на същия хост (`/api/admin/*` през прокси на Next.js). Access ще изисква своя бисквитка и за тези заявки — следователно първо влезте в Access, после в админа. Не слагайте Access върху `/api/public/*`, `/api/accounts/*`, `/api/billing/stripe/webhook`, `/api/health*` (Uptime и Stripe не могат да минат през Access).
- Подредба: първо в режим на тест с отделен хост/политика „Bypass“ за вашия IP; след проверка — включване. Връщане: изтриване на приложението в Zero Trust (админът остава защитен от парола + MFA + заключване).
- Не е нужно да се променя кодът.

## Webhook на Stripe
Единствено `POST /api/billing/stripe/webhook`: без интерактивно предизвикателство (managed challenge/JS challenge) и без Access; допуска се тесен изключващ израз за точния път и метод **само за фазите с предизвикателства**, не глобално за `/api/billing/*`. Проверката на подписа остава в приложението (тестове: `test_a_bad_signature_is_refused_and_stored_nowhere`, `test_a_signature_made_with_an_empty_secret_is_refused`, `test_an_old_signature_is_refused`).

## Произход на мрежата (origin) — какво да проверите на сървъра
`ss -tlnp` (само слушащи сокети): API на `8000` и PostgreSQL на `5432` не са свързани към публичен интерфейс (в `compose.yml` само уеб има `ports`, на `127.0.0.1`); публично — само Caddy (443, и 80 само ако е нужен за пренасочване). Файъруол: `ufw status`/`nft list ruleset` — разрешени 22 (по възможност само от доверени адреси), 443 само от списъка на Cloudflare. Проверка и за IPv6 (`ip -6 addr`, `ss -6 -tln`). **Не променяйте правила на файъруола отдалечено без втори вход (конзола на Hetzner).**
