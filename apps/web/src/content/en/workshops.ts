import type { workshops as bgWorkshops } from "@/content/bg/workshops";

const ag = (title: string, text: string) => ({ title, text });

const WORKSHOP_LENGTH = "Indicatively half a day to two days with your team. The exact length is agreed in writing when the scope is set.";
const ASSESSMENT_LENGTH =
  "A fixed scope agreed in writing beforehand: interviews, a review of documents and configuration, then a written report. Timing depends on the scope and on access.";
const MODE = "Remote or on site; the materials and notes stay with you.";

export const workshops: typeof bgWorkshops = {
  page: {
    metaTitle: "Workshops and advisory assessments for AI and cloud",
    metaDescription:
      "Ten consultant-led formats with a clear scope: AI strategy and readiness, agents, cloud, Kubernetes, DevOps, observability, integration, RAG and responsible AI.",
    eyebrow: "Services · Workshops and assessments",
    title: "Workshops and advisory assessments",
    lead: "Short, clearly bounded formats we start with before any larger project: who they are for, what they solve, what is needed beforehand, the agenda, what you receive and what is not included.",
    notice:
      "We do not publish prices or promise specific outcomes. Scope, length and price are agreed in writing after a short call. Every format is scoped individually.",
    bandNav: "Groups",
    bands: {
      ai: { title: "AI strategy, agents and governance", text: "Opportunity discovery, readiness, agent architecture, RAG and responsible AI." },
      engineering: { title: "Cloud, platform and integration", text: "Cloud landing zones, Kubernetes, DevOps and GitOps, e-commerce integration." },
      operations: { title: "Operations and reliability", text: "Observability, SRE and running AI systems." },
    },
    kinds: {
      workshop: "Workshop",
      assessment: "Assessment",
      review: "Review",
    },
    custom: "Scoped individually",
    open: "See the format",
    count: "{n} formats",
  },
  detail: {
    onThisPage: "On this page",
    audience: "Who it is for",
    problems: "Problems it addresses",
    prerequisites: "What is needed beforehand",
    format: "Format",
    participants: "Participants",
    mode: "Delivery",
    length: "Length",
    agenda: "Agenda",
    deliverables: "What you receive",
    limitations: "What is not included",
    relatedServices: "Related services",
    relatedAssessments: "Prepare with a free assessment",
    relatedScenarios: "Reference scenarios",
    relatedPatterns: "Integration patterns",
    relatedInsights: "Related articles",
    noInsights: "No articles on this topic have been published yet.",
    backToList: "All workshops and assessments",
    notice: "Price, length and scope are agreed in writing. We do not guarantee specific outcomes: the findings depend on the information available and on your team's participation.",
    ctaTitle: "Would this format suit your team?",
    ctaText: "Send an enquiry. We will clarify the goal, the participants and the material needed, and propose a written scope.",
    ctaButton: "Send an enquiry",
  },
  section: {
    title: "Workshops and assessments",
    lead: "Consultant-led formats with a clear scope that we usually start with.",
    all: "All workshops and assessments",
    resultTitle: "Next step with a consultant",
    resultLead: "These formats continue from your result, with your team taking part.",
  },
  enquiry: {
    about: "Enquiry about: {title}",
    remove: "Remove",
  },
  texts: {
    ai_strategy_discovery: {
      title: "AI Strategy Discovery Workshop",
      summary: "A structured session with leadership and key teams on where AI makes sense, where it does not, and which first step to take.",
      audience: [
        "Owners and executives deciding whether and where to invest in AI.",
        "Heads of departments with a lot of manual, repetitive work.",
        "IT leads who have to evaluate vendor proposals.",
      ],
      problems: [
        "Many AI ideas, but no shared criterion for which to do first.",
        "Conflicting vendor advice and unclear expectations.",
        "Concerns about data, quality and accountability that block decisions.",
        "Pilots without a clear owner or a measure of success.",
      ],
      prerequisites: [
        "A person who can decide on budget and priorities takes part.",
        "A short description of the main processes and the systems used.",
        "Optional: the result of the free AI readiness assessment or the AI advisor.",
      ],
      format: { participants: "Leadership and 3–8 representatives of the teams affected.", mode: MODE, length: WORKSHOP_LENGTH },
      agenda: [
        ag("Goals and constraints", "Business goals, the risks you will not accept, and the data and budget constraints."),
        ag("Opportunity map", "Processes with AI potential, described by input, output and who approves."),
        ag("Prioritisation", "A comparison by value, complexity, risk and data readiness."),
        ag("First step", "One or two initiatives for a first phase, with success criteria and an owner."),
      ],
      deliverables: [
        "A written summary of the decisions made.",
        "A prioritised list of AI opportunities with the reasoning for each.",
        "A proposal for a first phase: scope, prerequisites and how it will be measured.",
        "A list of open questions and risks, each with an owner.",
      ],
      limitations: [
        "It is not a technical implementation and includes no prototype.",
        "It gives no financial forecast; value estimates are qualitative.",
        "It does not replace legal advice on processing personal data.",
      ],
    },
    ai_readiness_mapping: {
      title: "AI Readiness and Opportunity Mapping",
      summary: "A consultant-led assessment of your data, processes, systems and team, with an opportunity map and a prioritised written plan.",
      audience: [
        "Companies that want an objective picture before their first AI project.",
        "Teams that completed a self-assessment and want a consultant's review.",
        "Executives who need to justify an investment to the board or owners.",
      ],
      problems: [
        "It is unclear whether the data and systems allow automation.",
        "A self-assessment shows gaps but not what to do first.",
        "Processes are not described well enough to judge the benefit.",
        "Business and IT lack a shared language for the opportunities.",
      ],
      prerequisites: [
        "Access to the people who run and manage the selected processes.",
        "A description or demo of the main systems (ERP, CRM, store, documents).",
        "Recommended: a completed free AI readiness assessment.",
      ],
      format: { participants: "An owner on your side and 4–10 colleagues interviewed.", mode: MODE, length: ASSESSMENT_LENGTH },
      agenda: [
        ag("Scoping", "Which processes, systems and teams are in the assessment and which are not."),
        ag("Interviews and review", "Conversations with the teams and a review of data, documents and integrations."),
        ag("Analysis", "Scoring along the readiness dimensions and the opportunity map."),
        ag("Presentation", "A session with leadership: findings, risks and the proposed plan."),
      ],
      deliverables: [
        "A written report with findings by dimension: data, processes, systems, people, governance.",
        "An opportunity map with an estimate of value, complexity and risk.",
        "A prioritised plan with quick steps and the prerequisites for the larger ones.",
        "A risk list and recommendations for controls and human approval.",
      ],
      limitations: [
        "The assessment reflects the information provided within the scope.",
        "It includes no implementation and measures no real outcomes after it.",
        "Benefit figures are estimates with stated assumptions, not promises.",
      ],
    },
    agent_architecture: {
      title: "Agent Architecture Workshop",
      summary: "A technical session in which we design the agents, their tools, the limits of their access and the points where a person approves.",
      audience: [
        "Technical leads and architects planning AI agents.",
        "Product teams with a chosen use case but no clear architecture.",
        "Security teams that must approve the agents' access.",
      ],
      problems: [
        "It is unclear which steps an agent should take and which stay with a person.",
        "Agents ask for broad system access without clear limits.",
        "There is no plan for evaluating and observing their behaviour.",
        "The risk of wrong actions is not split into approval levels.",
      ],
      prerequisites: [
        "A selected process or use case with its inputs and outputs described.",
        "A list of the systems and APIs the agent would access.",
        "Optional: an AI Solution Builder result or agents chosen from the library.",
      ],
      format: { participants: "An architect, developers, the process owner and a security representative.", mode: MODE, length: WORKSHOP_LENGTH },
      agenda: [
        ag("Process and roles", "The process steps, the agents' roles and the handoff to a person."),
        ag("Tools and permissions", "Which tools each agent calls, with which rights and limits."),
        ag("Approvals and risks", "Risk levels, when approval is required and how it is recorded."),
        ag("Evaluation and observation", "How quality will be tested and what will be observed after launch."),
      ],
      deliverables: [
        "A diagram of the agents, tools and data flows.",
        "A permission matrix and the points of human approval.",
        "Architecture decision records with alternatives and trade-offs.",
        "An evaluation plan (test cases) and a plan for observation after launch.",
      ],
      limitations: [
        "It includes no development; code and integrations are a separate phase.",
        "It does not choose a model provider for you; it compares the options.",
        "The architecture is a proposal to be confirmed with a prototype.",
      ],
    },
    landing_zone_assessment: {
      title: "Cloud Landing Zone Assessment",
      summary: "A review of the landing zone in Azure or AWS: accounts and subscriptions, network, identity, policies, logging and cost.",
      audience: [
        "Companies starting in the cloud that want the right foundation.",
        "Teams with a grown cloud estate and no common rules.",
        "Executives who must meet security and audit requirements.",
      ],
      problems: [
        "Accounts or subscriptions were created without a common structure.",
        "Network and access were set up by hand and are not documented.",
        "There is no central logging, policy or cost control.",
        "It is unclear who is responsible for which resources and environments.",
      ],
      prerequisites: [
        "Read-only access to the cloud environment or a detailed configuration export.",
        "A description of the environments (development, test, production) and compliance requirements.",
        "Recommended: a completed free cloud maturity assessment.",
      ],
      format: { participants: "The cloud owner, an architect, security and finance representatives.", mode: MODE, length: ASSESSMENT_LENGTH },
      agenda: [
        ag("Scope and access", "Which accounts, subscriptions and regions are reviewed, with what access."),
        ag("Review", "Hierarchy, network (hub-spoke), identity, policies, logging, secrets and tags."),
        ag("Gap analysis", "A comparison with the target model and the security and cost risks."),
        ag("Plan", "The findings and a phased improvement plan."),
      ],
      deliverables: [
        "A written report with findings by area and their severity.",
        "A target landing-zone model adapted to your environment.",
        "A prioritised plan of quick fixes and larger changes.",
        "Recommendations for infrastructure as code and change control.",
      ],
      limitations: [
        "The review is read-only: we change no configuration during the assessment.",
        "It is not a certification or an audit against a standard.",
        "It covers only the environments and accounts in the agreed scope.",
      ],
    },
    kubernetes_review: {
      title: "Kubernetes Platform Review",
      summary: "A technical review of the clusters and platform practices: security, network, deployment, scaling, observability and upkeep.",
      audience: [
        "Platform and DevOps teams that run Kubernetes clusters.",
        "Technical leads who want an independent view before expanding.",
        "Teams migrating applications to Kubernetes.",
      ],
      problems: [
        "Clusters grow, but access and network rules are inconsistent.",
        "Deployments are manual or differ between teams.",
        "Resource limits and a clear scaling strategy are missing.",
        "Version upgrades are postponed because they are risky.",
      ],
      prerequisites: [
        "Read-only access to the clusters or an export of the manifests and configuration.",
        "A description of the deployment process and the tools used.",
        "Recommended: completed free cloud and DevOps maturity assessments.",
      ],
      format: { participants: "The platform team and representatives of development and security.", mode: MODE, length: ASSESSMENT_LENGTH },
      agenda: [
        ag("Scope", "Which clusters, environments and applications are reviewed."),
        ag("Review", "RBAC, network policies, secrets, resources, deployment, observability, versions."),
        ag("Team conversation", "How day-to-day work happens and where problems occur most."),
        ag("Recommendations", "The findings and a prioritised plan."),
      ],
      deliverables: [
        "A written report with findings by area and their severity.",
        "Recommended platform patterns for your environment.",
        "A prioritised plan, including for version upgrades.",
        "A list of metrics and signals worth observing.",
      ],
      limitations: [
        "The review includes no changes to the clusters.",
        "It is not a penetration test and does not replace a security audit.",
        "Performance is judged from the configuration, without load tests.",
      ],
    },
    devops_gitops_assessment: {
      title: "DevOps and GitOps Assessment",
      summary: "An assessment of the path from a code change to production: CI/CD, infrastructure as code, GitOps, change control and recovery.",
      audience: [
        "Development teams for whom releasing is slow or risky.",
        "Technical leads introducing GitOps or infrastructure as code.",
        "Companies that must trace every change.",
      ],
      problems: [
        "Deployments need manual steps and one person's knowledge.",
        "Infrastructure changes outside the code and environments drift apart.",
        "There is no clear process for approving and rolling back changes.",
        "Secrets and access in the pipelines are not controlled.",
      ],
      prerequisites: [
        "Read-only access to the repositories, pipelines and infrastructure code.",
        "A description of the environments and the current release process.",
        "Recommended: a completed free DevOps maturity assessment.",
      ],
      format: { participants: "Developers, the DevOps or platform team and a technical lead.", mode: MODE, length: ASSESSMENT_LENGTH },
      agenda: [
        ag("Scope", "Which applications, repositories and environments are assessed."),
        ag("Tracing a change", "One real change from commit to production, step by step."),
        ag("Review", "Pipelines, tests, infrastructure as code, GitOps, secrets and approvals."),
        ag("Plan", "Findings and a phased improvement plan."),
      ],
      deliverables: [
        "A written report with the findings and their severity.",
        "A target delivery process with control points and approvals.",
        "A prioritised plan of quick improvements and larger changes.",
        "Recommendations for managing secrets and access in the pipelines.",
      ],
      limitations: [
        "It includes no building or changing of pipelines.",
        "It does not measure delivery metrics when no data is available.",
        "It is not a compliance audit against a standard.",
      ],
    },
    observability_sre: {
      title: "Observability and SRE Workshop",
      summary: "A workshop with your team on what you observe, how you learn about a problem and how you respond: signals, SLOs, alerts, incidents.",
      audience: [
        "Operations and development teams of business-critical systems.",
        "Companies that hear about problems from their customers.",
        "Teams introducing AI systems that must be observed.",
      ],
      problems: [
        "Many alerts, but few of them lead to action.",
        "No shared definition of what \"the system works\" means.",
        "Logs, metrics and traces are scattered.",
        "Incidents get fixed, but the lessons are not recorded.",
      ],
      prerequisites: [
        "A list of the main systems and the monitoring tools used.",
        "An example of a recent incident and how it was found and resolved.",
        "Recommended: completed free observability or AI operations assessments.",
      ],
      format: { participants: "Operations, development and the owner of at least one key service.", mode: MODE, length: WORKSHOP_LENGTH },
      agenda: [
        ag("Critical journeys", "Which user journeys and services matter most, and why."),
        ag("Signals and SLOs", "Indicators and service-level objectives for those journeys."),
        ag("Alerts and response", "When whom is alerted and what they do; incident roles."),
        ag("Roll-out plan", "Steps towards OpenTelemetry, dashboards and post-incident reviews."),
      ],
      deliverables: [
        "A written summary of the decisions made.",
        "Draft SLIs and SLOs for the selected services.",
        "Alerting rules and a post-incident review template.",
        "A step-by-step plan for introducing observability.",
      ],
      limitations: [
        "It includes no tool set-up or telemetry collection.",
        "It implies no round-the-clock support; that is agreed separately.",
        "The SLO targets are a draft to be confirmed with real data.",
      ],
    },
    ecommerce_integration_discovery: {
      title: "E-commerce Integration Discovery",
      summary: "A workshop on the flows between the store, ERP, CRM, warehouse, payments and delivery: which data, which way, how often and who owns it.",
      audience: [
        "Online stores that move orders, stock or prices by hand.",
        "Companies changing their ERP, platform or logistics provider.",
        "Teams planning catalog or customer-service automation.",
      ],
      problems: [
        "Stock and prices differ between systems.",
        "Orders and payments are entered by hand in more than one place.",
        "It is unclear which system is the source of truth for which data.",
        "Integration errors are found late, by customers.",
      ],
      prerequisites: [
        "A list of the systems and their available APIs or exports.",
        "The people who know orders, the warehouse and accounting.",
        "Recommended: completed free e-commerce architecture or data integration assessments.",
      ],
      format: { participants: "E-commerce, warehouse or logistics, accounting and IT.", mode: MODE, length: WORKSHOP_LENGTH },
      agenda: [
        ag("Systems and ownership", "A map of the systems and which is the source of truth for each data type."),
        ag("Flows", "Orders, stock, prices, customers and statuses: direction, frequency and triggers."),
        ag("Errors and exceptions", "What happens on an outage, a duplicate or a conflict."),
        ag("Priorities", "Which flows to automate first, and with which pattern."),
      ],
      deliverables: [
        "A map of the systems and data flows.",
        "A table of data ownership and synchronisation frequency.",
        "A recommended integration pattern for each flow, with the trade-offs.",
        "A prioritised first-phase plan with prerequisites.",
      ],
      limitations: [
        "It includes no development or configuration of integrations.",
        "It does not check third-party contracts and limits.",
        "Third-party API availability must be confirmed separately.",
      ],
    },
    rag_data_readiness: {
      title: "RAG and Data Readiness Workshop",
      summary: "A workshop with your team on whether your documents and data suit an AI assistant with retrieval (RAG) and what must be prepared.",
      audience: [
        "Companies that want an assistant for internal policies, documentation or products.",
        "Teams with many documents across systems and formats.",
        "Data and security owners who must define access.",
      ],
      problems: [
        "Documents are scattered, duplicated or out of date.",
        "It is unclear who may access which documents.",
        "There are no criteria for judging whether answers are correct.",
        "Concerns that sensitive data could leak to the model.",
      ],
      prerequisites: [
        "A representative sample of documents (no sensitive data) or a description of the sources.",
        "A description of the access rights to the sources.",
        "Recommended: a completed free data integration assessment.",
      ],
      format: { participants: "Content owners, IT, security and future users.", mode: MODE, length: WORKSHOP_LENGTH },
      agenda: [
        ag("Use cases", "Which questions the assistant must cover and which it must not."),
        ag("Sources and quality", "Where the documents come from, how current they are and who maintains them."),
        ag("Access and protection", "Per-document rights, sensitive data and what never leaves the environment."),
        ag("Quality evaluation", "Test questions, expected answers and acceptance criteria."),
      ],
      deliverables: [
        "An inventory of the sources with a quality and ownership assessment.",
        "Recommendations for preparing, chunking and refreshing the content.",
        "An access model and rules for sensitive data.",
        "An initial set of test questions for evaluation.",
      ],
      limitations: [
        "It includes no building of an index or an assistant.",
        "It does not clean or rewrite the documents.",
        "Answer quality is only shown by a prototype and an evaluation.",
      ],
    },
    responsible_ai_review: {
      title: "Responsible AI Governance Review",
      summary: "A review of the rules, roles and controls for your AI systems: risk, human approval, data, evaluation, documentation and monitoring.",
      audience: [
        "Companies that already use or are launching AI systems.",
        "Executives responsible for risk, compliance or data protection.",
        "Teams that must document their AI systems.",
      ],
      problems: [
        "AI tools are introduced by individual teams without common rules.",
        "It is unclear who approves changes and who is accountable for decisions.",
        "Documentation of data, limitations and evaluation is missing.",
        "There is no process for AI-related incidents.",
      ],
      prerequisites: [
        "A list of the AI systems in use or planned, and their providers.",
        "Existing policies for data, security and change management.",
        "Recommended: a completed free AI governance assessment.",
      ],
      format: { participants: "Leadership, risk or compliance, data protection, IT and the owners of AI systems.", mode: MODE, length: ASSESSMENT_LENGTH },
      agenda: [
        ag("Inventory", "Which AI systems exist, what they are used for and with which data."),
        ag("Risk", "Classifying the systems by risk and impact."),
        ag("Controls", "Human approval, evaluation, documentation, monitoring and incidents."),
        ag("Plan", "Gaps, priorities and owners."),
      ],
      deliverables: [
        "An inventory of the AI systems classified by risk.",
        "A gap report on roles, processes and controls.",
        "Templates for documenting and approving changes.",
        "A prioritised plan with owners.",
      ],
      limitations: [
        "It is not legal advice and does not confirm regulatory compliance.",
        "It is not a certification or an audit against a standard.",
        "It assesses processes and documentation, not the models' source code.",
      ],
    },
  },
};
