import type { CaseStudy, EditorialCategory } from "@/content/types";

/** Editorial taxonomy for articles. Category pages live at /statii/tema/<slug>. */
export const editorialCategories: EditorialCategory[] = [
  {
    slug: "tehnicheska-poddrazhka",
    name: "Техническа поддръжка",
    title: "Статии за техническата поддръжка на онлайн магазини",
    description:
      "Практически насоки за стабилна работа на онлайн магазина: обновления, скорост, количка, интеграции, архиви и сигурност.",
    relatedService: "maintenance",
  },
  {
    slug: "seo",
    name: "SEO",
    title: "Статии за SEO на онлайн магазини",
    description: "Техническо SEO, индексиране, структура на категориите и измерване на органичния трафик за онлайн магазини.",
    relatedService: "seo",
  },
  {
    slug: "ai",
    name: "Изкуствен интелект",
    title: "Статии за AI в онлайн търговията и обслужването на клиенти",
    description: "Кога AI асистентите и инструментите имат смисъл, как се оценява качеството им и как се пазят данните.",
    relatedService: "ai_tools",
  },
  {
    slug: "avtomatizatsiya",
    name: "Автоматизация",
    title: "Статии за автоматизация на бизнес процеси",
    description: "Как да намалите ръчната работа с автоматизации и AI, без да губите контрол над важните решения.",
    relatedService: "automation",
  },
  {
    slug: "platformi",
    name: "Платформи",
    title: "Статии за избор и развитие на платформа за онлайн магазин",
    description: "Сравнения и съвети за Shopify, WooCommerce и решения по поръчка — разходи, гъвкавост и поддръжка.",
    relatedService: "integrations",
  },
];

/**
 * Client case studies. Intentionally EMPTY: there are no published client projects yet.
 * Add an entry only for real, completed work with written client approval; results must cite
 * how and when they were measured. Entries that fail `isPublishable` are never rendered,
 * never listed in the sitemap and fail the content tests.
 */
export const caseStudies: CaseStudy[] = [];

export function isPublishable(study: CaseStudy): boolean {
  const v = study.verification;
  return (
    v.realProject &&
    v.clientApproved &&
    v.approvedBy.trim().length > 0 &&
    !Number.isNaN(Date.parse(v.approvedAt)) &&
    study.results.every((r) => r.source.trim().length > 0 && !Number.isNaN(Date.parse(r.measuredAt)))
  );
}

export const publishableCaseStudies = (): CaseStudy[] => caseStudies.filter(isPublishable);
