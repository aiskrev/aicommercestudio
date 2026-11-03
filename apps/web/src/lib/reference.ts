import type { DomainKey } from "@/lib/domains";
import { PATTERN_SLUGS, SCENARIO_SLUGS } from "@/lib/reference-slugs";
import type { ToolKey } from "@/lib/tools";

/**
 * Reference scenarios and integration patterns (docs/REFERENCE_CONTENT.md).
 *
 * Structure lives here (keys, categories, links, integration status); texts live in
 * content/{bg,en}/reference.ts. Every scenario is a clearly labelled **fictional** example of how we
 * would approach a problem: not a client project, not a certified architecture, no measured outcome.
 * Every pattern carries an honest integration status from a fixed scale.
 */

export type ScenarioKey = keyof typeof SCENARIO_SLUGS;
export type PatternKey = keyof typeof PATTERN_SLUGS;

export const SCENARIO_CATEGORIES = ["ai", "documents_data", "commerce", "cloud", "delivery", "operations", "security"] as const;
export type ScenarioCategory = (typeof SCENARIO_CATEGORIES)[number];

/**
 * Integration status scale, from least to most real:
 * documented — a written pattern we apply in engagements; nothing in this product implements it.
 * demo — implemented inside this platform with internal or synthetic data only.
 * available_adapter — code in this product that talks to a third-party API when configured.
 * configured — an adapter configured against a named, verified system (none is claimed today).
 * future — designed or planned, not built.
 */
