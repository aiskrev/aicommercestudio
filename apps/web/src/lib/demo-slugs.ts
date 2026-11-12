/**
 * Page slugs of the interactive demonstrations (`/bg/demo-tsentar/<bg>` ↔ `/en/demo-centre/<en>`), keyed by the scenario
 * keys of the API (`app/demos/engine.py`). Kept free of imports: the locale routing (i18n/config.ts) reads it.
 * The Bulgarian and English slug of a page must differ (identical slugs would redirect forever).
 */
export const DEMO_SLUGS = {
  product_description: { bg: "opisanie-na-produkt", en: "product-description" },
  lead_qualification: { bg: "kvalifikatsiya-na-zapitvane", en: "lead-qualification" },
  support_routing: { bg: "nasochvane-kam-podkrepa", en: "support-routing" },
  order_workflow: { bg: "analiz-na-poruchka", en: "order-workflow" },
  inventory_warning: { bg: "preduprezhdenie-za-nalichnost", en: "inventory-warning" },
  crm_automation: { bg: "crm-avtomatizatsiya", en: "crm-automation" },
  quotation_drafting: { bg: "chernova-na-oferta", en: "quotation-drafting" },
  human_approval: { bg: "odobrenie-ot-chovek", en: "human-approval" },
} as const;

export type DemoKey = keyof typeof DEMO_SLUGS;
export const DEMO_KEYS = Object.keys(DEMO_SLUGS) as DemoKey[];

export function demoBySlug(slug: string): DemoKey | undefined {
  return DEMO_KEYS.find((key) => DEMO_SLUGS[key].bg === slug);
}
