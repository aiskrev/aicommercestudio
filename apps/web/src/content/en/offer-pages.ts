import type { carePlans as bgCarePlans, demoCentre as bgDemoCentre } from "@/content/bg/offer-pages";

export const carePlans: typeof bgCarePlans = {
  metaTitle: "Care plans for websites, online stores and systems",
  metaDescription:
    "Compare Website Care, Commerce Care, Automation Care, Cloud & Platform Care and Security & Performance Care. Scope and price are set after an assessment.",
  eyebrow: "Support",
  title: "Care plans after launch",
  lead: "Choose what you need looked after. Every plan starts with an assessment, and the scope, response times and exact price are agreed in writing for your system.",
  note: "Prices are indicative, per month and per system. We don't publish included hours or SLAs, and we don't offer round-the-clock cover.",
  labels: {
    plan: "Plan",
    forWho: "Who it's for",
    covers: "What it covers",
    excludes: "What it doesn't cover",
    reporting: "How we report",
    response: "Response time",
    price: "Indicative price",
    cta: "Request an assessment",
    service: "Related service",
  },
  responseValue: "Agreed in the individual contract",
  plans: {
    website: {
      name: "Website Care",
      forWho: "Business websites and interactive pages.",
      covers: ["Updates and backups", "Availability monitoring", "Small corrections"],
      excludes: "New features and redesigns.",
      reporting: "A regular report of the work done.",
    },
    commerce: {
      name: "Commerce Care",
      forWho: "Online stores on Shopify and WooCommerce.",
      covers: ["Platform and app updates", "Checks on the order path", "Monitoring of store integrations"],
      excludes: "Advertising, content and customer service.",
      reporting: "A monthly review of problems and changes.",
    },
    automation: {
      name: "Automation Care",
      forWho: "Live integrations and automations without language models.",
      covers: ["Monitoring and error alerts", "Renewing keys", "Following API changes"],
      excludes: "AI agents and models: those belong to AI Managed Services.",
      reporting: "A monthly review of incidents and changes.",
    },
    cloud: {
      name: "Cloud & Platform Care",
      forWho: "Applications in the cloud or on your own server.",
      covers: ["Infrastructure updates and monitoring", "Backups and restore tests", "A review of costs"],
      excludes: "Round-the-clock cover and new architecture projects.",
      reporting: "A regular review of status and costs.",
    },
    security: {
      name: "Security & Performance Care",
      forWho: "Websites and stores after a security and speed review.",
      covers: ["Regular review of versions and access", "Speed measurements", "A review of backups"],
      excludes: "Penetration tests, certification and any guarantee against breaches.",
      reporting: "A regular report with the remaining risks.",
    },
  },
  aiManaged: {
    title: "For AI systems: AI Managed Services",
    lead: "Support for AI agents and models is a separate service with its own tiers. The plans above don't replace it.",
    cta: "Explore AI Managed Services",
  },
  ctaTitle: "Not sure which plan you need?",
  ctaLead: "Tell us what you run and who looks after it today. We'll tell you where to start.",
};

export const demoCentre: typeof bgDemoCentre = {
  metaTitle: "Demo Centre: examples, tools and services",
  metaDescription:
    "See what you can try today: demos with sample data, real free tools, future products and services carried out by our team, each one clearly labelled.",
  eyebrow: "Demo Centre",
  title: "See what's real and what's an example",
  lead: "Everything here is labelled: what is an example with made-up data, what is a working free tool, what doesn't exist yet and what our team carries out.",
  legendTitle: "How to read the labels",
  kinds: {
    demo: { label: "Demo", text: "An interactive example with made-up data. Not connected to real systems." },
    tool: { label: "Free tool", text: "Works today, with no sign-up. The result is a first assessment." },
    future: { label: "Future product", text: "Not available yet. No date is promised." },
    service: { label: "Service by our team", text: "Not an automated product. We carry it out after an assessment and a quote." },
  },
  sections: {
    demo: { title: "Demos with sample data", lead: "See how we think about processes without entering anything of your own." },
    tool: { title: "Real free tools", lead: "These stay free and available without sign-up." },
    service: { title: "Services carried out by our team", lead: "People do this work, to a written scope." },
    future: { title: "Future products", lead: "We show them so it's clear what doesn't exist yet." },
  },
  demos: [
    { key: "workflow", title: "Product return request", text: "An example of a request passing through AI, rules and approval by a person.", cta: "See the example" },
    { key: "scenarios", title: "Reference scenarios", text: "Made-up companies and how we would approach their problems.", cta: "Browse the scenarios" },
    { key: "agents", title: "Agent library", text: "A catalogue for planning. The agents are not connected to your systems.", cta: "Open the library" },
  ],
  future: [
    { key: "accounts", title: "Accounts and saved results", text: "We plan customer accounts for saving tool results. They are not available yet." },
    { key: "portal", title: "AI Operations Portal", text: "A secure portal for supported AI systems. In development and not available to clients." },
  ],
  toolCta: "Open the tool",
  serviceCta: "View the service",
  ctaTitle: "Want to see how this would look for you?",
  ctaLead: "Describe the task. We'll tell you which example comes closest and what would be different.",
  ctaPrimary: "Book a consultation",
  ctaSecondary: "View services",
};
