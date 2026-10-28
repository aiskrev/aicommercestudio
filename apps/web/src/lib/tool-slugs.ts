/**
 * Page slugs of the tools hosted under `/bg/instrumenti/<bg>` ↔ `/en/tools/<en>`. Kept free of
 * imports so that both the tool registry (lib/tools.ts) and the locale routing (i18n/config.ts)
 * can use it without an import cycle. Planned tools have an intro page under the same slug and
 * keep it when they go live, so their URL never changes.
 */
export const TOOL_PAGE_SLUGS = {
  readiness: { bg: "ai-gotovnost", en: "ai-readiness" },
  team: { bg: "ai-ekip", en: "ai-team" },
  roi: { bg: "roi-kalkulator", en: "roi-calculator" },
  finder: { bg: "avtomatizatsii", en: "automation-finder" },
  solution: { bg: "ai-reshenie", en: "solution-builder" },
  cloud_maturity: { bg: "zrelost-na-oblak-i-platforma", en: "cloud-platform-maturity" },
  devops_maturity: { bg: "zrelost-na-devops-dostavkata", en: "devops-delivery-maturity" },
  observability: { bg: "nablyudaemost-i-nadezhdnost", en: "observability-reliability" },
  ecommerce_architecture: { bg: "arhitektura-na-online-magazin", en: "ecommerce-architecture" },
  data_integration: { bg: "integratsiya-na-danni", en: "data-integration" },
  ai_governance: { bg: "otgovoren-ai", en: "responsible-ai-governance" },
  ai_ops_readiness: { bg: "gotovnost-za-ai-operatsii", en: "ai-operations-readiness" },
  finops: { bg: "finops-i-ai-razhodi", en: "finops-ai-cost" },
} as const;

export type HostedToolKey = keyof typeof TOOL_PAGE_SLUGS;
