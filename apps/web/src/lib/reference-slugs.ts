/**
 * Page slugs of the reference scenarios and integration patterns (`/bg/referentni-stsenarii/<bg>` ↔
 * `/en/reference-scenarios/<en>`, `/bg/integratsionni-modeli/<bg>` ↔ `/en/integration-patterns/<en>`).
 * Kept free of imports: the locale routing (i18n/config.ts) reads it, and so does lib/reference.ts.
 * The Bulgarian and English slug of a page must differ: the routing treats a Bulgarian slug in an
 * English URL as internal and redirects it (identical slugs would redirect forever).
 */
export const SCENARIO_SLUGS = {
  ai_invoice_workflow: { bg: "avtomatizatsiya-na-fakturi", en: "invoice-approval-workflow" },
  multi_agent_service: { bg: "mnogoagentno-obsluzhvane", en: "multi-agent-service-desk" },
  rag_policy_assistant: { bg: "asistent-za-vatreshni-pravila", en: "rag-policy-assistant" },
  document_intelligence: { bg: "obrabotka-na-dogovori", en: "contract-document-intelligence" },
  commerce_erp_sync: { bg: "sinhronizatsiya-magazin-erp", en: "commerce-erp-synchronisation" },
  catalog_enrichment: { bg: "obogatyavane-na-katalog", en: "product-catalog-enrichment" },
  ai_support_handoff: { bg: "ai-poddrazhka-s-predavane", en: "ai-support-with-handoff" },
  azure_landing_zone: { bg: "azure-osnovna-zona", en: "azure-landing-zone" },
  aws_landing_zone: { bg: "aws-osnovna-zona", en: "aws-landing-zone" },
  kubernetes_platform: { bg: "kubernetes-platforma", en: "kubernetes-platform" },
  gitops_delivery: { bg: "ci-cd-i-gitops", en: "ci-cd-and-gitops" },
  observability_otel: { bg: "nablyudaemost-s-opentelemetry", en: "observability-with-opentelemetry" },
  cloud_migration: { bg: "migratsiya-kam-oblak", en: "cloud-migration" },
  hybrid_integration: { bg: "hibridna-integratsiya", en: "hybrid-integration" },
  identity_secrets: { bg: "identichnost-i-tayni", en: "identity-and-secrets" },
  finops_ai_costs: { bg: "finops-i-ai-razhodi", en: "finops-and-ai-costs" },
  ai_operations: { bg: "operirane-na-ai-sistemi", en: "ai-operations" },
  data_pipeline: { bg: "potok-ot-danni", en: "data-pipeline" },
  platform_reliability: { bg: "nadezhdnost-na-platformata", en: "platform-reliability" },
  genai_gateway: { bg: "zashtiten-ai-shlyuz", en: "secure-genai-gateway" },
} as const;

export const PATTERN_SLUGS = {
  rest_webhooks: { bg: "rest-api-i-webhooks", en: "rest-apis-and-webhooks" },
  event_driven: { bg: "integratsiya-chrez-sabitiya", en: "event-driven-integration" },
  erp_crm_sync: { bg: "sinhronizatsiya-erp-crm-magazin", en: "erp-crm-commerce-sync" },
  rag_ingestion: { bg: "rag-indeksirane-i-tarsene", en: "rag-ingestion-and-retrieval" },
  human_approval: { bg: "odobrenie-ot-chovek", en: "human-approval-workflow" },
  landing_zone: { bg: "osnovna-zona-hub-spoke", en: "landing-zone-hub-spoke" },
  terraform_gitops: { bg: "terraform-i-gitops", en: "terraform-and-gitops" },
  kubernetes_platform: { bg: "kubernetes-platformeni-modeli", en: "kubernetes-platform-patterns" },
  opentelemetry: { bg: "sabirane-s-opentelemetry", en: "opentelemetry-collection" },
  identity_secrets: { bg: "identichnost-i-upravlenie-na-tayni", en: "identity-and-secret-handling" },
  llm_provider: { bg: "adapter-za-ai-model", en: "llm-provider-adapter" },
} as const;
