/**
 * Site-wide configuration. Only verified business facts belong here. The public company contact
 * details (phone, e-mail) live in lib/company.ts.
 */
export const site = {
  name: "A.I. Commerce Studio",
  /** Provisional brand name — shown in legal pages until the company is registered. */
  isProvisionalName: true,
  url: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
  areaServed: { bg: ["България", "Европейски съюз"], en: ["Bulgaria", "European Union"] },
  sessionCookieName: "acs_session",
  csrfCookieName: "acs_csrf",
} as const;

export function absoluteUrl(path: string): string {
  return `${site.url}${path.startsWith("/") ? path : `/${path}`}`;
}
