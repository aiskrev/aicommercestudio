# Cloudflare, Caddy и доверени прокси — контролен списък, 2026-11-17

Правило: JSON файл в Git **не е** доказателство, че правило е активно. Колоната „Проверено“ показва откъде е доказателството. Нищо в Cloudflare не е променяно.

| Контрол | Очаквано | Какво е проверено | Проверено |
| --- | --- | --- | --- |
| TLS режим | Full (strict) с Origin CA | Caddyfile сочи `/etc/caddy/origin/origin.crt`; режимът в Cloudflare не е видян | код: да; Cloudflare: **UNVERIFIED** |
| HTTP→HTTPS, `www`→apex | 301 | наблюдавано: `http://…` → 301 → `https://…`; `www` → 301 → apex | OBSERVED_PRODUCTION |
| HSTS | ≥ 1 г., `includeSubDomains` | наблюдавано `max-age=31536000; includeSubDomains` (без `preload`) | OBSERVED_PRODUCTION |
| Доверени CIDR на Cloudflare | текущ списък | `trusted_proxies static …` в `Caddyfile.cloudflare`; **не е сверен с cloudflare.com/ips днес** | код: да; актуалност: **UNVERIFIED** |
| `CF-Connecting-IP` | само от Cloudflare; на API стига един `X-Forwarded-For` | `client_ip_headers CF-Connecting-IP`, `header_up X-Forwarded-For {client_ip}`, `header_up -CF-Connecting-IP`; API взема най-десния запис | VERIFIED_SOURCE |
| Произход (origin) недостъпен отвън | само от Cloudflare | API няма публикуван порт, уеб е на `127.0.0.1:3000`; защитната стена на хоста **не е проверена** | код: да; хост: **UNVERIFIED** |
| `Host`/`Origin` валидация | отхвърляне на чужди | CORS: без `Access-Control-*` на чужд произход (наблюдавано); `Host` се подава от Caddy; сървърно правило за непознат `Host` **не е проверено** | частично |
| Методи | TRACE/TRACK/CONNECT → 405 | правило в Caddyfile | VERIFIED_SOURCE |
| Кеш на удостоверено съдържание | `DYNAMIC`/`no-store` | `cf-cache-status: DYNAMIC` на `/bg`; правила за bypass (`infra/cloudflare/cache-rules.json` е само предложение) **не са видяни** | частично |
| Ограничаване на честотата | вход/форми на ръба | `infra/cloudflare/rate-limits.json` е само предложение; активни правила **UNVERIFIED** | **UNVERIFIED** |
| Access/MFA пред `/admin` | да | не е видяно | **UNVERIFIED** |
| WAF и изключение за Stripe webhook | да при включен Stripe | не е видяно (Stripe е изключен) | **UNVERIFIED** |
| Заглавия за сигурност | CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | наблюдавани на `/bg`; Cloudflare не ги променя видимо | OBSERVED_PRODUCTION |
| Лог на Caddy | ротация | `roll_size 50mb`, `roll_keep 10`, `roll_keep_for 720h` | VERIFIED_SOURCE |

## Действия на собственика (заявка за одобрение — нищо не е приложено)
1. Потвърдете в панела: SSL/TLS = Full (strict); Always Use HTTPS; Min TLS ≥ 1.2.
2. Приложете правилата за честота от `infra/cloudflare/rate-limits.json` (вход на персонала, формуляри) и пробвайте от втори адрес (11 неуспешни входа → ограничаване).
3. Cloudflare Access пред `/admin` (по желание) и правилата за кеша от `infra/cloudflare/cache-rules.json` (bypass за `/admin*`, `/api/*`, `/portal*`) и WAF от `waf-rules.json`.
4. Сверете списъка с IP на Cloudflare с cloudflare.com/ips и обновете `Caddyfile.cloudflare`, ако се различава.
5. Проверете защитната стена на хоста: отворени са само 22 (ограничено) и 443 от Cloudflare.
6. При включване на Stripe: WAF изключение само за `/api/billing/stripe/webhook` и проверка на подписа.
