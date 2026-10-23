/**
 * Bulgarian keyword-to-page map.
 *
 * IMPORTANT: these are editorial HYPOTHESES based on how Bulgarian buyers describe the services.
 * No search-volume, difficulty or ranking data has been verified (no keyword tool or Search Console
 * data was available). Every entry has `volumeStatus: "unverified"` until it is checked in Google
 * Keyword Planner / Search Console and the `evidence` field is filled in.
 *
 * Rules enforced by src/content/seo-map.test.ts:
 *  - every primary keyword belongs to exactly one page (no cannibalisation);
 *  - no page uses another page's primary keyword as a secondary keyword;
 *  - the page <title> contains its primary keyword;
 *  - every mapped path exists in the sitemap.
 */
export type SearchIntent = "transactional" | "commercial" | "informational" | "navigational";

export interface KeywordTarget {
  path: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  intent: SearchIntent;
  /** Why this page owns the query and how it differs from neighbouring pages. */
  rationale: string;
  volumeStatus: "unverified" | "verified";
  /** Source and date once verified, e.g. "Keyword Planner BG, 2026-11". */
  evidence?: string;
}

export const keywordMap: KeywordTarget[] = [
  {
    path: "/",
    primaryKeyword: "AI решения за онлайн магазини",
    secondaryKeywords: ["технически партньор за онлайн магазини", "e-commerce агенция", "AI за онлайн търговия"],
    intent: "commercial",
    rationale: "Широка комбинирана заявка; началната страница разпределя към конкретните услуги.",
    volumeStatus: "unverified",
  },
  {
    path: "/uslugi",
    primaryKeyword: "услуги за онлайн магазини",
    secondaryKeywords: ["IT услуги за e-commerce", "услуги за Shopify и WooCommerce"],
    intent: "commercial",
    rationale: "Хъб страница за сравняване на услугите; вътрешни връзки към всяка услуга.",
    volumeStatus: "unverified",
  },
  {
    path: "/uslugi/poddrazhka-na-online-magazini",
    primaryKeyword: "поддръжка на онлайн магазин",
    secondaryKeywords: [
      "поддръжка на WooCommerce",
      "поддръжка на Shopify магазин",
      "техническа поддръжка на онлайн магазин",
      "обновяване на WooCommerce",
    ],
    intent: "transactional",
    rationale: "Търсещият иска изпълнител за поддръжка — страницата е търговска и води към оферта.",
    volumeStatus: "unverified",
  },
  {
    path: "/uslugi/seo-optimizatsiya",
    primaryKeyword: "SEO оптимизация на онлайн магазин",
    secondaryKeywords: ["SEO за онлайн магазини", "SEO на категории", "Core Web Vitals оптимизация", "SEO абонамент"],
    intent: "transactional",
    rationale: "Търговско намерение за SEO услуга. Информационната заявка за „технически SEO одит“ е в статия.",
    volumeStatus: "unverified",
  },
  {
    path: "/uslugi/ai-instrumenti-za-biznesa",
    primaryKeyword: "AI инструменти по поръчка",
    secondaryKeywords: ["AI асистент за онлайн магазин", "чатбот за сайт", "RAG решение", "AI за продуктови описания"],
    intent: "transactional",
    rationale: "Разработка на конкретен инструмент. Общата заявка „изкуствен интелект за бизнеса“ е на /ai-resheniya.",
    volumeStatus: "unverified",
  },
  {
    path: "/uslugi/avtomatizatsiya-na-procesi",
    primaryKeyword: "автоматизация на бизнес процеси",
    secondaryKeywords: ["AI автоматизация", "автоматизация на фактури", "CRM автоматизация", "автоматизация на имейли"],
    intent: "transactional",
    rationale: "Търговско намерение за внедряване. Информационната версия е статията за малкия бизнес.",
    volumeStatus: "unverified",
  },
  {
    path: "/uslugi/analizi-i-konversii",
    primaryKeyword: "оптимизация на конверсиите",
    secondaryKeywords: ["GA4 за онлайн магазин", "изоставени колички", "табло за продажби", "e-commerce анализи"],
    intent: "transactional",
    rationale: "Услуга за измерване и CRO; GA4 е вторична, защото е инструмент, а не цел.",
    volumeStatus: "unverified",
  },
  {
    path: "/uslugi/api-integratsii-oblak-i-sigurnost",
    primaryKeyword: "API интеграции",
    secondaryKeywords: ["интеграция на онлайн магазин с ERP", "WooCommerce интеграция", "Shopify интеграция", "webhooks"],
    intent: "transactional",
    rationale: "Техническа услуга за свързване на системи; сигурност и облак са вторични теми.",
    volumeStatus: "unverified",
  },
  {
    path: "/uslugi/tehnicheski-odit",
    primaryKeyword: "технически одит на онлайн магазин",
    secondaryKeywords: ["одит на WooCommerce магазин", "одит на Shopify магазин", "AI готовност"],
    intent: "transactional",
    rationale: "Платена входна услуга. Статиите за проблеми и SEO одит водят към нея.",
    volumeStatus: "unverified",
  },
  {
    path: "/ai-resheniya",
    primaryKeyword: "изкуствен интелект за бизнеса",
    secondaryKeywords: ["AI решения за бизнеса", "AI с човешко одобрение", "безопасно внедряване на AI"],
    intent: "commercial",
    rationale: "Подход и принципи за AI; разграничена от конкретната услуга за AI инструменти.",
    volumeStatus: "unverified",
  },
  {
    path: "/za-kogo",
    primaryKeyword: "технически партньор за онлайн търговци",
    secondaryKeywords: ["IT поддръжка за малък бизнес", "партньор за Shopify търговци"],
    intent: "commercial",
    rationale: "Сегментна страница; основно за вътрешно свързване и квалифициране.",
    volumeStatus: "unverified",
  },
  {
    path: "/proces",
    primaryKeyword: "процес на работа",
    secondaryKeywords: ["как протича проект", "етапи на проект за онлайн магазин"],
    intent: "navigational",
    rationale: "Поддържаща страница за решението на клиента, не за органичен трафик.",
    volumeStatus: "unverified",
  },
  {
    path: "/za-nas",
    primaryKeyword: "A.I. Commerce Studio",
    secondaryKeywords: [],
    intent: "navigational",
    rationale: "Брандова заявка.",
    volumeStatus: "unverified",
  },
  {
    path: "/kontakti",
    primaryKeyword: "заявка за оферта",
    secondaryKeywords: ["консултация за онлайн магазин", "оферта за поддръжка на онлайн магазин"],
    intent: "transactional",
    rationale: "Целева страница за конверсия; всички CTA водят тук.",
    volumeStatus: "unverified",
  },
  {
    path: "/statii",
    primaryKeyword: "статии за онлайн магазини",
    secondaryKeywords: ["съвети за онлайн търговия", "блог за e-commerce"],
    intent: "informational",
    rationale: "Хъб на редакционното съдържание.",
    volumeStatus: "unverified",
  },
  {
    path: "/statii/tehnicheski-problemi-pri-online-magazinite",
    primaryKeyword: "технически проблеми при онлайн магазините",
    secondaryKeywords: ["грешки в онлайн магазин", "проблеми с WooCommerce", "проблеми с количката"],
    intent: "informational",
    rationale: "Проблемно-ориентирана заявка; води към поддръжка и одит.",
    volumeStatus: "unverified",
  },
  {
    path: "/statii/ai-avtomatizatsiya-v-malkiya-biznes",
    primaryKeyword: "AI автоматизация в малкия бизнес",
    secondaryKeywords: ["автоматизация на ръчна работа", "AI за малък бизнес"],
    intent: "informational",
    rationale: "Образователна заявка; води към услугата за автоматизация.",
    volumeStatus: "unverified",
  },
  {
    path: "/statii/shopify-ili-woocommerce",
    primaryKeyword: "Shopify или WooCommerce",
    secondaryKeywords: ["Shopify срещу WooCommerce", "коя платформа за онлайн магазин", "WooCommerce или Shopify"],
    intent: "commercial",
    rationale: "Сравнителна заявка преди избор на платформа; води към поддръжка и интеграции.",
    volumeStatus: "unverified",
  },
  {
    path: "/statii/tehnicheski-seo-odit-na-online-magazin",
    primaryKeyword: "технически SEO одит на онлайн магазин",
    secondaryKeywords: ["SEO проверка на сайт", "индексиране на онлайн магазин"],
    intent: "informational",
    rationale: "Как да направите проверката сами; разграничена от търговската SEO услуга.",
    volumeStatus: "unverified",
  },
  {
    path: "/statii/ai-asistent-za-klienti",
    primaryKeyword: "AI асистент за клиенти",
    secondaryKeywords: ["чатбот за обслужване на клиенти", "AI в обслужването на клиенти"],
    intent: "informational",
    rationale: "Оценка дали асистент има смисъл; води към AI инструменти.",
    volumeStatus: "unverified",
  },
  {
    path: "/statii/avtomatizatsiya-s-choveshko-odobrenie",
    primaryKeyword: "автоматизация с човешко одобрение",
    secondaryKeywords: ["human in the loop", "контрол на AI агенти"],
    intent: "informational",
    rationale: "Нишова тема, която подкрепя позиционирането за безопасен AI.",
    volumeStatus: "unverified",
  },
];
