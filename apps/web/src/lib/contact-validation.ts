/**
 * Client-side validation for the contact / quote form. Mirrors the server rules in
 * apps/api/app/schemas.py (LeadCreate, QuoteRequestCreate, AiManagedDetails) — the server remains the source of truth.
 */
export type InquiryKind = "contact" | "quote";

export interface ContactValues {
  inquiry_type: InquiryKind;
  service: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  privacy_acknowledged: boolean;
  marketing_consent: boolean;
  website: string;
  // quote requests only
  platform: string;
  budget_range: string;
  timeline: string;
  website_url: string;
  // AI Managed Services inquiries only (service === "ai_managed")
  ai_sector: string;
  ai_system_types: string[];
  ai_agents_count: string;
  ai_provider: string;
  ai_hosting: string;
  ai_support_interests: string[];
  ai_communication_language: string;
  ai_additional_notes: string;
}

export type ContactField = keyof ContactValues;
export type ContactErrors = Partial<Record<ContactField, string>>;

export interface ValidationMessages {
  required: string;
  minLength: string;
  maxLength: string;
  email: string;
  phone: string;
  service: string;
  privacy: string;
  noLinks: string;
  select: string;
  url: string;
  secrets: string;
  selectAtLeastOne: string;
}

export const LIMITS = {
  name: { min: 2, max: 120 },
  company: { min: 2, max: 160 },
  email: { max: 254 },
  phone: { max: 40 },
  message: { min: 20, max: 5000 },
  websiteUrl: { max: 300 },
  aiProvider: { max: 120 },
  aiNotes: { max: 2000 },
} as const;

export const QUOTE_OPTIONS = {
  platform: ["shopify", "woocommerce", "custom", "other", "none"],
  budget_range: ["undisclosed", "under_2500", "2500_10000", "10000_25000", "over_25000"],
  timeline: ["asap", "within_1_month", "within_3_months", "flexible"],
} as const;

/** Option keys for AI Managed Services inquiries (mirror the API enums). */
export const AI_MANAGED_SERVICE = "ai_managed";
export const AI_OPTIONS = {
  sector: [
    "ecommerce",
    "retail",
    "professional_services",
    "manufacturing",
    "logistics",
    "healthcare",
    "finance",
    "software_saas",
    "agency",
    "other",
  ],
  systemTypes: [
    "customer_support",
    "knowledge_assistant",
    "workflow_automation",
    "sales_assistant",
    "document_processing",
    "custom_llm_app",
    "other",
  ],
  agentsCount: ["1", "2_5", "6_20", "over_20", "unknown"],
  hosting: ["vendor_platform", "public_cloud", "private_server", "on_premise", "unknown", "other"],
  supportInterests: [
    "monitoring",
    "maintenance",
    "security",
    "cost_optimization",
    "quality_evaluation",
    "incident_support",
    "full_managed",
  ],
  communicationLanguages: ["bg", "en"],
} as const;

/**
 * Text that looks like a credential (API keys, tokens, private keys, "password: …"). Mirrors
 * `looks_like_secret` in apps/api/app/schemas.py; the form must never transport secrets.
 */
const SECRET_PATTERNS = [
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{16,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:password|passwd|парола|api[_ -]?key|secret|token|токен)\s*[:=]\s*\S{6,}/i,
];

export function looksLikeSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()\-./]{6,40}$/;
const LINK_RE = /https?:\/\/|www\.|<|>/i;
const SITE_RE = /^(https?:\/\/)?[^\s/?#]+\.[^\s/?#]{2,}([/?#]\S*)?$/i;

export const emptyContactValues = (service = "", inquiry_type: InquiryKind = "contact"): ContactValues => ({
  inquiry_type,
  service,
  name: "",
  company: "",
  email: "",
  phone: "",
  message: "",
  privacy_acknowledged: false,
  marketing_consent: false,
  website: "",
  platform: "",
  budget_range: "",
  timeline: "",
  website_url: "",
  ai_sector: "",
  ai_system_types: [],
  ai_agents_count: "",
  ai_provider: "",
  ai_hosting: "",
  ai_support_interests: [],
  ai_communication_language: "",
  ai_additional_notes: "",
});

function fill(template: string, n: number): string {
  return template.replace("{n}", String(n));
}

function textRule(value: string, min: number, max: number, m: ValidationMessages): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return m.required;
  if (trimmed.length < min) return fill(m.minLength, min);
  if (trimmed.length > max) return fill(m.maxLength, max);
  return undefined;
}

