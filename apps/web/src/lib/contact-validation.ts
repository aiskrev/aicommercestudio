/**
 * Client-side validation for the contact form. Mirrors the server rules in
 * apps/api/app/schemas.py (LeadCreate) — the server remains the source of truth.
 */
export interface ContactValues {
  service: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  privacy_acknowledged: boolean;
  marketing_consent: boolean;
  website: string;
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
}

export const LIMITS = {
  name: { min: 2, max: 120 },
  company: { min: 2, max: 160 },
  email: { max: 254 },
  phone: { max: 40 },
  message: { min: 20, max: 5000 },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9 ()\-./]{6,40}$/;
const LINK_RE = /https?:\/\/|www\.|<|>/i;

export const emptyContactValues = (service = ""): ContactValues => ({
  service,
  name: "",
  company: "",
  email: "",
  phone: "",
  message: "",
  privacy_acknowledged: false,
  marketing_consent: false,
  website: "",
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

  return errors;
}

export function toPayload(values: ContactValues, formToken: string) {
  return {
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
}
