/**
 * Client-side validation for the contact / quote form. Mirrors the server rules in
 * apps/api/app/schemas.py (LeadCreate, QuoteRequestCreate) — the server remains the source of truth.
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
}

export const LIMITS = {
  name: { min: 2, max: 120 },
  company: { min: 2, max: 160 },
  email: { max: 254 },
  phone: { max: 40 },
  message: { min: 20, max: 5000 },
  websiteUrl: { max: 300 },
} as const;

export const QUOTE_OPTIONS = {
  platform: ["shopify", "woocommerce", "custom", "other", "none"],
  budget_range: ["undisclosed", "under_2500", "2500_10000", "10000_25000", "over_25000"],
  timeline: ["asap", "within_1_month", "within_3_months", "flexible"],
} as const;

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

  if (!values.privacy_acknowledged) errors.privacy_acknowledged = m.privacy;

  if (values.inquiry_type === "quote") {
    for (const field of ["platform", "budget_range", "timeline"] as const) {
      if (!(QUOTE_OPTIONS[field] as readonly string[]).includes(values[field])) errors[field] = m.select;
    }
    const site = values.website_url.trim();
    if (site && (site.length > LIMITS.websiteUrl.max || !SITE_RE.test(site))) errors.website_url = m.url;
  }

  return errors;
}

export function toPayload(values: ContactValues, formToken: string) {
  const base = {
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
