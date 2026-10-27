import type { ServiceTemplate } from "@/content/bg/services-template";
import type { ServiceKey } from "@/content/types";

/**
 * English service-page template content: approach and realistic use cases.
 * Scenarios only — no client names, results or promised percentages.
 */
export const serviceTemplate: Record<ServiceKey, ServiceTemplate> = {
  ai_agents: {
    approach: [
      { title: "A narrow job, clear limits", description: "The agent gets one described task, a list of permitted tools and rules for when to stop and ask a person." },
      { title: "Tools with minimal permissions", description: "Every action goes through a specific API function with limited access — never through a shared admin account." },
      { title: "Approval and an audit trail", description: "Actions with impact wait for approval, and every step is logged so it can be reviewed and replayed." },
    ],
    useCases: [
      { title: "Order status and returns", description: "The agent checks the order, drafts a reply and a return proposal that a team member approves." },
      { title: "Inbox triage", description: "Classifies e-mails, extracts the key data and routes them to the right person or system." },
      { title: "Quote preparation", description: "Pulls catalogue and CRM data into a draft quote for a salesperson to review." },
    ],
  },
  automation: {
    approach: [
      { title: "Process first, technology second", description: "We map the steps, systems and exceptions before choosing a tool or a model." },
      { title: "Rules wherever possible", description: "Deterministic steps stay rules; AI is used only to understand text, classify and draft." },
      { title: "Observable workflows", description: "Every workflow has a log, error alerts and a clear way for a person to step in." },
    ],
    useCases: [
      { title: "Incoming inquiries", description: "Classification, data extraction and a CRM task created with the right priority." },
      { title: "Documents to accounting", description: "Invoices and receipts are read and prepared for entry after a check." },
      { title: "Scheduled reports", description: "Store and advertising data is collected and sent on a schedule, without copy-pasting." },
    ],
  },
  ai_tools: {
    approach: [
      { title: "A use case with criteria", description: "We describe the task and the test set against which the solution is accepted or rejected." },
      { title: "Your data as the source", description: "Answers are grounded in your documents, catalogue and policies, with the source cited." },
      { title: "Swap the model without a rewrite", description: "The architecture lets you change provider based on quality, cost and data requirements." },
    ],
    useCases: [
      { title: "Search over internal knowledge", description: "A RAG assistant that answers staff questions on procedures and product documentation." },
      { title: "Product content", description: "Draft descriptions and metadata in your brand's voice, approved by an editor." },
      { title: "Document extraction", description: "Key fields from contracts, specifications and invoices in a structured form." },
    ],
  },
  integrations: {
    approach: [
      { title: "A clear source of truth", description: "We decide which system leads for each piece of data — product, stock, customer, order." },
      { title: "Reliable connections", description: "Retries, idempotency and a log for every sync instead of silent failures." },
      { title: "Secure by default", description: "Least-privilege access, secrets kept out of code and monitored access." },
    ],
    useCases: [
      { title: "Store ↔ CRM", description: "Orders and customers stay in sync so sales and support share one picture." },
      { title: "Warehouse and couriers", description: "Stock levels and shipping labels update automatically between systems." },
      { title: "Data for AI", description: "We prepare clean, current data for AI agents and assistants to work on." },
    ],
  },
  ai_managed: {
    approach: [
      { title: "Visibility first", description: "We instrument the system — requests, quality, cost and errors — before changing anything." },
      { title: "Controlled changes", description: "Changes to models and instructions go through tests and can be rolled back." },
      { title: "Regular reviews", description: "A monthly review of quality, cost and incidents with an improvement plan." },
    ],
    useCases: [
      { title: "Quality dropped after a change", description: "Finding the cause and restoring quality with a test set that prevents a repeat." },
      { title: "Rising costs", description: "Analysing requests and optimising the model, context and caching." },
      { title: "An agent built by another team", description: "A technical review, documentation and a handover of the operation." },
    ],
  },
  maintenance: {
    approach: [
      { title: "A test environment before changes", description: "Updates are checked outside the live store before they reach customers." },
      { title: "Backups that restore", description: "Regular backups and a periodic check that restoring actually works." },
      { title: "Monitoring the critical path", description: "We watch availability, payment and checkout so we hear about problems before your customers do." },
    ],
    useCases: [
      { title: "Planned updates", description: "Platform, theme and extensions are updated on a schedule, with compatibility checks." },
      { title: "A slow store", description: "Finding the heavy queries and extensions and improving Core Web Vitals." },
      { title: "Taking over an existing store", description: "A technical review, documentation and a stabilisation plan." },
    ],
  },
  seo: {
    approach: [
      { title: "Technical foundation first", description: "Indexing, structure and speed before work on content." },
      { title: "Categories as key pages", description: "Focus on the pages that attract searches with commercial intent." },
      { title: "Measurable progress", description: "Search Console and analytics show what works — without promises about rankings." },
    ],
    useCases: [
      { title: "Technical SEO audit", description: "Checks of indexing, duplicate content and structured data." },
      { title: "Category optimisation", description: "Copy, internal links and filters that help both search engines and customers." },
      { title: "Migration without losing traffic", description: "Redirects and checks when changing platform or structure." },
    ],
  },
  analytics: {
    approach: [
      { title: "Correct data", description: "We verify events and conversions in GA4 before drawing conclusions from them." },
      { title: "Questions, not dashboards", description: "Every report answers a specific business question — where customers drop off and why." },
      { title: "Change and verify", description: "We propose improvements and measure their effect, without promising percentages." },
    ],
    useCases: [
      { title: "Abandoned carts", description: "Finding the step where customers give up and the likely reasons." },
      { title: "Sales reporting", description: "One dashboard combining store, advertising and analytics data." },
      { title: "Tracking check", description: "Correct purchase events so your advertising data is right too." },
    ],
  },
  audit: {
    approach: [
      { title: "Processes and data, not technology", description: "We start from where time is lost and what data exists — not from choosing a model." },
      { title: "Risks and constraints", description: "Personal data, the cost of mistakes and dependencies — described before any decision." },
      { title: "A prioritised plan", description: "Recommendations ranked by impact and effort that you can carry out with us or on your own." },
    ],
    useCases: [
      { title: "Where to start with AI", description: "Assessing processes and choosing the first one or two use cases with a clear benefit." },
      { title: "Data readiness", description: "Which data is needed, where it lives and what needs organising first." },
      { title: "A technical review of the store", description: "Stability, security, speed and SEO foundations as a starting point." },
    ],
  },
};
