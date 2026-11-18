# GitHub: управление на сигурността — 2026-11-18 (SEC-A01)

Прочетено през `gh api` (само четене). **Нищо не е променено в GitHub.**

## Текущо състояние (VERIFIED)
| Настройка | Стойност |
| --- | --- |
| Ruleset `27436434` | `active`; заобикаляне: роля Admin (`actor_id 5`), режим `pull_request` |
| Одобрения | `required_approving_review_count: 0`, `require_code_owner_review: false`, `require_last_push_approval: false`, `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true` |
| Задължителни проверки (8) | API (pytest + ruff); Web (typecheck + lint + unit); End-to-end (Playwright); Client portal e2e (portal on, test stack); Secret scan (gitleaks); CodeQL (python); CodeQL (javascript-typescript); Dependency review — със `strict_required_status_checks_policy: true` |
| `Deploy config guard` | **не е задължителна**, но се изпълнява на всеки PR и на `main` |
| Force-push и изтриване | забранени (`non_fast_forward`, `deletion`) |
| Actions | `sha_pinning_required: false` (всички външни действия във workflows **вече са по SHA**; локалните `uses: ./…` не се закрепват); `default_workflow_permissions: read`; `can_approve_pull_request_reviews: false` |
| Сигурност на хранилището | secret scanning **enabled**, push protection **enabled**; Dependabot security updates **disabled**; Dependency graph **изключен** (`…/dependency-graph/sbom` → 404) |
| Среда `production` | 1 задължителен рецензент (потребител), `prevent_self_review: false`, `can_admins_bypass: true`, политика на клоновете: само `main` |
| Участници | един администратор |

## Независим ли е рецензентът на производството? — НЕ
Хранилището има **един** администратор, а рецензентът на среда `production` е потребител с `prevent_self_review: false`. Човекът, който пуска Release, може да одобри собственото си разгръщане, а администраторите могат да заобиколят защитата на средата. Така изискването „1 рецензент“ е **потвърждение на намерението**, не независим контрол. Не го броя за независимо одобрение. Включването на `prevent_self_review` без втори допустим рецензент би блокирало всяко разгръщане, затова не е препоръчително, докато няма втори човек.

## Проверка на предложението `ruleset-main-single-maintainer.json`
- Девет задължителни проверки; имената **съвпадат буквално** с наличните на PR #107 (`gh pr checks`): осем от текущата + `Deploy config guard` (job `deploy-config`, `name: Deploy config guard`).
- Всяка от тях се докладва на `pull_request` събитие (видяно на PR #107) и не може да остане завинаги „pending“, освен ако workflow не бъде пропуснат от филтър на пътищата: в `ci.yml` и `security.yml` няма `paths:` филтри за тези задачи (проверено четене на файловете).
- Запазени: задължителен PR, забрана на force-push и изтриване, `strict`, `required_review_thread_resolution`, `dismiss_stale_reviews_on_push`. Без изискване за одобрение, което никой не може да даде.
- **Разлика преди/след:** единствената промяна е добавянето на `{ "context": "Deploy config guard" }` в `required_status_checks`.

## Прилагане (чака ТВОЕТО одобрение)
```bash
gh api repos/aiskrev/aicommercestudio/rulesets/27436434 > ruleset-27436434.backup.json   # реалното копие за връщане
gh api -X PUT repos/aiskrev/aicommercestudio/rulesets/27436434 --input infra/github/ruleset-main-single-maintainer.json
gh api repos/aiskrev/aicommercestudio/rulesets/27436434 --jq '[.rules[]|select(.type=="required_status_checks")|.parameters.required_status_checks[].context]|length'   # очаквано: 9
```
Връщане: `gh api -X PUT … --input ruleset-27436434.backup.json` (реалното копие, не шаблон). Преди това проверете, че `Deploy config guard` е изпълнена поне веднъж на `main` (изпълнена е: Security push runs).

## Други настройки (не са включени)
| Настройка | Как | Влияние |
| --- | --- | --- |
| Dependency graph + Dependabot alerts | Settings → Code security | `Dependency review` минава през action-а вместо през резервния път |
| Dependabot security updates | същото | PR-и за уязвимости; няма автоматично сливане |
| Require actions pinned to SHA | Settings → Actions → General | безопасно: всички външни действия вече са по SHA |

## Dependabot и хеш-заключените файлове
Dependabot (`pip in /apps/api`, run `44099955814`, след сливането на #104) **разпозна** `pip-compile` (`pip-compile 7.6.1`), разчете целия списък на зависимостите и завърши успешно. Това доказва, че разпознава файловете; **не доказва**, че при реално обновяване ще пренапише `requirements.in` и `requirements.txt` заедно — първото такова PR е в понеделник (седмичен график). Бележка: заключващите файлове са генерирани с `pip-tools 7.7.0`, Dependabot ползва 7.6.1; заглавието ще се промени при първото му обновяване — безобидно. Ако PR обнови само единия файл, `Dependency review`/`pip-audit --require-hashes` и Docker сборката ще паднат (хешовете са задължителни), т.е. грешката не може да мине тихо.
