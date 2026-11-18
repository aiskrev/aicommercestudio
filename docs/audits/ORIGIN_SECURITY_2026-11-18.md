# Произход (origin): достъп, Caddy и доверие към прокси — 2026-11-18

## Наблюдавано отвън (минимално: 6 TCP връзки и 1 HEAD, без сканиране; от IP, който не е на Cloudflare)
| Проверка | Резултат |
| --- | --- |
| Порт 22 (SSH) на `2.31.101.225` | **отворен** |
| Портове 80, 443, 3000, 5432, 8000 | затворени/филтрирани |
| IPv6 `…::1` порт 443 и 5432 | затворени/филтрирани |
| Директна заявка до origin по IP с `Host: ai-commercestudio.com` | няма отговор → произходът не приема трафик извън Cloudflare |
Разделянето „затворен“ от „филтриран“ не е възможно от тук и правилата на файъруола не са четени. **Заключение:** публично са недостъпни API, PostgreSQL и Next.js; Cloudflare не може да бъде заобиколен от този адрес (OBSERVED_PRODUCTION). Не е проверено от други адреси.

## Находка ORIG-01 (P2): SSH е отворен за целия интернет
SSH (22) отговаря от произволен адрес. Разгръщанията вече минават през Cloudflare Tunnel (`deploy-ssh.…`), така че публичният 22 е нужен само за собственика. Предложение (чака одобрение; не го прилагайте без втори вход през конзолата на Hetzner): ограничете 22 в Hetzner Cloud Firewall до адресите, от които администрирате, или го затворете за интернет и влизайте през Tunnel/Access. Преди това проверете в `sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no` (`sudo sshd -T | grep -Ei 'passwordauthentication|permitrootlogin'`). Връщане: премахване на правилото от Hetzner.

## Caddy и доверие към прокси
- `Caddyfile.cloudflare`: `trusted_proxies` е списъкът на Cloudflare; `client_ip_headers CF-Connecting-IP`; към API се подава точно един `X-Forwarded-For` и се маха `CF-Connecting-IP`. Списъкът е от `cloudflare.com/ips` (преглеждайте периодично; не е сверяван с днешния списък в този проход — NOT VERIFIED).
- Нова версия на файла: `tls … { protocols tls1.2 tls1.3 }` на двата хоста и HSTS на пренасочването от `www` (тествано в Docker, виж [TLS_HARDENING](TLS_HARDENING_2026-11-18.md)).
- Регистър на публикуваните портове (от `infra/deploy/compose.yml`): само уеб на `127.0.0.1:3000`; API и PostgreSQL нямат `ports`; базата е в `internal` мрежа.
- Режим „Full (strict)“ и Authenticated Origin Pulls: **не се наблюдават отвън** (NOT VERIFIED). Authenticated Origin Pulls би добавил втора защита, но файъруолът вече ограничава произхода; ползата е малка, а рискът от грешна конфигурация — реален, затова не се препоръчва сега.
