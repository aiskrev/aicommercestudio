# Верига на доставка — 2026-11-17

| Контрол | Състояние | Доказателство |
| --- | --- | --- |
| GitHub Actions закрепени по SHA | **да** — всички `uses:` към трети страни са по пълен SHA; изключение само локалните `./.github/workflows/*.yml` | `grep` на `.github/workflows` |
| „Изискване на SHA“ в настройките на Actions | **не** (`sha_pinning_required: false`); разрешени всички Actions | `gh api …/actions/permissions` — **собственик** |
| Права на токена | `contents: read` по подразбиране; пакетите/сигурността се дават на ниво задача | `security.yml`, `release.yml` |
| Fork PR | токенът е само за четене; `pull_request` (не `pull_request_target`) | `security.yml` |
| Тайни в историята | `Secret scan (gitleaks)` върху цялата история в CI (минава на `301dbdf`); push protection включена | `gh run list`; `security_and_analysis` |
| Статичен анализ | CodeQL за Python и JS/TS (`security-extended`), минава на `301dbdf` | `security.yml` |
| SBOM | CycloneDX артефакт, 90 дни | `security.yml` |
| Dependency review | **поправено в този клон (SEC-01)**; графът е изключен | – |
| `pip-audit` | чисто, `requirements.txt` (локално, 2026-11-17) | локален изход |
| `npm audit` | `apps/web --omit=dev`: 0; `apps/web/e2e`: 0 (локално, 2026-11-17) | локален изход |
| Dependabot | седмични PR за pip/npm/docker/actions; **security updates изключени** | `.github/dependabot.yml`; `gh api` — **собственик** |
| Docker образи | API, уеб, e2e — по digest (този клон); `postgres:17-alpine` — таг | Dockerfile-ове, `compose.yml` |
| Python пакети с хешове | **не** (`pip-compile --generate-hashes` не е направено; променя изграждането) | `apps/api/requirements*.txt` |
| Сканиране на образи (Trivy/Grype) | **не е изпълнявано** в този одит | – |
| Подписи на образи/произход | **няма** | – |

## Преглед на последните големи ъпдейти (след Release `b1a2c43`)
- **Stripe 16.1.0 → 17.0.0** (слят): единствената несъвместима промяна по бележките е за pickle на `StripeObject` (ключовете вече не се запазват). Кодът ползва `StripeClient` и `Webhook.construct_event`; pickle не се използва. Тестовете минават с **фалшив шлюз** — реален Stripe не е проверяван.
- **Node 25 → 26** (слят в `main`): уеб тестове и e2e минаха в CI; не е тествано в производствена среда.
- **Playwright 1.65.0 → 1.65.1**: образът и npm пакетът трябва да съвпадат (поправено в #99).

## Остава
1. `pip-compile --generate-hashes` (отделен PR и преглед).
2. Digest на `postgres` в `compose.yml` — само след като собственикът потвърди кой образ върви.
3. Включване на Dependency graph, Dependabot security updates и „Require actions to be pinned to a full-length SHA“ (собственик).
4. Сканиране на образите в CI.
