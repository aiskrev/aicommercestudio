# Проверка на производството: код ↔ внедряване ↔ реална конфигурация — 2026-11-18

Само безопасни GET/HEAD заявки, не повече от една в секунда, без тела, без вход, без тайни. Нищо не е записвано в производството. Конфигурационен файл в репото **не** е доказателство, че правило е активно.

## Наблюдавано (OBSERVED_PRODUCTION), ai-commercestudio.com
| Заявка | Резултат |
| --- | --- |
| `GET /api/health/ready` | `{"status":"ok","database":"ok","host":"ok"}` |
| `HEAD /bg`, `/en` | 200 |
| `HEAD /BG/uslugi` | 308 → `/bg/uslugi` |
| `HEAD /api/docs`, `/api/openapi.json` | 404 (документацията е изключена) |
| `HEAD /api/health` | 200 |
| `HEAD /admin` | 307 → `/admin/login?next=%2Fadmin`; `HEAD /bg/admin` → 404 |
| `HEAD /.well-known/security.txt` | 404 |
| `HEAD /robots.txt`, `/sitemap.xml` | 200 |
| `TRACE /bg` | 405 |
| Заглавия на `/bg` | `strict-transport-security: max-age=31536000; includeSubDomains`, `x-frame-options: DENY`, `x-content-type-options: nosniff`, `referrer-policy: strict-origin-when-cross-origin`, `permissions-policy: camera=(), microphone=(), geolocation=(), payment=()`, `cross-origin-opener-policy: same-origin`, CSP със `script-src 'self' 'unsafe-inline'`, `frame-ancestors 'none'`, `object-src 'none'`; `via: 1.1 Caddy`, `server: cloudflare` |
| Кеш | `/bg`: `Cache-Control: s-maxage=31536000`, `cf-cache-status: DYNAMIC`; `/api/health/ready`: без `Cache-Control` |

## Матрица
| Контрол | Изходен код | Внедрено (GitHub) | Реална конфигурация | Статус |
| --- | --- | --- | --- | --- |
| Версия на сайта | `main` `053fd67` | Release `44116233973` успешен, всички стъпки зелени, външната проверка мина | тройка успешни Uptime изпълнения след това | VERIFIED_CI |
| Роля на API в базата | `create_app` отказва старт при роля ≠ `acs_app_api` | кодът е разгърнат с този Release | API стартира и отговаря → ролята е `acs_app_api` (или е зададен `ALLOW_OWNER_DATABASE_ROLE`); записът на собственика от 2026-11-10 съвпада | **INFERRED** (не заменя `db-role-check`) |
| `compose.yml` със `:?` за `API_DB_*` | в репото | копира се ръчно на сървъра | не е проверимо | NOT VERIFIED |
| MFA за служители | реализирана, по подразбиране изключена | – | README на собственика: включена, всички с MFA | NOT VERIFIED отвън |
| API документация изключена | `ENABLE_API_DOCS: "false"` в compose | – | 404 на `/api/docs` и `/api/openapi.json` | OBSERVED_PRODUCTION |
| TLS режим Full (strict), WAF, Access, правила за честота | JSON в `infra/cloudflare` | – | не е достъпно | **NOT VERIFIED** (OWNER) |
| Достъпност на API и PostgreSQL от интернет | само уеб е на `127.0.0.1` в compose | – | външно не е сканирано (без портове сканиране) | NOT VERIFIED |
| Резервни копия, възстановяване, 5xx аларма | скриптове в `infra/deploy` | – | няма доказателство за изпълнена проба | NOT VERIFIED (OWNER) |
| Governance на `main` | `ruleset-main.json` | ruleset active, непроменен | gh api, прочетен днес | VERIFIED |
| Среда `production` | – | 1 задължителен рецензент, персонализирана политика на клоновете | gh api | VERIFIED |
| Скенер на тайни | – | secret scanning и push protection **enabled** | gh api | VERIFIED |
| Dependabot security updates | – | `disabled` | gh api | VERIFIED (Open) |
| Dependency graph | – | 404 на `…/dependency-graph/sbom` → изключен | gh api | VERIFIED (Open) |
