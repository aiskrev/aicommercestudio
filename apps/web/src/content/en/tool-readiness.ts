import type { readinessTool as bgReadinessTool } from "@/content/bg/tool-readiness";

export const readinessTool: typeof bgReadinessTool = {
  metaTitle: "AI readiness assessment for your company — free check",
  metaDescription:
    "A free AI readiness assessment: 10 questions on data, processes, systems, people and governance. A score across five dimensions and next steps, no sign-up.",
  eyebrow: "Tools · Strategy",
  title: "AI readiness assessment",
  lead: "Ten questions show how ready your data, processes, systems, people and governance are for a first AI project — and what to sort out first.",
  facts: ["10 questions", "about 4 minutes", "no sign-up, no personal data"],
  steps: {
    data: { title: "Data", description: "Where your data lives and what state it is in." },
    processes: { title: "Processes", description: "Whether there is a specific, repeatable process." },
    systems: { title: "Systems", description: "Access to your systems and the technical setup." },
    people: { title: "People", description: "Who owns it and who gives feedback." },
    governance: { title: "Governance", description: "Personal data and human approval." },
  },
  questions: {
    data_location: {
      label: "Where does the data AI would work with live — orders, customers, documents?",
      options: [
        "Scattered across e-mails, files and paper",
        "In several spreadsheets and systems that are not connected",
        "Mostly in one or two systems, exported by hand",
        "In systems with API access or a regular export",
      ],
    },
    data_quality: {
      label: "How complete and up to date is that data?",
      options: [
        "We don't know, or it is rarely maintained",
        "Lots of gaps and duplicates",
        "Mostly current, with some gaps",
        "Maintained regularly, with a clear owner",
      ],
    },
    process_definition: {
      label: "Is the process you want to improve written down?",
      options: [
        "We don't have a specific process in mind yet",
        "We know the process, but it isn't written down",
        "Partly documented, with some exceptions",
        "Documented step by step, including the exceptions",
      ],
    },
    process_volume: {
      label: "How often does this work repeat?",
      options: ["Rarely — a few times a month", "Every week", "Every day", "Many times a day"],
    },
    systems_access: {
      label: "Do your systems — store, CRM, ERP — offer APIs or ready-made integrations?",
      options: ["We don't know", "No, or only manual exports", "Some do, some don't", "Yes, the main systems have APIs"],
    },
    systems_landscape: {
      label: "What does your technical setup look like?",
      options: [
        "We don't have our own system or website",
        "An off-the-shelf platform with no customisation",
        "A platform with extensions and a few integrations",
        "A documented setup with a test environment",
      ],
    },
    people_owner: {
      label: "Is there someone who would own the AI initiative?",
      options: [
        "No",
        "Someone would take it on top of their job",
        "An owner with limited time",
        "An owner with time and authority",
      ],
    },
    people_time: {
      label: "Can the team set aside time for testing and feedback?",
      options: ["No", "Rarely and unpredictably", "A few hours a month", "Regularly, on a schedule"],
    },
    governance_privacy: {
      label: "Do you know which personal data would pass through the AI system?",
      options: [
        "We haven't thought about it",
        "We know there is some, but it isn't documented",
        "It's documented, but without rules for AI",
        "It's documented and there are rules for processing it",
      ],
    },
    governance_approval: {
      label: "Have you decided which actions a person must approve?",
      options: ["No", "We've discussed it without a decision", "We know the main cases", "Yes, the approval rules are clear"],
    },
  },
  result: {
    title: "Your AI readiness",
    overallLabel: "Overall score",
    outOf: "out of 100",
    dimensionsTitle: "By dimension",
    recommendationsTitle: "Recommended next steps",
    serviceLabel: "Related service",
    levels: {
      early: {
        title: "Early stage",
        description:
          "Before building anything, it pays to organise your data and pick one specific process. A structured assessment is a good first move.",
      },
      developing: {
        title: "Developing",
        description: "There is a basis for a first AI project. Close the gaps below and start with a small, measurable pilot.",
      },
      ready: {
        title: "Ready for a pilot",
        description: "Your data, processes and governance support a pilot with a clear task, tests and human approval.",
      },
    },
    recommendations: {
      data: {
        title: "Organise your data",
        text: "Choose a leading system for each kind of data and make it available through an API or a regular export. Without that, AI has nothing reliable to work on.",
      },
      processes: {
        title: "Document one process",
        text: "Pick a repeatable process and write it down step by step, exceptions included. It is the foundation of any automation.",
      },
      systems: {
        title: "Secure access to your systems",
        text: "Check which systems have APIs and which permissions are needed. Where there are none, plan an integration or an interim solution.",
      },
      people: {
        title: "Name an owner",
        text: "An AI project needs someone who knows the process, assesses the results and decides when the solution is ready.",
      },
      governance: {
        title: "Set rules for control",
        text: "Describe which data is processed and which actions require approval — before the system starts working.",
      },
      pilot: {
        title: "Start with a pilot",
        text: "Pick one task with clear success criteria and build an agent or automation with human approval.",
      },
    },
    note: "The assessment is indicative, is calculated only in your browser and contains no forecasts of savings or results.",
    summaryHeading: "AI readiness assessment — summary",
  },
  leadCapture: {
    title: "Discuss the result with us",
    text: "We'll review the weak spots and suggest a concrete first step. Your answers are not sent automatically — share only what you choose.",
    cta: "Book a consultation",
    secondary: "Describe a specific process in the AI Advisor",
  },
};
