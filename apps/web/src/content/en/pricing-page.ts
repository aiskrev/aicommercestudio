import type { pricingPage as bgPricingPage } from "@/content/bg/pricing-page";

export const pricingPage: typeof bgPricingPage = {
  metaTitle: "Pricing: websites, online stores, AI solutions and care",
  metaDescription:
    "Indicative prices of the services in one place: one-time projects, monthly services, AI Managed Services, care plans and workshops. The exact price is set in a written quote.",
  navLabel: "Pricing",
  eyebrow: "Pricing",
  title: "Indicative prices of the services",
  lead: "Every published price in one place. They show where a service starts and the range it usually falls in. You get the exact price in a written quote once the scope is clear.",
  columns: { offer: "Service", from: "Starting price", typical: "Typical range" },
  groups: {
    projects: { title: "One-time projects", lead: "Price per project, charged once.", cta: "Compare the project packages" },
    monthly: { title: "Monthly services", lead: "A recurring service. Price per month.", cta: "See all services" },
    aiManaged: { title: "AI Managed Services", lead: "Three levels. Price per month and per system, without third-party costs.", cta: "Go to AI Managed Services" },
    carePlans: { title: "Care plans", lead: "Price per month and per system.", cta: "Compare the care plans" },
    workshops: { title: "Workshops and assessments", lead: "Price for one workshop or assessment.", cta: "See all workshops" },
  },
  excluded: {
    title: "What the prices do not include",
    items: [
      "Hosting and the domain",
      "Licences for platforms, themes and apps",
      "AI model usage and other services billed by consumption",
      "Payment provider and courier fees",
      "Integrations outside the described scope: they are assessed and priced separately",
    ],
    note: "These costs are paid to the respective provider or are listed separately in the quote.",
  },
  how: {
    title: "How the exact price is set",
    steps: [
      { title: "Enquiry", text: "You describe briefly what you need." },
      { title: "Scoping", text: "We ask questions and write down what is in and what is out." },
      { title: "Written quote", text: "You get a price for the described scope." },
    ],
  },
  ctaTitle: "Want a price for your project?",
  ctaLead: "Send a short description. We will clarify the scope and you will get a written quote.",
  ctaButton: "Request a quote",
};
