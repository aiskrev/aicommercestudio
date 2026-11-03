/**
 * Page slugs of the Workshops & Advisory catalogue (`/bg/rabotni-sreshti/<bg>` ↔ `/en/workshops/<en>`).
 * Kept free of imports: the locale routing (i18n/config.ts) reads it, and so does lib/workshops.ts.
 * The Bulgarian and English slug of a page must differ (identical slugs would redirect forever).
 * The keys are also accepted by the API (`app.models.WorkshopKey`) as the subject of an enquiry.
 */
export const WORKSHOP_SLUGS = {
  ai_strategy_discovery: { bg: "ai-strategiya-rabotna-sreshta", en: "ai-strategy-discovery-workshop" },
  ai_readiness_mapping: { bg: "ai-gotovnost-i-vazmozhnosti", en: "ai-readiness-opportunity-mapping" },
  agent_architecture: { bg: "arhitektura-na-ai-agenti", en: "agent-architecture-workshop" },
  landing_zone_assessment: { bg: "otsenka-na-oblachna-osnovna-zona", en: "cloud-landing-zone-assessment" },
  kubernetes_review: { bg: "pregled-na-kubernetes-platforma", en: "kubernetes-platform-review" },
  devops_gitops_assessment: { bg: "otsenka-devops-i-gitops", en: "devops-gitops-assessment" },
  observability_sre: { bg: "nablyudaemost-i-sre-rabotna-sreshta", en: "observability-sre-workshop" },
  ecommerce_integration_discovery: { bg: "integratsii-za-elektronna-targoviya", en: "ecommerce-integration-discovery" },
  rag_data_readiness: { bg: "rag-i-gotovnost-na-dannite", en: "rag-data-readiness-workshop" },
  responsible_ai_review: { bg: "pregled-na-otgovoren-ai", en: "responsible-ai-governance-review" },
} as const;

export type WorkshopKey = keyof typeof WORKSHOP_SLUGS;
export const WORKSHOP_KEYS = Object.keys(WORKSHOP_SLUGS) as WorkshopKey[];
