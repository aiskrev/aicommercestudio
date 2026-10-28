import type { AutomationAssessment } from "@/lib/advisor";

/** Types mirroring the FastAPI response models (apps/api/app/schemas.py). */

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type InquiryType = "contact" | "quote";
export type LeadLocale = "bg" | "en";

export type StaffRole = "admin" | "editor" | "viewer";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  last_login_at: string | null;
  role: StaffRole;
}

export interface AdminSession {
  user: AdminUser;
  expires_at: string;
}

export interface LeadSummary {
  id: string;
  reference: string;
  service: string;
  name: string;
  company: string;
  email: string;
  status: LeadStatus;
  source: string;
  inquiry_type: InquiryType;
  /** Website language the inquiry was sent from. */
  locale: LeadLocale;
  created_at: string;
  updated_at: string;
}

/** Descriptive AI-system information from an AI Managed Services inquiry (never credentials). */
export interface AiManagedDetails {
  sector: string;
  system_types: string[];
  agents_count: string;
  ai_provider: string;
  hosting: string | null;
  support_interests: string[];
  communication_language: LeadLocale;
  additional_notes: string;
}

export interface LeadNote {
  id: string;
  body: string;
  created_at: string;
  author_name: string | null;
}

export interface LeadDetail extends LeadSummary {
  phone: string | null;
  message: string;
  privacy_acknowledged_at: string;
  privacy_notice_version: string;
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  /** Wording version of the marketing consent; null when not given (or for older inquiries). */
  marketing_consent_version?: string | null;
  status_changed_at: string | null;
  submitted_service: string;
  platform: string | null;
  budget_range: string | null;
  timeline: string | null;
  website_url: string | null;
  notes: LeadNote[];
  advisor_assessment?: LinkedAssessment | null;
  ai_managed?: AiManagedDetails | null;
  /** AI readiness assessment submission (source readiness_assessment). */
  readiness?: ReadinessDetails | null;
  /** AI team configurator consultation (source team_configurator). */
  team?: TeamDetails | null;
}

export interface TeamDetails {
  reference: string | null;
  model_version: string;
  assumptions_version: string;
  role: string;
  agents: string[];
  complexity: "low" | "medium" | "high";
  deployment: string | null;
  operations: string | null;
  currency: string;
  one_time_range: [number, number];
  monthly_range: [number, number];
  expected_one_time: number;
  expected_monthly: number;
}

export type ReadinessBandKey = "exploration" | "foundation" | "pilot_ready" | "scaling";

export interface ReadinessDetails {
  model_version: string;
  role: string;
  consultation_requested: boolean;
  overall: number;
  band: ReadinessBandKey;
  dimensions: Record<string, number>;
  blockers: string[];
  actions: string[];
}

