/** Response shapes of the AI operations platform API (app/routers/ops_platform.py, app/routers/portal.py). */

export type OpsModule = "registry" | "evaluations" | "observability" | "incidents" | "changes";
export type VersionStatus = "draft" | "in_review" | "approved" | "retired";

export interface VersionSummary {
  id: string;
  agent_id: string;
  number: number;
  status: VersionStatus;
  environment: string;
  provider: string | null;
  model: string | null;
  sensitive: boolean;
  change_reason: string;
  based_on_id: string | null;
  rollback_of_id: string | null;
  created_by: string | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  evaluation_run_id: string | null;
  retired_at: string | null;
}

export interface ToolDeclaration {
  name: string;
  kind: "retrieval" | "action" | "function";
  integration: string | null;
  access: "read" | "write";
  requires_approval: boolean;
  description: string | null;
}

export interface VersionDetail extends VersionSummary {
  prompt_template: string;
  parameters: Record<string, unknown>;
  tools: ToolDeclaration[];
  content_hash: string;
  integrity_ok: boolean;
  evidence_simulated: boolean | null;
}

export interface VersionDiff {
  from_version: number;
  to_version: number;
  changes: { field: string; before: unknown; after: unknown }[];
  prompt_diff: string[];
}

export interface Dataset {
  id: string;
  agent_id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  status: "draft" | "locked";
  created_at: string;
  locked_at: string | null;
  case_count: number;
}

export interface EvalResult {
  id: string;
  case_id: string;
  case_key: string;
  output_text: string;
  passed: boolean;
  assertion_results: { type: string; value: string; passed: boolean }[];
  manual_label: "pass" | "fail" | "needs_review" | null;
  labeled_at: string | null;
}

export interface EvalRun {
  id: string;
  dataset_id: string;
  agent_version_id: string;
  runner: string;
  simulated: boolean;
  total: number;
  passed: number;
  failed: number;
  started_at: string;
  finished_at: string;
  note: string;
}

export interface EvalRunDetail extends EvalRun {
  results: EvalResult[];
}

export interface Comparison {
  base_run_id: string;
  candidate_run_id: string;
  simulated: boolean;
  base_pass_rate: number;
  candidate_pass_rate: number;
  regressions: string[];
  fixes: string[];
  unchanged_pass: string[];
  unchanged_fail: string[];
  has_regressions: boolean;
}

export interface Freshness {
  live: false;
  sources: Record<string, number>;
  latest_record_at: string | null;
  note: string;
}

export interface UsageGroup {
  key: string;
  label: string;
  runs: number;
  succeeded: number;
  failed: number;
  error_rate_percent: number;
  avg_duration_ms: number;
  error_categories: Record<string, number>;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: Record<string, string>;
  missing_rate_runs: number;
}

export interface UsageSummary {
  period_days: number;
  period_start: string;
  group_by: "agent" | "workspace";
  groups: UsageGroup[];
  totals: UsageGroup;
  freshness: Freshness;
}

export interface BudgetStatus {
  budget: { id: string; name: string; agent_id: string | null; amount: string; currency: string; warn_percent: number };
  month_to_date: string | null;
  percent_used: number | null;
  state: "ok" | "warning" | "exceeded" | "no_cost_data";
  missing_rate_runs: number;
}

export interface RuleStatus {
  rule: { id: string; name: string; metric: string; threshold: string; window_days: number; enabled: boolean };
  value: string | null;
  breached: boolean | null;
}

export interface ObservabilityEvaluation {
  budgets: BudgetStatus[];
  rules: RuleStatus[];
  freshness: Freshness;
  note: string;
}

export interface RateCard {
  id: string;
  provider: string;
  model: string;
  version: string;
  currency: string;
  input_per_million: string;
  output_per_million: string;
  effective_from: string;
  source_note: string;
}

export interface TimelineEvent {
  id: string;
  kind: "created" | "status" | "note" | "evidence" | "assignment";
  from_status: string | null;
  to_status: string | null;
  body: string | null;
  actor_user_id: string | null;
  actor_label: string;
  created_at: string;
}

export interface Incident {
  id: string;
  number: number;
  agent_id: string | null;
  title: string;
  severity: "sev1" | "sev2" | "sev3" | "sev4";
  impact: "customer_facing" | "internal" | "cost" | "security" | "data_quality";
  status: "detected" | "triaged" | "investigating" | "mitigated" | "resolved" | "reviewed";
  client_summary: string | null;
  owner_user_id: string | null;
  detected_at: string;
  resolved_at: string | null;
  reviewed_at: string | null;
  lock_version: number;
  updated_at: string;
  allowed_transitions: string[];
}

export interface IncidentDetail extends Incident {
  events: TimelineEvent[];
}

export interface Change {
  id: string;
  number: number;
  agent_id: string;
  agent_version_id: string;
  title: string;
  risk: "low" | "medium" | "high";
  status: "draft" | "risk_review" | "evaluation" | "human_approval" | "approved" | "rejected" | "released" | "reviewed";
  risk_notes: string | null;
  release_note: string | null;
  evaluation_run_id: string | null;
  rollback_version_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  released_at: string | null;
  lock_version: number;
  created_by: string | null;
  updated_at: string;
  allowed_transitions: string[];
}

export interface ChangeDetail extends Change {
  events: TimelineEvent[];
  evidence_simulated: boolean | null;
}

export interface PortalUser {
  id: string;
  email: string;
  full_name: string;
  status: "invited" | "active" | "disabled";
  mfa_enabled: boolean;
  created_at: string;
  activated_at: string | null;
  last_login_at: string | null;
}
