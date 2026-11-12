# V5 — напредък по фази

Клон: `feature/v5-redesign` (worktree `D:\Projects\aicommercestudio\.claude\worktrees\v5-redesign`, създаден от върха на
`feature/commercial-expansion`, `0c14c6a`). По изрично искане на собственика (2026-11-12): комит, PR към `main` и Release; преди това собственикът
не беше прегледал промените. Тестовете се пускат в отделен Docker проект `acs-v5` (уеб на `localhost:3100`), за да
не се пипа общият стек `ai-commerce-studio` на другата сесия.

| Фаза | Статус | Основни файлове | Тестове | Остава |
| --- | --- | --- | --- | --- |
| 01 Одит | Готово | `docs/V5_SITE_AUDIT.md` | Обхождане на живия сайт: 260 адреса, 374 цели на връзки, 0 счупени, 0 сираци | – |
| 02 Дизайн система | Готово | `app/globals.css` (раздел V5), `components/v5/*`, `docs/V5_VISUAL_DIRECTION.md`, `docs/V5_DESIGN_SYSTEM.md` | `design-tokens.test.ts` минава с новите компоненти | – |
| 03 Начална страница | Готово | `app/[locale]/page.tsx`, `content/{bg,en}/v5.ts` (`home`) | unit + e2e (виж финалния отчет) | Одобрение на текстовете от собственика |
| 04 Навигация и връзки | Готово | `lib/site-nav.ts`, `components/layout/Header.tsx`, `Footer.tsx`, `Header.test.tsx`, `e2e/tests/v5-navigation.spec.ts`, `docs/V5_LINK_AUDIT.md` | unit (12 теста на менюто) + e2e обхождане | D-52, D-54 за собственика |
| 05 Сайтове | Готово | `app/[locale]/izrabotka-na-saytove/page.tsx`, `components/v5/HubPage.tsx` | `content/v5.test.ts` | D-51 (цени) |
| 06 Онлайн магазини | Готово | `app/[locale]/online-magazini/page.tsx` | `content/v5.test.ts` | Повторна проверка на източниците при преглед (D-55) |
| 07 Пакети и цени | Готово (без нови цени) | хъбовете показват пакетите от `lib/project-packages.ts`; D-51 | `project-packages.test.ts`, `v5.test.ts` | Цени за статичен сайт и др. — решение на собственика |
| 08 Визуални прегледи | Готово | `components/v5/UiPreview.tsx` | unit + визуален преглед | – |
| 09 Конфигуратор → кошница → запитване → CRM | Проверено, без промяна на модулите | – | `commercial`: 32 + 12 минали | Блокерите остават отворени |
| 10 Акаунти | Проверено | `AccountLinks` остава в заглавната част, мобилния панел и колонтитула, само при включен флаг | `AccountEntry.test.tsx`, пакет `legal` | – |
| 11 Текущи услуги | Готово | таблица в `app/[locale]/paketi/page.tsx`, `content/{bg,en}/v5.ts` (`care`) | e2e обхождане | – |
| 12 SEO | Готово | метаданни, `sitemap.ts`, `search-index.ts`, `content/{bg,en}/seo.ts`, `seo-map.test.ts` | `seo-map.test.ts`, `routing-and-seo.test.ts` | Ключовите думи са хипотези (`volumeStatus: "unverified"`) |
| 13 Производителност и достъпност | Измерено преди и след | `docs/PERFORMANCE_BASELINE.md` (раздел V5) | Lighthouse: десктоп 99–100, a11y 100, CLS 0; мобилен LCP 3,2–4,1 s | Мобилен LCP над бюджета и преди, и след (D-47) |
| 14 Визуален преглед | Направен | 9 находки и поправки (отчета, §7) | браузър, 360–1440 px | – |
| 15 Регресия | Минава | тестове на старото меню и герой пренаписани (отчета, §8) | web 1109, API 1634 (+1 пропуснат), e2e 351 + 53, commercial 32 + 12, legal 66; 0 неуспешни | – |
| 16 Отчет | Готово | `docs/V5_FINAL_IMPLEMENTATION_REPORT.md` | – | – |

Точните резултати и списъкът с променени файлове: `docs/V5_FINAL_IMPLEMENTATION_REPORT.md`.