export interface LeadPage {
  items: LeadSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditEntry {
  id: number;
  created_at: string;
  actor_label: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
}

export interface DashboardStats {
  total_leads: number;
  new_leads: number;
  leads_last_7_days: number;
  leads_last_30_days: number;
  open_pipeline: number;
  won: number;
  lost: number;
  by_status: Record<LeadStatus, number>;
  by_service: Record<string, number>;
  by_inquiry_type: Record<InquiryType, number>;
  by_locale?: Partial<Record<LeadLocale, number>>;
  pending_ai_actions: number;
  recent_activity: AuditEntry[];
}

export interface SystemStatus {
  environment: string;
  ai_provider: string;
  email_enabled: boolean;
  lead_retention_days: number;
  integrations: { key: string; label: string; configured: boolean; note: string }[];
}

export interface LeadTriage {
  provider: string;
  model: string;
  suggested_service: string;
  priority: "low" | "medium" | "high";
  summary: string;
  suggested_next_step: string;
  signals: string[];
  disclaimer: string;
}

export interface AIAction {
  id: string;
  action_type: string;
  risk_level: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED";
  summary: string;
  payload: Record<string, unknown>;
  requested_by: string;
  created_at: string;
  decided_at: string | null;
  decision_comment: string | null;
  decided_by_name: string | null;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface RetentionPreview {
  lead_retention_days: number;
  audit_retention_days: number;
  leads_due: number;
  audit_entries_due: number;
  lead_cutoff: string;
  audit_cutoff: string;
  advisor_retention_days?: number;
  advisor_assessments_due?: number;
  team_configuration_retention_days?: number;
  team_configurations_due?: number;
}

export interface AdminSessionInfo {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  user_agent: string | null;
  current: boolean;
}

/** AI advisor assessment attached to a lead (when the visitor requested a consultation from it). */
export interface LinkedAssessment {
  id: string;
  reference: string;
  mode: "demo" | "ai" | string;
  created_at: string;
  business_type: string;
  monthly_volume: string;
  team_size: string;
  tools: string[];
  assessment: AutomationAssessment;
}

// ----------------------------------------------------------------------------- AI operations (scaffold)

export type OpsRole = "owner" | "admin" | "operator" | "reviewer" | "viewer";
export type OpsAgentStatus = "planned" | "active" | "paused" | "retired";
export type OpsEnvironment = "production" | "staging" | "development";

export interface OpsOrganization {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended";
  data_region: string;
  is_demo: boolean;
  role: OpsRole;
}

export interface OpsOverview {
  organization: Omit<OpsOrganization, "role">;
  role: OpsRole;
  permissions: string[];
  workspaces: number;
  agents_by_status: Partial<Record<OpsAgentStatus, number>>;
  telemetry: { connected: boolean; note: string };
}

export interface OpsWorkspace {
  id: string;
  slug: string;
  name: string;
  environment: OpsEnvironment;
  created_at: string;
}

export interface OpsAgent {
  id: string;
  workspace_id: string;
  key: string;
  name: string;
  status: OpsAgentStatus;
  provider: string | null;
  model: string | null;
  version: string | null;
  purpose: string | null;
  created_at: string;
  updated_at: string;
}

export interface OpsMember {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: OpsRole;
  created_at: string;
}

// --------------------------------------------------------------------------- service catalogue

export type CatalogueStatus = "draft" | "published" | "archived";
export type OfferingType = "service" | "assessment" | "workshop";
export type DeliveryStatus = "available" | "custom" | "planned";
export type CataloguePermission = "edit" | "publish" | "archive" | "restore" | "delete";
export type CatalogueLocale = "bg" | "en";

export interface CatalogueEntitySummary {
  id: string;
  type: "domain" | "service";
  key: string;
  status: CatalogueStatus;
  offering_type: OfferingType | null;
  domain: string | null;
  name_bg: string;
  name_en: string;
  revision: number;
  published_revision: number | null;
  has_unpublished_changes: boolean;
  updated_at: string;
  published_at: string | null;
}

export interface CatalogueEntityPage {
  items: CatalogueEntitySummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface CatalogueTranslation {
  slug: string | null;
  name: string;
  short_name: string | null;
  summary: string | null;
  body: string | null;
  cta_label: string | null;
  seo_title: string | null;
  seo_description: string | null;
}

export interface CatalogueItemText {
  title: string | null;
  body: string | null;
}

export type CatalogueItem = Record<CatalogueLocale, CatalogueItemText>;

export interface CatalogueServiceFields {
  offering_type: OfferingType;
  primary_domain: string | null;
  delivery_status: DeliveryStatus;
  lead_category: string | null;
  position: number;
  duration_min_days: number | null;
  duration_max_days: number | null;
  custom_page: boolean;
  is_entry_offer: boolean;
}

export interface CatalogueFamilyText {
  name: string;
  summary: string | null;
  prerequisite: string | null;
}

export interface CatalogueFamily {
  /** Local key: the part after "<domain>.". */
  key: string;
  delivery_status: DeliveryStatus;
  services: string[];
  via: string[];
  bg: CatalogueFamilyText;
  en: CatalogueFamilyText;
}

export interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  is_active: boolean;
  last_login_at: string | null;
  is_self: boolean;
}

export interface CatalogueDomainFields {
  code: string;
  band: "ai" | "engineering" | "operations";
  icon: string;
  contact_service: string | null;
  families: CatalogueFamily[];
}

export interface CatalogueEntity {
  id: string;
  type: "domain" | "service";
  key: string;
  status: CatalogueStatus;
  revision: number;
  published_revision: number | null;
  has_unpublished_changes: boolean;
  first_published_at: string | null;
  published_at: string | null;
  archived_at: string | null;
  updated_at: string;
  translations: Record<CatalogueLocale, CatalogueTranslation>;
  capabilities: CatalogueItem[];
  deliverables: CatalogueItem[];
  related: string[];
  service: CatalogueServiceFields | null;
  domain: CatalogueDomainFields | null;
  permissions: CataloguePermission[];
}

export interface CatalogueOptions {
  role: StaffRole;
  domains: { key: string; code: string; name_bg: string; name_en: string }[];
  services: { key: string; offering_type: OfferingType; status: CatalogueStatus; name_bg: string; name_en: string }[];
  free_lead_categories: string[];
}

export interface CatalogueFieldProblem {
  field: string;
  message: string;
  type: string;
}

export interface CatalogueChecks {
  publishable: boolean;
  errors: CatalogueFieldProblem[];
}

export interface CatalogueHistoryEntry {
  action: string;
  actor_label: string;
  created_at: string;
  details: Record<string, unknown>;
}

/** Public detail shape returned by the preview endpoint (subset used by the preview panel). */
export interface CataloguePreview {
  locale: CatalogueLocale;
  key: string;
  name: string;
  slug: string;
  summary: string;
  body: string;
  seo: { title: string; description: string };
  deliverables: string[];
  capabilities?: { title: string; description: string }[];
  related?: { services: { key: string; name: string }[]; assessments: { key: string; name: string }[]; workshops: { key: string; name: string }[] };
  related_domains?: { key: string; name: string }[];
}
