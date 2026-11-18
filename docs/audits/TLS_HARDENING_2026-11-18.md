# TLS: протоколи, шифри и сертификати — 2026-11-18

## Находка TLS-01 (P1): Cloudflare приема TLS 1.0 и TLS 1.1
**Статус: потвърдена независимо; в производството НЕ е поправена (изисква настройка в Cloudflare от собственика).**

| Източник | Резултат |
| --- | --- |
| SSL Labs (4 сканирания 15:03–15:06 UTC, подадени от собственика; броя ги за **едно** наблюдение) | оценка **B**, TLS 1.0 и 1.1 поддържани, CBC шифри в TLS 1.2 маркирани като слаби, TLS 1.3 с AES-GCM/ChaCha20, X25519MLKEM768, без OCSP stapling, без CAA, сертификат до 2027-02-01 |
| Мое независимо ръкостискане, OpenSSL 3.2.1 (Windows) → `ai-commercestudio.com:443` | TLS 1.0 **приет** (`ECDHE-ECDSA-AES128-SHA`, CBC), TLS 1.1 **приет**, TLS 1.2 приет (`ECDHE-ECDSA-CHACHA20-POLY1305`), TLS 1.3 приет |
| Второ, различно изпълнение: OpenSSL 3.0.13 (Ubuntu 24.04, като GitHub runner), apex | същият резултат: 1.0 и 1.1 приети, 1.2 и 1.3 приети |
| `www.ai-commercestudio.com` | същият резултат (1.0 и 1.1 приети) |
| Сертификат | доверен, името съвпада, изтича 2027-02-01 14:58:08 UTC |

Причина (INFERRED, настройката не е четена): минималната версия на TLS в зоната е на подразбиращата се стойност на Cloudflare (1.0). Видимите отвън пътища са два **отделни** TLS отсечки — посетител→Cloudflare и Cloudflare→origin. Грешната е първата; `Caddyfile` не може да я поправи.

### Поправка (чака ТВОЕТО одобрение)
Таблото: **SSL/TLS → Edge Certificates → Minimum TLS Version → TLS 1.2**. Документация: https://developers.cloudflare.com/ssl/edge-certificates/additional-options/minimum-tls/

Чрез API (токен с право само „Zone Settings: Edit“, зададен в променлива, никога не се отпечатва; `ZONE_ID` също от променлива):
```bash
# 1) Запис на текущата стойност (за връщане)
curl -s -H "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/min_tls_version" | tee min_tls_version.before.json
# 2) Прилагане
curl -s -X PATCH -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"value":"1.2"}' "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/min_tls_version"
# 3) Връщане (стойността от min_tls_version.before.json, напр. "1.0")
curl -s -X PATCH -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  --data '{"value":"1.0"}' "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/min_tls_version"
```
Настройката е за цялата зона. Засегнатите проксирани имена: `ai-commercestudio.com`, `www`, и `deploy-ssh.ai-commercestudio.com` (проксирано, видяно в DNS) — клиентите му (`cloudflared`, Go) ползват TLS 1.2/1.3. Stripe (webhook) — поддръжката на TLS 1.2 от негова страна не е проверявана в този проход (очаквана); Turnstile е на домейн на Cloudflare; Uptime и скриптовете ползват съвременен `curl`. Което отпада: браузъри и клиенти без TLS 1.2 (напр. Android < 5, Windows 7 с IE по подразбиране). Не е проверено дали сред посетителите има такива; проверете в Cloudflare Analytics → Security → TLS версии преди промяна, ако искате числа.

### Проверка след прилагане (само ти или аз след одобрение)
```bash
bash scripts/verify-tls.sh ai-commercestudio.com www.ai-commercestudio.com   # очаквано: RESULT: TLS policy met, изход 0
```
Една неуспешна връзка от един клиент **не е** доказателство (локалният OpenSSL може да отказва стари версии): скриптът различава „сървърът отказа“ от „клиентът не опита“ и връща код 2 (неубедително), не „мина“. После нов SSL Labs. **Новият рейтинг не е измерван и не се обявява.** Очаквам, но не твърдя, че без TLS 1.0/1.1 оценката ще падне от B.

## TLS-02 (P2): слаби CBC шифри в TLS 1.2 на Cloudflare
- SSL Labs ги маркира; моето ръкостискане потвърждава, че CBC (`ECDHE-ECDSA-AES128-SHA`) се приема на крайната точка.
- Настройката `ciphers` на Cloudflare позволява ограничаване на списъка. **Достъпна ли е на текущия план — NOT VERIFIED** (в API има поле `editable`): `curl -s -H "Authorization: Bearer $CF_API_TOKEN" "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/settings/ciphers"`. Ако е `editable: false`, ограничението изисква платена функция (напр. Advanced Certificate Manager/по-висок план) — **не купувайте без решение**; остатъчният риск е нисък (CBC с ECDHE, с прекъснат TLS 1.0/1.1, остава в TLS 1.2).
- TLS 1.3 шифрите не се настройват с това поле.
- Не променяйте списъка, без да сте го тествали с `scripts/verify-tls.sh`, `curl --tlsv1.2 --tls-max 1.2 …` и браузър.

## TLS-03 (P2): произход (Caddy)
Тествано в Docker с Caddy 2.11.9 и самоподписан сертификат (Origin CA на сървъра не е достъпен отвън):
| Конфигурация | TLS 1.0 | TLS 1.1 | TLS 1.2 | TLS 1.3 | CBC в TLS 1.2 |
| --- | --- | --- | --- | --- | --- |
| текуща (без `protocols`) | отхвърлен | отхвърлен | приет (`ECDHE-ECDSA-AES128-GCM-SHA256`) | приет | отхвърлен |
| нова (`protocols tls1.2 tls1.3`) | отхвърлен | отхвърлен | приет | приет | отхвърлен |
`caddy validate`: Valid configuration. Т.е. произходът **не е проблем**; явното `protocols` е защита срещу бъдеща смяна на подразбирането. Файлът на сървъра е различен от репото, докато не го копирате: `caddy validate --config … && systemctl reload caddy` (или `docker exec … caddy reload`), връщане — предишното копие. Нищо от това не е прилагано. Допълнително: пренасочването `www` вече праща HSTS (преди — не, видяно в `verify-tls.sh`).

## Сертификати, HSTS, DNS
| Тема | Състояние |
| --- | --- |
| Крайният сертификат | валиден до 2027-02-01 (наблюдавано); управляван от Cloudflare е само INFERRED (Universal SSL); подновяването не е проверимо |
| Сертификат на произхода | Cloudflare Origin CA (по коментара в `Caddyfile.cloudflare`); срокът му **не е проверим отвън**, а Caddy го чете от файл — следете го на сървъра: `openssl x509 -enddate -noout -in /etc/caddy/origin/origin.crt` |
| Аларма преди изтичане | новият `TLS check` (седмично) пада, ако крайният сертификат изтича след < 21 дни; за сертификата на произхода няма аларма (OWNER) |
| HSTS | `max-age=31536000; includeSubDomains`, без `preload` (правилно; `preload` само след преглед на всички поддомейни — не се включва) |
| CAA | **няма записи** (DNS-over-HTTPS към apex: само SOA, без отговор). Добавяне само след преглед на всички издатели, които Cloudflare ползва за Universal SSL, иначе подновяването може да се счупи → не се предлага автоматично |
| OCSP stapling | не е самостоятелна находка: терминира Cloudflare; не се променя |
