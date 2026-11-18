/**
 * RFC 9116 vulnerability-disclosure file (audit N-01). Nothing is published until the owner has approved a monitored
 * contact: both values come from the deployment (SECURITY_CONTACT, SECURITY_TXT_EXPIRES), never from a default and
 * never from the public contact details in lib/company.ts. Without them, or with an invalid or expired value, the
 * route answers 404 so an unmonitored or stale address is never advertised.
 */

const MAX_VALIDITY_DAYS = 366;

/** A `mailto:` or `https:` URI with no whitespace or control characters (RFC 9116 section 2.5.3). */
export function validContact(value: string | undefined): string | null {
  const contact = (value ?? "").trim();
  if (!contact || /[\s\u0000-\u001f<>"]/.test(contact)) return null;
  if (/^mailto:[^@\s]+@[^@\s]+\.[^@\s]+$/i.test(contact)) return contact;
  try {
    const url = new URL(contact);
    return url.protocol === "https:" ? contact : null;
  } catch {
    return null;
  }
}

/** An ISO 8601 date-time in the future and no more than a year ahead; returned in the canonical `Z` form. */
export function validExpires(value: string | undefined, now: Date): string | null {
  const text = (value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/.test(text)) return null;
  const date = new Date(text.length === 10 ? `${text}T00:00:00Z` : text);
  if (Number.isNaN(date.getTime()) || date.getTime() <= now.getTime()) return null;
  if (date.getTime() - now.getTime() > MAX_VALIDITY_DAYS * 86_400_000) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function securityTxt(
  env: { contact?: string; expires?: string; canonical?: string },
  now: Date = new Date(),
): string | null {
  const contact = validContact(env.contact);
  const expires = validExpires(env.expires, now);
  if (!contact || !expires) return null;
  const lines = [`Contact: ${contact}`, `Expires: ${expires}`, "Preferred-Languages: bg, en"];
  if (env.canonical?.startsWith("https://")) lines.push(`Canonical: ${env.canonical}`);
  return `${lines.join("\n")}\n`;
}
