import { domainDefinition, type DomainBand, type DomainKey } from "@/lib/domains";
import type { PatternKey, ScenarioKey } from "@/lib/reference";
import type { ToolKey } from "@/lib/tools";
import { WORKSHOP_KEYS, WORKSHOP_SLUGS, type WorkshopKey } from "@/lib/workshop-slugs";

/**
 * Workshops & Advisory catalogue (docs/CONTENT_STRATEGY_BG_EN.md §5.5).
 *
 * Structure lives here (keys, format kind, links into the rest of the site); texts live in
 * content/{bg,en}/workshops.ts. Every offer is a consultant-led engagement scoped with the client:
 * no prices, no fixed durations promised, no guaranteed outcomes. The length shown is the indicative
 * band of SERVICE_TAXONOMY §2 and is agreed in writing before anything starts.
 */

/** workshop = facilitated session(s) with the client's team; assessment/review = a consultant-led review with a written report. */
export const WORKSHOP_KINDS = ["workshop", "assessment", "review"] as const;
export type WorkshopKind = (typeof WORKSHOP_KINDS)[number];

export interface WorkshopDefinition {
  key: WorkshopKey;
  kind: WorkshopKind;
  /** Domain hubs this offer belongs to; the first is the primary one (grouping and contact service). */
  domains: DomainKey[];
  /** Self-service assessments that prepare for it (unavailable tools are filtered at render time). */
  assessments: ToolKey[];
  scenarios: ScenarioKey[];
  patterns: PatternKey[];
}

const w = (
  key: WorkshopKey,
  kind: WorkshopKind,
  domains: DomainKey[],
  assessments: ToolKey[],
  scenarios: ScenarioKey[],
  patterns: PatternKey[],
): WorkshopDefinition => ({ key, kind, domains, assessments, scenarios, patterns });

export const WORKSHOPS: WorkshopDefinition[] = [
  w("ai_strategy_discovery", "workshop", ["ai_strategy", "advisory_enablement"], ["advisor", "readiness", "finder"], ["ai_invoice_workflow", "ai_support_handoff"], ["human_approval"]),
  w("ai_readiness_mapping", "assessment", ["ai_strategy", "ai_agents_automation"], ["readiness", "finder", "roi"], ["ai_invoice_workflow", "document_intelligence"], ["human_approval", "rest_webhooks"]),
  w("agent_architecture", "workshop", ["ai_agents_automation", "ai_governance"], ["solution", "agents", "team"], ["multi_agent_service", "ai_support_handoff"], ["human_approval", "llm_provider", "event_driven"]),
  w("landing_zone_assessment", "assessment", ["cloud_platform"], ["cloud_maturity", "finops"], ["azure_landing_zone", "aws_landing_zone", "identity_secrets"], ["landing_zone", "identity_secrets", "terraform_gitops"]),
  w("kubernetes_review", "review", ["cloud_platform", "devops_sre"], ["cloud_maturity", "devops_maturity"], ["kubernetes_platform", "platform_reliability"], ["kubernetes_platform", "terraform_gitops", "opentelemetry"]),
  w("devops_gitops_assessment", "assessment", ["devops_sre"], ["devops_maturity"], ["gitops_delivery"], ["terraform_gitops", "identity_secrets"]),
  w("observability_sre", "workshop", ["devops_sre", "managed_operations"], ["observability", "ai_ops_readiness"], ["observability_otel", "platform_reliability", "ai_operations"], ["opentelemetry", "human_approval"]),
  w("ecommerce_integration_discovery", "workshop", ["commerce_engineering", "data_integration"], ["ecommerce_architecture", "data_integration"], ["commerce_erp_sync", "catalog_enrichment"], ["erp_crm_sync", "rest_webhooks", "event_driven"]),
  w("rag_data_readiness", "workshop", ["ai_applications", "data_integration"], ["data_integration", "solution"], ["rag_policy_assistant", "document_intelligence"], ["rag_ingestion", "identity_secrets"]),
  w("responsible_ai_review", "review", ["ai_governance", "ai_strategy"], ["ai_governance", "ai_ops_readiness"], ["genai_gateway", "ai_operations"], ["human_approval", "llm_provider"]),
];

export const workshop = (key: WorkshopKey) => WORKSHOPS.find((x) => x.key === key)!;

export function workshopBySlug(slug: string): WorkshopKey | null {
  return WORKSHOP_KEYS.find((key) => WORKSHOP_SLUGS[key].bg === slug) ?? null;
}

export function isWorkshopKey(value: string | null | undefined): value is WorkshopKey {
  return typeof value === "string" && (WORKSHOP_KEYS as string[]).includes(value);
}

/** The band of an offer's primary domain (index grouping). */
export const workshopBand = (key: WorkshopKey): DomainBand => domainDefinition(workshop(key).domains[0]).band;

/** Service key the enquiry form pre-selects (the primary domain's contact service). */
export const workshopContactService = (key: WorkshopKey) => domainDefinition(workshop(key).domains[0]).contactService;

/** Offers that touch any of the given domains, in catalogue order. */
export function workshopsForDomains(domains: readonly DomainKey[]): WorkshopKey[] {
  return WORKSHOPS.filter((x) => x.domains.some((d) => domains.includes(d))).map((x) => x.key);
}

/** Offers a self-service assessment prepares for (shown with its result). */
export function workshopsForAssessment(tool: ToolKey): WorkshopKey[] {
  return WORKSHOPS.filter((x) => x.assessments.includes(tool)).map((x) => x.key);
}

export function workshopsForScenario(key: ScenarioKey): WorkshopKey[] {
  return WORKSHOPS.filter((x) => x.scenarios.includes(key)).map((x) => x.key);
}

export { WORKSHOP_KEYS, WORKSHOP_SLUGS };
export type { WorkshopKey };
