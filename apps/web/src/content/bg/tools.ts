import type { IconName } from "@/components/ui/Icon";
import type { ToolKey } from "@/lib/tools";

/**
 * Interactive tools catalog (homepage preview, /instrumenti hub, service pages). Only tools with a
 * route in `lib/tools.ts` are linked; the others are shown as "in preparation" without links.
 */
export const tools = {
  liveBadge: "Работи сега",
  upcomingBadge: "В подготовка",
  upcomingNote: "Инструментите в подготовка още не са налични. Дотогава започнете със Съветника или с техническа оценка.",
  relatedTitle: "Свързани инструменти",
  relatedLead: "Започнете с бърза самостоятелна оценка, преди да разговаряме.",
  items: [
    {
      key: "advisor",
      icon: "sparkles",
      category: "Откриване на възможности за автоматизация",
      title: "AI съветник за автоматизация",
      description:
        "Опишете ръчен процес и получете структурирана първоначална оценка: възможности за автоматизация, работен поток, интеграции, рискове и точките, които изискват човешко одобрение.",
      cta: "Пробвайте Съветника",
    },
    {
      key: "readiness",
      icon: "gauge",
      category: "Стратегия",
      title: "Оценка на AI готовността",
      description: "Кратък въпросник за данните, процесите и екипа, който показва откъде да започнете.",
    },
    {
      key: "team",
      icon: "users",
      category: "Агенти",
      title: "Съберете своя AI екип",
      description: "Изберете агенти, инструментите им и одобренията, които изискват — и вижте системата като схема.",
    },
    {
      key: "roi",
      icon: "chart",
      category: "Бизнес ефект",
      title: "Калкулатор на ефекта (ROI)",
      description: "Изчисление само по вашите собствени данни, с видима формула и без предварително зададени стойности.",
    },
  ] satisfies { key: ToolKey; icon: IconName; category: string; title: string; description: string; cta?: string }[],
};
