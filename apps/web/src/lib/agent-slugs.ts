/**
 * Page slugs of the AI agent library (`/bg/ai-agenti/<bg>` ↔ `/en/ai-agents/<en>`). Kept free of
 * imports: the locale routing (i18n/config.ts) reads it, and so does lib/agent-library.ts.
 */
export const AGENT_SLUGS = {
  lead_qualification: { bg: "kvalifikatsiya-na-zapitvaniya", en: "lead-qualification-agent" },
  sales_research: { bg: "prouchvane-na-klienti", en: "sales-research-agent" },
  customer_support: { bg: "obsluzhvane-na-klienti", en: "customer-support-agent" },
  content_operations: { bg: "sadarzhanie", en: "content-operations-agent" },
  document_processing: { bg: "obrabotka-na-dokumenti", en: "document-processing-agent" },
  knowledge_assistant: { bg: "asistent-za-vatreshni-znaniya", en: "knowledge-assistant" },
  scheduling: { bg: "sreshti-i-grafitsi", en: "scheduling-agent" },
  reporting_insights: { bg: "otcheti-i-analizi", en: "reporting-insights-agent" },
  workflow_coordinator: { bg: "koordinator-na-protsesi", en: "workflow-coordinator" },
  approval_supervisor: { bg: "kontrol-na-odobreniyata", en: "approval-supervisor" },
} as const;
