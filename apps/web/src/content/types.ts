import type { IconName } from "@/components/ui/Icon";

export type ServiceKey =
  | "maintenance"
  | "seo"
  | "ai_tools"
  | "automation"
  | "analytics"
  | "integrations"
  | "audit";

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
  /** Commercial offerings that are not one of the six core categories (e.g. the audit). */
  isOffering?: boolean;
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  category: string;
  publishedAt: string;
  readingMinutes: number;
  relatedService: ServiceKey;
  sections: ArticleSection[];
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
