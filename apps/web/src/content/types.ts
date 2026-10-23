import type { IconName } from "@/components/ui/Icon";

export type ServiceKey =
  | "maintenance"
  | "seo"
  | "ai_tools"
  | "automation"
  | "analytics"
  | "integrations"
  | "audit"
  | "ai_managed";

export type FormServiceKey = ServiceKey | "other";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface Capability {
  title: string;
  description: string;
}

export interface Service {
  key: ServiceKey;
  slug: string;
  icon: IconName;
  title: string;
  shortTitle: string;
  summary: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  signals: string[];
  capabilities: Capability[];
  deliverables: string[];
  engagement: string[];
  faqs: FaqItem[];
  related: ServiceKey[];
  /** Commercial offerings that are not one of the core service categories (e.g. the audit). */
  isOffering?: boolean;
  /** Rendered by a dedicated route (e.g. uslugi/ai-managed-services) instead of the generic service template. */
  customPage?: boolean;
  /** Service-specific H2 headings (descriptive, written for the search intent of the page). */
  headings: {
    problems: string;
    capabilities: string;
    checks: string;
    workflow: string;
    deliverables: string;
  };
  /** Concrete technical points that are reviewed first — practical knowledge, not claims about results. */
  checks: Capability[];
  /** How the first weeks of an engagement typically run, specific to this service. */
  workflow: Capability[];
  /** What the client needs to provide. */
  inputs: string[];
  /** Keys of articles that deepen the topic (internal linking). */
  relatedArticles: string[];
}

export interface InlineLink {
  label: string;
  /** Canonical route path with this locale's slug, e.g. /uslugi/seo-optimizatsiya (bg) or /uslugi/seo-optimization (en). */
  href: string;
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  /** Optional comparison table (first column = criterion). */
  table?: { caption: string; headers: string[]; rows: string[][] };
  /** Contextual internal links shown at the end of the section. */
  links?: InlineLink[];
}

export type ArticleType = "guide" | "checklist" | "comparison" | "explainer";

export interface Article {
  /** Stable cross-locale identifier (the Bulgarian slug); used for references and the language switcher. */
  key: string;
  /** URL slug in this locale. */
  slug: string;
  title: string;
  /** Shorter <title> when the H1 is long; falls back to `title`. */
  metaTitle?: string;
  description: string;
  type: ArticleType;
  /** Editorial category key (see content/<locale>/editorial.ts). */
  category: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  relatedService: ServiceKey;
  relatedServices: ServiceKey[];
  relatedArticles: string[];
  /** 3–5 key takeaways shown above the article body. */
  keyPoints: string[];
  sections: ArticleSection[];
}

/** Article as written in the Bulgarian content files, where the key equals the slug. */
export type ArticleSource = Omit<Article, "key">;

export interface EditorialCategory {
  /** Stable cross-locale identifier (the Bulgarian slug). */
  key: string;
  slug: string;
  name: string;
  title: string;
  description: string;
  relatedService: ServiceKey;
}

/**
 * Case study (client project). Only published when the work is real and the client approved
 * publication — enforced by `isPublishable` and by content tests. Results must cite their source.
 */
export interface CaseStudy {
  slug: string;
  title: string;
  description: string;
  client: { name: string; industry: string; anonymised: boolean };
  services: ServiceKey[];
  challenge: string;
  solution: string[];
  /** Measured outcomes only, each with how and when it was measured. */
  results: { metric: string; value: string; source: string; measuredAt: string }[];
  verification: {
    realProject: boolean;
    clientApproved: boolean;
    approvedBy: string;
    approvedAt: string;
  };
  publishedAt: string;
}

export interface TitledText {
  title: string;
  description: string;
  icon?: IconName;
}

export interface ProcessStep {
  title: string;
  summary: string;
  details: string[];
  outcome: string;
}

export interface LegalSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocument {
  title: string;
  metaDescription: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}
