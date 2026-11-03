/** Types of the staff opportunity workflow API (apps/api/app/opportunities/schemas.py). */

export const SERVICE_DOMAINS = [
  "ai_strategy",
  "ai_agents_automation",
  "ai_applications",
  "commerce_engineering",
  "cloud_platform",
  "devops_sre",
  "data_integration",
  "ai_governance",
  "managed_operations",
  "advisory_enablement",
] as const;
export const DISCOVERY_STATUSES = ["not_started", "scheduled", "in_progress", "completed", "not_needed"] as const;
export const QUALIFICATION_STATUSES = ["unassessed", "qualified", "not_qualified", "on_hold"] as const;
export const ASSESSMENT_TOOLS = [
  "advisor",
  "readiness",
  "team",
  "roi",
  "finder",
  "solution",
  "agents",
  "cloud_maturity",
  "devops_maturity",
  "observability",
  "ecommerce_architecture",
  "data_integration",
  "ai_governance",
  "ai_ops_readiness",
  "finops",
] as const;
export const PROVIDED_IN = ["enquiry", "call", "email", "meeting"] as const;
export const PROPOSAL_KINDS = ["proposal", "sow"] as const;
export const PROPOSAL_STATUSES = ["draft", "in_review", "approved", "rejected", "withdrawn"] as const;
export const PROPOSAL_ACTIONS = ["submit", "approve", "reject", "reopen", "withdraw"] as const;
export const PROPOSAL_SECTIONS = [
  "scope",
  "deliverables",
  "assumptions",
  "exclusions",
  "dependencies",
  "responsibilities",
  "acceptance_criteria",
  "milestones",
  "risks",
  "commercial",
] as const;

export type ServiceDomain = (typeof SERVICE_DOMAINS)[number];
export type DiscoveryStatus = (typeof DISCOVERY_STATUSES)[number];
export type QualificationStatus = (typeof QUALIFICATION_STATUSES)[number];
export type ProposalKind = (typeof PROPOSAL_KINDS)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type ProposalAction = (typeof PROPOSAL_ACTIONS)[number];
export type ProposalSection = (typeof PROPOSAL_SECTIONS)[number];

export interface Stakeholder {
  name: string;
  role: string;
  provided_in: (typeof PROVIDED_IN)[number];
}

export interface LinkedRecord {
  kind: "advisor_assessment" | "assessment_result" | "team_configuration" | "readiness" | "solution" | "ai_managed";
  reference: string;
  detail: string | null;
  created_at: string | null;
}

export interface Opportunity {
  exists: boolean;
  lead_id: string;
  source: { source: string; inquiry_type: string; submitted_service: string; workshop_key: string | null; linked: LinkedRecord[] };
  service_domain: ServiceDomain | null;
  problem_summary: string | null;
  scope_summary: string | null;
  discovery_status: DiscoveryStatus;
  qualification_status: QualificationStatus;
  qualification_rationale: string | null;
  technical_constraints: string | null;
  stakeholders: Stakeholder[];
  next_action: string | null;
  next_action_due: string | null;
  notes: string | null;
  recommended_workshop: string | null;
  recommended_assessment: string | null;
  recommendation_rationale: string | null;
  revision: number;
  updated_at: string | null;
  updated_by: string | null;
}

export interface ProposalContent {
  scope: string;
  deliverables: string[];
  assumptions: string[];
  exclusions: string[];
  dependencies: string[];
  responsibilities: { party: "client" | "provider" | "shared"; item: string }[];
  acceptance_criteria: string[];
  milestones: { title: string; description: string; indicative_timing: string }[];
  risks: { risk: string; mitigation: string }[];
  commercial: { pricing_basis: string; payment_terms: string; validity: string; notes: string };
}

export interface Finding {
  code:
    | "commercial_placeholder"
    | "commercial_missing"
    | "unfilled_placeholder"
    | "guarantee_wording"
    | "signature_wording"
    | "price_outside_commercial"
    | "staffing_claim"
    | "empty_section";
  section: ProposalSection;
  blocking: boolean;
}

export interface VersionMeta {
  number: number;
  origin: "human" | "generated_draft";
  change_note: string | null;
  author: string | null;
  created_at: string;
  changed_sections: ProposalSection[];
}

export interface VersionDetail extends VersionMeta {
  content: ProposalContent;
  findings: Finding[];
}

export interface Proposal {
  id: string;
  lead_id: string;
  kind: ProposalKind;
  title: string;
  status: ProposalStatus;
  current_version: number;
  revision: number;
  created_by: string | null;
  decided_by: string | null;
  decision_note: string | null;
  approved_version: number | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  versions: VersionMeta[];
  latest: VersionDetail;
}

/** Which actions a status allows (mirrors app/opportunities/service.py TRANSITIONS). */
export const ALLOWED_ACTIONS: Record<ProposalStatus, ProposalAction[]> = {
  draft: ["submit", "withdraw"],
  in_review: ["approve", "reject", "reopen", "withdraw"],
  rejected: ["reopen", "withdraw"],
  approved: [],
  withdrawn: [],
};

/** Proposal sections as editable text: lists one item per line, structured rows separated by " | ". */
export function contentToText(content: ProposalContent): Record<ProposalSection, string> {
  return {
    scope: content.scope,
    deliverables: content.deliverables.join("\n"),
    assumptions: content.assumptions.join("\n"),
    exclusions: content.exclusions.join("\n"),
    dependencies: content.dependencies.join("\n"),
    responsibilities: content.responsibilities.map((r) => `${r.party} | ${r.item}`).join("\n"),
    acceptance_criteria: content.acceptance_criteria.join("\n"),
    milestones: content.milestones.map((m) => [m.title, m.description, m.indicative_timing].join(" | ")).join("\n"),
    risks: content.risks.map((r) => `${r.risk} | ${r.mitigation}`).join("\n"),
    commercial: "",
  };
}

const lines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
const cells = (line: string) => line.split("|").map((cell) => cell.trim());

export function textToContent(text: Record<ProposalSection, string>, commercial: ProposalContent["commercial"]): ProposalContent {
  const party = (value: string): "client" | "provider" | "shared" =>
    value === "client" || value === "provider" ? value : "shared";
  return {
    scope: text.scope.trim(),
    deliverables: lines(text.deliverables),
    assumptions: lines(text.assumptions),
    exclusions: lines(text.exclusions),
    dependencies: lines(text.dependencies),
    responsibilities: lines(text.responsibilities).map((line) => {
      const [first, ...rest] = cells(line);
      return rest.length ? { party: party(first), item: rest.join(" | ") } : { party: "shared", item: first };
    }),
    acceptance_criteria: lines(text.acceptance_criteria),
    milestones: lines(text.milestones).map((line) => {
      const [title, description = "", indicative_timing = ""] = cells(line);
      return { title, description, indicative_timing };
    }),
    risks: lines(text.risks).map((line) => {
      const [risk, mitigation = ""] = cells(line);
      return { risk, mitigation };
    }),
    commercial,
  };
}
