# Настройки на GitHub: предложение за одобрение (одит 2026-11-12, фаза 03)

**Нищо от този документ не е приложено.** Кодът и работните процеси (CODEOWNERS, Dependabot, `security.yml`, закрепени Actions) са в клона; настройките на самото хранилище
променя само собственикът. Състоянието по-долу е прочетено само за четене с `gh api` на 2026-11-12.

## 1. Състояние при одита (потвърдено)

| Настройка | Състояние |
| --- | --- |
| Защита на клона `main` (класически) | **няма** (`404 Branch not protected`) |
| Набори от правила (rulesets) | **няма** (0) |
| Secret scanning и push protection | включени |
| Dependabot security updates | **изключени** |
| Права по подразбиране на токена на Actions | `read`, не може да одобрява pull заявки (добре) |
| Разрешени Actions | всички (`allowed_actions: all`), без задължително закрепване по SHA |
| `CODEOWNERS`, `dependabot.yml`, сканиране на тайни/CodeQL/SBOM в CI | **нямаше** – добавени в клона |

## 2. Какво е добавено в кода (чака сливане на PR)

| Файл | Ефект |
| --- | --- |
| `.github/CODEOWNERS` | собственикът е ревюер на всичко; изрично на защитеното съдържание (портрет, контакти, профил), на `.github`, `infra`, `scripts`, Dockerfile-овете, миграциите и на файловете за сигурност |
| `.github/dependabot.yml` | седмични PR за `pip`, `npm` (уеб и e2e), `docker`, `github-actions`; минорните и пачовете в една група |
| `.github/workflows/security.yml` | `Secret scan (gitleaks)` върху цялата история, `Dependency review` (на PR; пада при ниво `high`), `CodeQL` за Python и JS/TS (`security-extended`, и седмично), `SBOM (CycloneDX)` като артефакт 90 дни |
| `.gitleaks.toml` | правилата по подразбиране + единствен изключение: тестовите файлове (13 исторически находки, всички измислени пароли/ключове във фикстури) |
| Всички `uses:` в `ci.yml`, `release.yml`, `audit.yml` | закрепени по пълен SHA на комита (с коментар за версията); Dependabot ги обновява |

## 3. Предложение за настройки (за одобрение, по ред)

1. **Ruleset за `main`** – готов файл `infra/github/ruleset-main.json` (Settings → Rules → Rulesets → New → Import):
   * забранява триене и принудително изпращане (`deletion`, `non_fast_forward`);
   * изисква pull заявка (**0 одобрения** засега: единственият собственик не може да одобри собствена PR; повишава се на 1, когато има втори ревюер; решенията се затварят преди сливане);
   * изисква актуален клон и минали проверки: `API (pytest + ruff)`, `Web (typecheck + lint + unit)`, `End-to-end (Playwright)`, `Client portal e2e (portal on, test stack)`, `Secret scan (gitleaks)`, `CodeQL (python)`, `CodeQL (javascript-typescript)`, `Dependency review`;
   * администраторът може да заобиколи само чрез PR (авариен път), не с директно изпращане.
   **Важно:** имената на проверките трябва да са се изпълнили поне веднъж, за да се избират; първо слейте този PR, после включете ruleset-а.
   Предупреждение: проверките `commercial` и `legal` не са в GitHub CI (пускат се локално), затова не са в списъка; препоръка е да се добавят като ръчно стартиращ се workflow преди големи функции.
2. **Dependabot security updates** – Settings → Code security → включване (безплатно за публично хранилище).
3. **Actions** – Settings → Actions → General → „Allow aiskrev, and select non-aiskrev actions“ с разрешени `actions/*`, `docker/*`, `github/codeql-action/*`, `anchore/sbom-action` и включено „Require actions to be pinned to a full-length commit SHA“ (всички вече са закрепени).
4. **Environment `production`** – вече има изискан ревюър и клон `main` според `release.yml`; проверете, че „Prevent self-review“ е изключено само докато има един човек.
5. **Подписани комити** (по избор): `required_signatures` е умишлено извън готовия ruleset, защото автоматизираните комити от Claude Code не са подписани; включете го, ако всички комити се правят от машина с ключ.
6. **Private vulnerability reporting** и `SECURITY.md` в корена с адрес за сигнали (контактът се взема от `lib/company.ts`, не се дублира тук).
7. **Branch `main` → default merge method**: само „Squash“ (линейна история, лесно връщане).

## 4. Какво НЕ покрива това

* Не защитава сървъра: достъпът до производството е през отделния ключ `acsdeploy` и Cloudflare Access (`infra/deploy/README.md`).
* Ruleset-ът не заменя ревюто на човек; при един собственик „задължителни ревюта“ са по-скоро проверки и дисциплина, не контрол от втори човек.
* Проверките на GitHub (CodeQL, Dependency review) не са пускани на GitHub в тази сесия (нямаше изпращане); работата на gitleaks е проверена локално (виж `TEST_RESULTS.md`), а YAML на `security.yml` е проверен само за синтаксис.
