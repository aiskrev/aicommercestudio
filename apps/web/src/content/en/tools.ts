import type { tools as bgTools } from "@/content/bg/tools";

export const tools: typeof bgTools = {
  liveBadge: "Available now",
  upcomingBadge: "In preparation",
  upcomingNote: "Tools in preparation are not available yet. Until then, start with the Advisor or a technical assessment.",
  relatedTitle: "Related tools",
  relatedLead: "Start with a quick self-assessment before we talk.",
  items: [
    {
      key: "advisor",
      icon: "sparkles",
      category: "Automation opportunity finder",
      title: "AI Automation Advisor",
      description:
        "Describe a manual process and get a structured first assessment: automation opportunities, workflow, integrations, risks and the points that need human approval.",
      cta: "Try the Advisor",
    },
    {
      key: "readiness",
      icon: "gauge",
      category: "Strategy",
      title: "AI readiness assessment",
      description: "A short questionnaire on data, processes and team that shows where to start.",
    },
    {
      key: "team",
      icon: "users",
      category: "Agents",
      title: "Build your AI team",
      description: "Choose agents, the tools they may use and the approvals they need — and see the system as a diagram.",
    },
    {
      key: "roi",
      icon: "chart",
      category: "Business impact",
      title: "AI ROI calculator",
      description: "Calculated only from your own numbers, with the formula shown and no assumed values.",
    },
  ],
};
