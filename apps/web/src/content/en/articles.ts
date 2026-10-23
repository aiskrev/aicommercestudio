import type { insightsPage as bgInsightsPage } from "@/content/bg/articles";
import { newArticles } from "@/content/en/articles-new";
import type { Article } from "@/content/types";

export const insightsPage: typeof bgInsightsPage = {
  metaTitle: "Insights on online stores, SEO and AI automation",
  metaDescription:
    "Practical articles for online store owners: technical SEO, AI assistants, human-in-the-loop automation and technical maintenance.",
  eyebrow: "Insights",
  title: "Practical guidance for online commerce and AI",
  lead: "Short, actionable articles about technical decisions that directly affect sales and efficiency.",
  empty: "No articles have been published yet. Check back soon.",
};

const foundationArticles: Article[] = [
  {
    key: "tehnicheski-seo-odit-na-online-magazin",
    slug: "technical-seo-audit-for-online-stores",
    title: "Technical SEO audit for online stores: what to check first",
    description:
      "A practical list of the technical checks that most often limit an online store's organic traffic — from indexing to Core Web Vitals.",
    type: "checklist",
    category: "seo",
    publishedAt: "2026-10-23",
    updatedAt: "2026-10-24",
    readingMinutes: 6,
    relatedService: "seo",
    relatedServices: ["seo", "audit", "maintenance"],
    relatedArticles: ["tehnicheski-problemi-pri-online-magazinite", "shopify-ili-woocommerce"],
    keyPoints: [
      "Technical SEO answers the question of what is holding you back before you invest in new content.",
      "The biggest risks in online stores are filters, duplicate URLs and slow templates.",
      "Measure by page type — category, product, cart — not just the homepage.",
      "A good audit ends with a prioritized plan, not just a list of problems.",
    ],
    sections: [
      {
        heading: "Why technical SEO comes first",
        paragraphs: [
          "Content and links matter, but if search engines cannot crawl and index your store properly, effort in those areas has limited effect. In online stores, technical problems pile up quickly: filters that generate thousands of URLs, out-of-stock products, duplicate descriptions and slow templates.",
          "A technical audit answers \"what is in the way\" before you invest in \"what should we add\".",
        ],
      },
      {
        heading: "Indexing and crawling",
        paragraphs: [
          "Start with the indexing reports in Google Search Console. Compare the number of indexed pages with the number of real categories and products — a large gap in either direction is a warning sign.",
        ],
        bullets: [
          "Check robots.txt and the XML sitemap — do they contain only pages you want indexed?",
          "Find filter and sorting URLs that are indexed unnecessarily.",
          "Make sure important categories are reachable within a few clicks of the homepage.",
        ],
      },
      {
        heading: "Canonical URLs and duplicate content",
        paragraphs: [
          "A product is often reachable at several URLs — through different categories, with parameters or as different variants. The canonical URL tells the search engine which version is the primary one.",
        ],
        bullets: [
          "Every indexable page needs a correct canonical URL.",
          "Product variants (color, size) should not compete with each other.",
          "Manufacturer descriptions copied verbatim make product pages hard to tell apart.",
        ],
      },
      {
        heading: "Speed and Core Web Vitals",
        paragraphs: [
          "LCP, INP and CLS measure how quickly the main content appears, how quickly the page responds and how stable the layout is. In online stores the most common causes of poor values are unoptimized images, heavy app scripts and fonts that load late.",
          "Measure with real-user data where it is available, not only with lab tests.",
        ],
      },
      {
        heading: "Structured data",
        paragraphs: [
          "schema.org markup helps search engines understand the product, price, availability and navigation path. The data in the markup must match the visible content — mismatches lead to the markup being ignored or penalized.",
        ],
      },
      {
        heading: "From audit to plan",
        paragraphs: [
          "A list of problems is not a result in itself. A good audit orders the findings by expected impact and required effort, so the team starts with the changes that deliver the most for the least work.",
        ],
      },
    ],
  },
  {
    key: "ai-asistent-za-klienti",
    slug: "ai-customer-assistant",
    title: "AI customer assistants: when they make sense and how to introduce them safely",
    metaTitle: "AI customer assistants: when and how to introduce them",
    description:
      "When an AI customer service assistant delivers real value for an online store, what the risks are, and how to introduce one with quality control.",
    type: "guide",
    category: "ai",
    publishedAt: "2026-10-23",
    updatedAt: "2026-10-24",
    readingMinutes: 5,
    relatedService: "ai_tools",
    relatedServices: ["ai_tools", "automation", "ai_managed"],
    relatedArticles: ["ai-avtomatizatsiya-v-malkiya-biznes", "avtomatizatsiya-s-choveshko-odobrenie"],
    keyPoints: [
      "Start from your customers' real questions, not from choosing a model.",
      "Restrict answers to verified sources and cite the source.",
      "Plan a hand-over to a person when the assistant is unsure or the customer is unhappy.",
      "Measure quality with a test set before and after launch.",
    ],
    sections: [
      {
        heading: "Start from the questions, not the technology",
        paragraphs: [
          "Before you choose a model or a platform, collect the real questions your customers ask. If a large share of them repeat — delivery, returns, stock, sizes — the assistant has a clear task and a measurable benefit.",
          "If the questions are rare, highly individual or require judgment, a better information page or a better reply process may be the smarter move.",
        ],
      },
      {
        heading: "Answers only from verified sources",
        paragraphs: [
          "The biggest risk with language models is a confident but wrong answer. Retrieval-augmented generation (RAG) restricts the assistant to your documents and product data and makes it possible to cite the source of every answer.",
        ],
        bullets: [
          "Keep delivery, returns and warranty policies up to date.",
          "Connect the assistant to real stock levels, not to static text.",
          "Set clear rules for when the assistant must decline or hand over the conversation.",
        ],
      },
      {
        heading: "Escalation to a person",
        paragraphs: [
          "The assistant must recognize when it is unsure, when the customer is unhappy and when the question involves payment or personal data. In those cases the conversation is handed to a staff member with the full context.",
        ],
      },
      {
        heading: "Privacy and data",
        paragraphs: [
          "Send the model only what it needs. Remove emails, phone numbers and other personal data when they are not required for the answer, and sign a data processing agreement with the provider. Let customers know they are talking to an automated assistant.",
        ],
      },
      {
        heading: "Measuring quality",
        paragraphs: [
          "Before launch, prepare a test set of real questions with expected answers. After launch, track the escalation rate, customer ratings and the cases where the assistant was wrong — and use them to improve it.",
        ],
      },
    ],
  },
  {
    key: "avtomatizatsiya-s-choveshko-odobrenie",
    slug: "human-in-the-loop-automation",
    title: "Human-in-the-loop automation: why not everything should be fully automatic",
    metaTitle: "Human-in-the-loop automation: when and why",
    description:
      "How to design business automations and AI agents so that routine steps run automatically while risky actions are approved by a person.",
    type: "explainer",
    category: "avtomatizatsiya",
    publishedAt: "2026-10-23",
    updatedAt: "2026-10-24",
    readingMinutes: 5,
    relatedService: "automation",
    relatedServices: ["automation", "ai_tools", "ai_managed"],
    relatedArticles: ["ai-avtomatizatsiya-v-malkiya-biznes", "ai-asistent-za-klienti"],
    keyPoints: [
      "Different actions carry different risks and need different controls.",
      "Automation prepares the action; a person approves anything with an external effect.",
      "Every proposal and decision must be traceable in a log.",
      "Expand autonomy gradually, once you have history and confidence in the quality.",
    ],
    sections: [
      {
        heading: "Not every action carries the same risk",
        paragraphs: [
          "Classifying an incoming email is different from sending a reply to a customer or changing a price in the store. Good automation separates actions by risk and applies a different control to each of them.",
        ],
        bullets: [
          "Low risk: reading, summarizing, classifying, drafting.",
          "High risk: sending messages, changing products.",
          "Critical risk: prices, orders, payments, access to sensitive data.",
        ],
      },
      {
        heading: "What approval looks like in practice",
        paragraphs: [
          "The system prepares the action — for example an email draft or a proposed stock change — and places it in an approval queue. The responsible person sees what will happen, approves or rejects it, and the decision is recorded in a log.",
          "This way automation saves the preparation work while control stays with people.",
        ],
      },
      {
        heading: "Logging and traceability",
        paragraphs: [
          "Every proposed, approved or rejected action must be traceable: who requested it, who approved it, when and with which data. The log helps when things go wrong, during audits and when improving the rules.",
        ],
      },
      {
        heading: "Expanding autonomy gradually",
        paragraphs: [
          "Start by requiring approval for anything with an effect outside the system. Once you have built up history and confidence in the quality, you can deliberately expand the automatic actions — with clear boundaries and the ability to roll back.",
        ],
      },
      {
        heading: "When not to automate",
        paragraphs: [
          "If a process happens rarely, depends heavily on judgment, or a mistake is expensive and hard to correct, manual handling with good tools is often the more sensible choice.",
        ],
      },
    ],
  },
];

export const articles: Article[] = [...foundationArticles, ...newArticles];
