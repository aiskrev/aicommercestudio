/** Canonical (locale-independent) route paths. Use `localizePath` to render them for a locale. */
export const routes = {
  home: "/",
  services: "/uslugi",
  /** V5 hubs: website development and e-commerce (docs/V5_FINAL_IMPLEMENTATION_REPORT.md). */
  websites: "/izrabotka-na-saytove",
  ecommerce: "/online-magazini",
  service: (slug: string) => `/uslugi/${slug}`,
  aiSolutions: "/ai-resheniya",
  advisor: "/ai-automation-advisor",
  tools: "/instrumenti",
  tool: (slug: string) => `/instrumenti/${slug}`,
  agentLibrary: "/ai-agenti",
  agent: (slug: string) => `/ai-agenti/${slug}`,
  scenarios: "/referentni-stsenarii",
  scenario: (slug: string) => `/referentni-stsenarii/${slug}`,
  patterns: "/integratsionni-modeli",
  pattern: (slug: string) => `/integratsionni-modeli/${slug}`,
  workshops: "/rabotni-sreshti",
  carePlans: "/paketi",
  projectPackages: "/proektni-paketi",
  pricing: "/tseni",
  configurator: "/konfigurator",
  quoteBasket: "/zayavka",
  quotation: "/oferta",
  demoCentre: "/demo-tsentar",
  demoScenario: (slug: string) => `/demo-tsentar/${slug}`,
  workshop: (slug: string) => `/rabotni-sreshti/${slug}`,
  industries: "/za-kogo",
  about: "/za-nas",
  founder: "/za-nas/osnovatel",
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
  subscriptionTerms: "/usloviya-za-abonament",
  withdrawalInfo: "/otkaz-i-vazstanovyavane",
  marketingOptOut: "/otkaz-ot-marketing",
  account: "/konto",
  accountRegister: "/konto/registratsiya",
  accountSignIn: "/konto/vhod",
  accountVerify: "/konto/potvardi",
  accountResend: "/konto/nov-link",
  accountForgot: "/konto/zabravena-parola",
  accountReset: "/konto/nova-parola",
  accountAdvisor: "/konto/advisor",
  accountPlan: "/konto/plan",
  accountSubscriptions: "/konto/abonamenti",
  accountInvoices: "/konto/fakturi",
  accountSupport: "/konto/zapitvaniya",
  accountOrganisation: "/konto/organizatsiya",
  accountSecurity: "/konto/sigurnost",
  accountDelivery: "/konto/izrabotka",
  accountAdvisorDemo: "/konto/advisor/demo",
  accountAdvisorPayment: "/konto/advisor/payment",
  adminLogin: "/admin/login",
  admin: "/admin",
  adminLeads: "/admin/leads",
  adminLead: (id: string) => `/admin/leads/${id}`,
  adminActivity: "/admin/activity",
  adminAnalytics: "/admin/analytics",
  adminCompliance: "/admin/compliance",
  adminAiActions: "/admin/ai",
  adminAccount: "/admin/account",
  adminOperations: "/admin/operations",
  adminCatalogue: "/admin/catalogue",
  adminCatalogueNew: "/admin/catalogue/new",
  adminCatalogueEntry: (id: string) => `/admin/catalogue/${id}`,
  adminStaff: "/admin/staff",
  adminProjects: "/admin/projects",
  adminCrm: "/admin/crm",
} as const;

export function contactWithService(serviceKey: string): string {
  return `${routes.contact}?usluga=${encodeURIComponent(serviceKey)}`;
}

/** Contact page opened as an enquiry about one workshop or assessment (lib/workshops.ts). */
export function contactAboutWorkshop(serviceKey: string, workshopKey: string): string {
  return `${contactWithService(serviceKey)}&sreshta=${encodeURIComponent(workshopKey)}`;
}

/** Contact page opened as a quote request for the given service. */
export function quoteWithService(serviceKey: string): string {
  return `${contactWithService(serviceKey)}&tip=oferta`;
}
