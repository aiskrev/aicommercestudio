/** Canonical (locale-independent) route paths. Use `localizePath` to render them for a locale. */
export const routes = {
  home: "/",
  services: "/uslugi",
  service: (slug: string) => `/uslugi/${slug}`,
  aiSolutions: "/ai-resheniya",
  industries: "/za-kogo",
  about: "/za-nas",
  process: "/proces",
  contact: "/kontakti",
  insights: "/statii",
  article: (slug: string) => `/statii/${slug}`,
  privacy: "/poveritelnost",
  cookies: "/biskvitki",
  terms: "/obshti-usloviya",
  adminLogin: "/admin/login",
  admin: "/admin",
  adminLeads: "/admin/leads",
  adminLead: (id: string) => `/admin/leads/${id}`,
  adminActivity: "/admin/activity",
  adminAiActions: "/admin/ai",
  adminAccount: "/admin/account",
} as const;

export function contactWithService(serviceKey: string): string {
  return `${routes.contact}?usluga=${encodeURIComponent(serviceKey)}`;
}

/** Contact page opened as a quote request for the given service. */
export function quoteWithService(serviceKey: string): string {
  return `${contactWithService(serviceKey)}&tip=oferta`;
}