export function validateContact(
  values: ContactValues,
  m: ValidationMessages,
  allowedServices: readonly string[],
): ContactErrors {
  const errors: ContactErrors = {};

  if (!allowedServices.includes(values.service)) errors.service = m.service;

  for (const field of ["name", "company"] as const) {
    const error = textRule(values[field], LIMITS[field].min, LIMITS[field].max, m);
    if (error) errors[field] = error;
    else if (LINK_RE.test(values[field])) errors[field] = m.noLinks;
  }

  const email = values.email.trim();
  if (!email) errors.email = m.required;
  else if (email.length > LIMITS.email.max || !EMAIL_RE.test(email)) errors.email = m.email;

  const phone = values.phone.trim();
  if (phone && !PHONE_RE.test(phone)) errors.phone = m.phone;

  const messageError = textRule(values.message, LIMITS.message.min, LIMITS.message.max, m);
  if (messageError) errors.message = messageError;
  else if (looksLikeSecret(values.message)) errors.message = m.secrets;

  if (!values.privacy_acknowledged) errors.privacy_acknowledged = m.privacy;

  if (values.inquiry_type === "quote") {
    for (const field of ["platform", "budget_range", "timeline"] as const) {
      if (!(QUOTE_OPTIONS[field] as readonly string[]).includes(values[field])) errors[field] = m.select;
    }
    const site = values.website_url.trim();
    if (site && (site.length > LIMITS.websiteUrl.max || !SITE_RE.test(site))) errors.website_url = m.url;
  }

  if (values.service === AI_MANAGED_SERVICE) Object.assign(errors, validateAiManaged(values, m));

  return errors;
}

function validateAiManaged(values: ContactValues, m: ValidationMessages): ContactErrors {
  const errors: ContactErrors = {};
  if (!(AI_OPTIONS.sector as readonly string[]).includes(values.ai_sector)) errors.ai_sector = m.select;
  if (values.ai_system_types.length === 0 || values.ai_system_types.some((v) => !(AI_OPTIONS.systemTypes as readonly string[]).includes(v))) {
    errors.ai_system_types = m.selectAtLeastOne;
  }
  if (!(AI_OPTIONS.agentsCount as readonly string[]).includes(values.ai_agents_count)) errors.ai_agents_count = m.select;
  if (values.ai_hosting && !(AI_OPTIONS.hosting as readonly string[]).includes(values.ai_hosting)) errors.ai_hosting = m.select;
  if (
    values.ai_support_interests.length === 0 ||
    values.ai_support_interests.some((v) => !(AI_OPTIONS.supportInterests as readonly string[]).includes(v))
  ) {
    errors.ai_support_interests = m.selectAtLeastOne;
  }
  if (!(AI_OPTIONS.communicationLanguages as readonly string[]).includes(values.ai_communication_language)) {
    errors.ai_communication_language = m.select;
  }
  const provider = values.ai_provider.trim();
  if (provider.length > LIMITS.aiProvider.max) errors.ai_provider = fill(m.maxLength, LIMITS.aiProvider.max);
  else if (LINK_RE.test(provider)) errors.ai_provider = m.noLinks;
  else if (looksLikeSecret(provider)) errors.ai_provider = m.secrets;
  const notes = values.ai_additional_notes.trim();
  if (notes.length > LIMITS.aiNotes.max) errors.ai_additional_notes = fill(m.maxLength, LIMITS.aiNotes.max);
  else if (looksLikeSecret(notes)) errors.ai_additional_notes = m.secrets;
  return errors;
}

/** Toggle an option in a multi-select list. */
export function toggleOption(current: string[], option: string): string[] {
  return current.includes(option) ? current.filter((v) => v !== option) : [...current, option];
}

export function toPayload(values: ContactValues, formToken: string, locale = "bg") {
  const aiManaged =
    values.service === AI_MANAGED_SERVICE
      ? {
          ai_managed: {
            sector: values.ai_sector,
            system_types: values.ai_system_types,
            agents_count: values.ai_agents_count,
            ai_provider: values.ai_provider.trim(),
            hosting: values.ai_hosting || null,
            support_interests: values.ai_support_interests,
            communication_language: values.ai_communication_language,
            additional_notes: values.ai_additional_notes.trim(),
          },
        }
      : {};
  const base = {
    locale,
    ...aiManaged,
    service: values.service,
    name: values.name.trim(),
    company: values.company.trim(),
    email: values.email.trim(),
    phone: values.phone.trim() || null,
    message: values.message.trim(),
    privacy_acknowledged: values.privacy_acknowledged,
    marketing_consent: values.marketing_consent,
    website: values.website,
    form_token: formToken,
  };
  if (values.inquiry_type !== "quote") return base;
  // The quote endpoint accepts the structured project fields; the contact endpoint rejects them.
  return {
    ...base,
    platform: values.platform,
    budget_range: values.budget_range,
    timeline: values.timeline,
    website_url: values.website_url.trim() || null,
  };
}

export function submissionEndpoint(values: ContactValues): string {
  return values.inquiry_type === "quote" ? "/api/public/quote-requests" : "/api/public/leads";
}
