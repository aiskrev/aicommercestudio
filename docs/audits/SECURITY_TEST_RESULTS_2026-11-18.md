# Резултати от проверките (TLS и произход) — 2026-11-18

Само проверките на този PR. Пълните резултати за приложението са в [SECURITY_VALIDATION_RESULTS](SECURITY_VALIDATION_RESULTS_2026-11-18.md) (PR #107). Срещу производството: само ръкостискания и GET/HEAD, ≤ 1 заявка/сек, без сканиране.

| Проверка | Среда | Команда | Резултат |
| --- | --- | --- | --- |
| Протоколи на края (apex) | Windows, OpenSSL 3.2.1 | `openssl s_client -connect … -servername … -tls1/-tls1_1/-tls1_2/-tls1_3 -cipher 'ALL:@SECLEVEL=0'` | 1.0 и 1.1 **приети** (CBC шифър), 1.2 и 1.3 приети |
| Протоколи на края (apex и www) | Ubuntu 24.04, OpenSSL 3.0.13 | `bash scripts/verify-tls.sh ai-commercestudio.com www.ai-commercestudio.com` | 1.0 и 1.1 приети (нарушение), 1.2 и 1.3 приети, сертификат доверен до 2027-02-01, HSTS на apex ok; **www: HSTS липсва** (преди промяната на Caddyfile) → общо 5 нарушения, изход 1 |
| Положителен контрол на скрипта | Docker, Caddy 2.11.9, самоподписан сертификат, `/etc/hosts` към 127.0.0.1 | същият скрипт | 1.0 и 1.1 `REJECTED`, 1.2/1.3 `ACCEPTED`; нарушенията са само самоподписаният сертификат и липсата на доверие (очаквано) |
| Откритата грешка в скрипта | – | първа версия броеше реда `Protocol : TLSv1` за приемане; на отхвърлено ръкостискане OpenSSL пак го печата | поправено: приемане = реален шифър в `New, … Cipher is <cipher>`; повторени и двата контрола |
| Origin Caddy: текуща и нова конфигурация | Docker, Caddy 2.11.9 | `caddy validate`, `caddy run`, ръкостискания | и двете: 1.0/1.1 отхвърлени, 1.2 (GCM) и 1.3 приети, CBC в 1.2 отхвърлен; „Valid configuration“ |
| www пренасочване с HSTS | Docker, нов Caddyfile | `curl -skI https://www…` | `301`, `location: https://ai-commercestudio.com/`, `strict-transport-security: max-age=31536000; includeSubDomains` |
| Скрипт: синтаксис и статичен анализ | Docker | `bash -n`, `koalaman/shellcheck` | чисто |
| Workflow `tls-check.yml` | Docker | `rhysd/actionlint` | без забележки |
| Наблюдаван произход | Интернет | 6 TCP връзки + 1 HEAD към origin | виж [ORIGIN_SECURITY](ORIGIN_SECURITY_2026-11-18.md): само 22 е отворен |
| Производство след Release `44329984672` | Интернет | HEAD на `/bg`, `/en`, `/api/health`, `/api/health/ready`, `/.well-known/security.txt`, `/api/docs` | 200, 200, 200/`no-store`, 200/`no-store`, 404/`no-store`, 404; `/api/health/ready` → `ok/ok/ok` |
| CAA | DNS-over-HTTPS | `type=CAA` за apex | няма записи |

## Не е изпълнено
- Нов SSL Labs: **не е пускан** (сменя се едва след промяна в Cloudflare). Рейтингът преди: B; рейтингът след: **неизвестен**.
- Пълни API/уеб/Playwright на този PR: не са пускани локално (не е променян код на приложението; пускат се в GitHub CI на PR).
- Cloudflare режим „Full (strict)“, Access, WAF, кеш правила, шифри: NOT VERIFIED.
- Сертификат на произхода: срокът му NOT VERIFIED.
- Недостъпно за мен: реалният `Caddyfile` и версията на Caddy на сървъра.
