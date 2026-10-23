import type { AutomationAssessment } from "@/lib/advisor";

/** Types mirroring the FastAPI response models (apps/api/app/schemas.py). */

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type InquiryType = "contact" | "quote";
export type LeadLocale = "bg" | "en";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  last_login_at: string | null;
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
  status_changed_at: string | null;
  submitted_service: string;
  platform: string | null;
  budget_range: string | null;
  timeline: string | null;
  website_url: string | null;
  notes: LeadNote[];
  advisor_assessment?: LinkedAssessment | null;
  ai_managed?: AiManagedDetails | null;
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
