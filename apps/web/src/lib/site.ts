/**
 * Site-wide configuration. Only verified business facts belong here — values that are not
 * yet confirmed stay `null` and the UI renders an honest placeholder instead.
 */
export const site = {
  name: "A.I. Commerce Studio",
  /** Provisional brand name — shown in legal pages until the company is registered. */
  isProvisionalName: true,
  url: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  contactEmail: process.env.PUBLIC_CONTACT_EMAIL || null,
  contactPhone: process.env.PUBLIC_CONTACT_PHONE || null,
  areaServed: ["България", "Европейски съюз"],
  sessionCookieName: "acs_session",
  csrfCookieName: "acs_csrf",
} as const;

export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