export const INTEGRATION_STATUSES = ["documented", "demo", "available_adapter", "configured", "future"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export interface ScenarioDefinition {
  key: ScenarioKey;
  category: ScenarioCategory;
  domains: DomainKey[];
  assessments: ToolKey[];
  patterns: PatternKey[];
}

export interface PatternDefinition {
  key: PatternKey;
  status: IntegrationStatus;
  domains: DomainKey[];
}

const s = (key: ScenarioKey, category: ScenarioCategory, domains: DomainKey[], assessments: ToolKey[], patterns: PatternKey[]): ScenarioDefinition => ({
  key,
  category,
  domains,
  assessments,
  patterns,
});

export const SCENARIOS: ScenarioDefinition[] = [
  s("ai_invoice_workflow", "ai", ["ai_agents_automation"], ["readiness", "finder", "roi"], ["human_approval", "rest_webhooks", "erp_crm_sync"]),
  s("multi_agent_service", "ai", ["ai_agents_automation"], ["team", "solution"], ["human_approval", "event_driven", "llm_provider"]),
  s("rag_policy_assistant", "ai", ["ai_applications", "data_integration"], ["data_integration", "ai_governance"], ["rag_ingestion", "identity_secrets", "llm_provider"]),
  s("ai_support_handoff", "ai", ["ai_applications", "ai_agents_automation"], ["solution", "ai_governance"], ["rag_ingestion", "human_approval", "rest_webhooks"]),
  s("document_intelligence", "documents_data", ["ai_applications", "data_integration"], ["data_integration", "readiness"], ["event_driven", "human_approval", "rag_ingestion"]),
  s("hybrid_integration", "documents_data", ["data_integration", "cloud_platform"], ["data_integration", "cloud_maturity"], ["event_driven", "rest_webhooks", "identity_secrets"]),
  s("data_pipeline", "documents_data", ["data_integration"], ["data_integration"], ["event_driven", "terraform_gitops", "opentelemetry"]),
  s("commerce_erp_sync", "commerce", ["commerce_engineering", "data_integration"], ["ecommerce_architecture", "data_integration"], ["erp_crm_sync", "event_driven", "rest_webhooks"]),
  s("catalog_enrichment", "commerce", ["commerce_engineering", "ai_applications"], ["ecommerce_architecture", "solution"], ["human_approval", "erp_crm_sync", "llm_provider"]),
  s("azure_landing_zone", "cloud", ["cloud_platform"], ["cloud_maturity", "finops"], ["landing_zone", "terraform_gitops", "identity_secrets"]),
  s("aws_landing_zone", "cloud", ["cloud_platform"], ["cloud_maturity", "finops"], ["landing_zone", "terraform_gitops", "identity_secrets"]),
  s("kubernetes_platform", "cloud", ["cloud_platform", "devops_sre"], ["cloud_maturity", "devops_maturity"], ["kubernetes_platform", "terraform_gitops", "opentelemetry"]),
  s("cloud_migration", "cloud", ["cloud_platform"], ["cloud_maturity", "finops"], ["landing_zone", "terraform_gitops", "opentelemetry"]),
  s("gitops_delivery", "delivery", ["devops_sre"], ["devops_maturity"], ["terraform_gitops", "kubernetes_platform", "identity_secrets"]),
  s("observability_otel", "operations", ["devops_sre"], ["observability"], ["opentelemetry", "kubernetes_platform"]),
  s("platform_reliability", "operations", ["devops_sre", "managed_operations"], ["observability", "devops_maturity"], ["opentelemetry", "human_approval"]),
  s("finops_ai_costs", "operations", ["cloud_platform", "managed_operations"], ["finops", "ai_ops_readiness"], ["opentelemetry", "llm_provider"]),
  s("ai_operations", "operations", ["managed_operations", "ai_governance"], ["ai_ops_readiness", "ai_governance"], ["human_approval", "opentelemetry", "llm_provider"]),
  s("identity_secrets", "security", ["cloud_platform", "ai_governance"], ["cloud_maturity", "ai_governance"], ["identity_secrets", "terraform_gitops"]),
  s("genai_gateway", "security", ["ai_governance", "ai_applications"], ["ai_governance", "ai_ops_readiness"], ["llm_provider", "identity_secrets", "opentelemetry"]),
];

/**
 * Statuses are stated against the code of this product (apps/api/app/integrations.py and the Ops
 * platform), never against an assumed client system. Nothing is "configured": no third-party system
 * is connected and verified.
 */
export const PATTERNS: PatternDefinition[] = [
  { key: "rest_webhooks", status: "documented", domains: ["data_integration", "ai_agents_automation"] },
  { key: "event_driven", status: "documented", domains: ["data_integration", "cloud_platform"] },
  // The CommercePlatform / CRMConnector protocols exist; no adapter implements them yet.
  { key: "erp_crm_sync", status: "future", domains: ["commerce_engineering", "data_integration"] },
  { key: "rag_ingestion", status: "documented", domains: ["ai_applications", "data_integration"] },
  // AI action approvals and the Ops change workflow implement it internally, with no client system.
  { key: "human_approval", status: "demo", domains: ["ai_agents_automation", "ai_governance"] },
  { key: "landing_zone", status: "documented", domains: ["cloud_platform"] },
  { key: "terraform_gitops", status: "documented", domains: ["devops_sre", "cloud_platform"] },
  { key: "kubernetes_platform", status: "documented", domains: ["cloud_platform", "devops_sre"] },
  // The ingestion contract is designed (docs/AI_OBSERVABILITY.md); no collector or gateway exists.
  { key: "opentelemetry", status: "future", domains: ["devops_sre", "managed_operations"] },
  { key: "identity_secrets", status: "documented", domains: ["cloud_platform", "ai_governance"] },
  // The AI advisor calls Anthropic through a provider adapter when a key is configured (mock otherwise).
  { key: "llm_provider", status: "available_adapter", domains: ["ai_applications", "ai_governance"] },
];

export const SCENARIO_KEYS = SCENARIOS.map((x) => x.key);
export const PATTERN_KEYS = PATTERNS.map((x) => x.key);

export const scenario = (key: ScenarioKey) => SCENARIOS.find((x) => x.key === key)!;
export const pattern = (key: PatternKey) => PATTERNS.find((x) => x.key === key)!;

export function scenarioBySlug(slug: string): ScenarioKey | null {
  return SCENARIO_KEYS.find((key) => SCENARIO_SLUGS[key].bg === slug) ?? null;
}

export function patternBySlug(slug: string): PatternKey | null {
  return PATTERN_KEYS.find((key) => PATTERN_SLUGS[key].bg === slug) ?? null;
}

/** Scenarios that use a pattern (the reverse links shown on pattern pages). */
export function scenariosUsing(key: PatternKey): ScenarioKey[] {
  return SCENARIOS.filter((x) => x.patterns.includes(key)).map((x) => x.key);
}

export function scenariosIn(category: ScenarioCategory): ScenarioKey[] {
  return SCENARIOS.filter((x) => x.category === category).map((x) => x.key);
}

/** Case-insensitive search over the localized title and summary (deterministic, in catalogue order). */
export function searchPatterns(query: string, text: (key: PatternKey) => string): PatternKey[] {
  const q = query.trim().toLocaleLowerCase();
  return PATTERN_KEYS.filter((key) => !q || text(key).toLocaleLowerCase().includes(q));
}

export { PATTERN_SLUGS, SCENARIO_SLUGS };
