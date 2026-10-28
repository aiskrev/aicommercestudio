/** Canonical (locale-independent) route paths. Use `localizePath` to render them for a locale. */
export const routes = {
  home: "/",
  services: "/uslugi",
  service: (slug: string) => `/uslugi/${slug}`,
  aiSolutions: "/ai-resheniya",
  advisor: "/ai-automation-advisor",
  tools: "/instrumenti",
  tool: (slug: string) => `/instrumenti/${slug}`,
  agentLibrary: "/ai-agenti",
  agent: (slug: string) => `/ai-agenti/${slug}`,
  industries: "/za-kogo",
  about: "/za-nas",
  process: "/proces",
  contact: "/kontakti",
  insights: "/statii",
  article: (slug: string) => `/statii/${slug}`,
  insightsCategory: (slug: string) => `/statii/tema/${slug}`,
  caseStudies: "/proekti",
  caseStudy: (slug: string) => `/proekti/${slug}`,
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
  adminOperations: "/admin/operations",
  adminCatalogue: "/admin/catalogue",
  adminCatalogueNew: "/admin/catalogue/new",
  adminCatalogueEntry: (id: string) => `/admin/catalogue/${id}`,
  adminStaff: "/admin/staff",
} as const;

export function contactWithService(serviceKey: string): string {
  return `${routes.contact}?usluga=${encodeURIComponent(serviceKey)}`;
}

/** Contact page opened as a quote request for the given service. */
export function quoteWithService(serviceKey: string): string {
  return `${contactWithService(serviceKey)}&tip=oferta`;
}
