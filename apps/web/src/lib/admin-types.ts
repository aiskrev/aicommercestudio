/** Types mirroring the FastAPI response models (apps/api/app/schemas.py). */

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON", "LOST"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

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
  created_at: string;
  updated_at: string;
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
  notes: LeadNote[];
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
