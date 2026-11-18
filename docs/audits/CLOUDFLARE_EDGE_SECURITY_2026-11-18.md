# Cloudflare: край на мрежата — 2026-11-18

Нямам достъп до Cloudflare (няма токен; не е искан) и **нищо не е променено**. Всичко по-долу е или наблюдавано отвън, или предложение. Подробният преглед на правилата и пътищата е в [CLOUDFLARE_PRODUCTION_CONFIG_REVIEW](CLOUDFLARE_PRODUCTION_CONFIG_REVIEW.md) (същият ден).

## Приоритетен списък за собственика (по реда на приложение)
| # | Действие | Защо | Проверка след това | Връщане |
| --- | --- | --- | --- | --- |
| 1 | **Minimum TLS Version = 1.2** (SSL/TLS → Edge Certificates) | TLS-01: сега се приемат 1.0 и 1.1 | `bash scripts/verify-tls.sh …` → изход 0; нов SSL Labs | върнете записаната стойност (виж [TLS_HARDENING](TLS_HARDENING_2026-11-18.md)) |
| 2 | Потвърдете **SSL/TLS = Full (strict)** | произходът е с Origin CA сертификат; „Full“ без strict не го проверява | Cloudflare табло | – (не сменяйте на Flexible никога) |
| 3 | Лимити за вход/MFA/регистрация/забравена парола (`infra/cloudflare/rate-limits.json`, вкл. `password/reset`) | допълват заключването в приложението | заявка от тестов IP над лимита → 429 | изтриване на правилата |
| 4 | Cloudflare Access пред `/admin/*` и `/api/admin/*` | N-02: входът на персонала е публичен | вход през Access, после админ; Uptime/Stripe не са засегнати | изтриване на приложението в Zero Trust |
| 5 | Кеш: bypass за `/api/*`, `/admin/*`, `/portal/*` и страниците за сметка | личен/динамичен отговор не бива да се кешира | `cf-cache-status: DYNAMIC/BYPASS` върху тях | изтриване на правилото |
| 6 | CBC шифри (TLS-02) | само ако `editable: true` на плана | `scripts/verify-tls.sh` и браузър | върнете списъка |
| 7 | Сигнал за изтичане на сертификат (Notifications) и за продължителни 5xx | липсват | тестово известие, което стига до човек | – |

## Какво НЕ бива да се прави
- Глобален „bypass“ на WAF за `/api/billing/*` (само точният `POST /api/billing/stripe/webhook`, и то само за фазите с предизвикателства; подписът се проверява в приложението).
- HSTS `preload`, закрепване на ключове (HPKP), CAA без преглед на издателите.
- Промяна на плана (Advanced Certificate Manager) без решение.

## Наблюдавано сега (OBSERVED_PRODUCTION)
HSTS `max-age=31536000; includeSubDomains`; `cf-cache-status: DYNAMIC` на `/bg`; TRACE → 405; `server: cloudflare`; `/api/*` отговорите са `Cache-Control: no-store` (видяно след Release `44329984672`); `deploy-ssh.ai-commercestudio.com` е проксиран. TLS 1.0/1.1 приети (виж TLS-01).
