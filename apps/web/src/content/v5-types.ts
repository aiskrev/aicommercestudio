import type { IconName } from "@/components/ui/Icon";
import type { CompareColumn, CompareRow, TimelineStep } from "@/components/v5/blocks";
import type { PreviewKind } from "@/components/v5/UiPreview";
import type { FaqItem, ServiceKey } from "@/content/types";
import type { ProjectPackageKey } from "@/lib/project-packages";

/**
 * Content of the V5 redesign (docs/V5_FINAL_IMPLEMENTATION_REPORT.md): navigation labels, the homepage, the
 * website-development and e-commerce hubs and the recurring-services matrix. One interface for both languages,
 * so a missing field in either fails `tsc`. No price is ever written here: amounts come from lib/prices.ts.
 */

export interface V5Nav {
  websites: string;
  ecommerce: string;
  ai: string;
  maintenance: string;
  pricing: string;
  studio: string;
  contact: string;
  /** Header button: the working quote path (contact form with the quote type). */
  quoteCta: string;
  overview: string;
  allServices: string;
  groups: {
    websiteTypes: string;
    websiteServices: string;
    storePlatforms: string;
    storeServices: string;
    aiServices: string;
    aiStart: string;
    care: string;
    cloud: string;
    packages: string;
    examples: string;
    company: string;
  };
  /** Featured card at the end of a menu panel. */
  featured: Record<"websites" | "ecommerce" | "ai" | "maintenance" | "pricing" | "studio", { title: string; text: string; cta: string }>;
  labels: {
    examples: string;
    aiOverview: string;
    tools: string;
  };
}

export interface HomeShowcaseCard {
  key: "website" | "store" | "platform" | "ai";
  service: ServiceKey;
  preview: PreviewKind;
  title: string;
  text: string;
  audience: string;
  /** Link label of the hub or service page. */
  more: string;
}

export interface HomeV5 {
  metaTitle: string;
  metaDescription: string;
  hero: {
    eyebrow: string;
    title: string;
    titleHighlight: string;
    lead: string;
    primaryCta: string;
    secondaryCta: string;
    configureCta: string;
    points: string[];
    previewCaption: string;
  };
  showcase: {
    eyebrow: string;
    title: string;
    lead: string;
    audienceLabel: string;
    quoteLabel: string;
    priceNote: string;
    cards: HomeShowcaseCard[];
  };
  websites: {
    eyebrow: string;
    title: string;
    lead: string;
    types: { id: string; title: string; text: string; tag: string }[];
    staticVsInteractive: { title: string; static: string; interactive: string };
    cta: string;
  };
  stores: {
    eyebrow: string;
    title: string;
    lead: string;
    platforms: { id: string; title: string; text: string; fit: string }[];
    note: string;
    cta: string;
  };
  process: { eyebrow: string; title: string; lead: string; steps: TimelineStep[]; link: string };
  tools: { eyebrow: string; title: string; lead: string; demosTitle: string; demosText: string; demosCta: string; scenariosCta: string; toolsCta: string };
  offers: {
    eyebrow: string;
    title: string;
    lead: string;
    packages: ProjectPackageKey[];
    compareCta: string;
    pricingCta: string;
    careTitle: string;
    careText: string;
    careCta: string;
  };
  practices: { eyebrow: string; title: string; lead: string; groups: { icon: IconName; title: string; items: string[] }[] };
  faq: { title: string; items: FaqItem[] };
  finalCta: { title: string; lead: string; primary: string; secondary: string };
}

export interface HubOffer {
  /** In-page anchor (also used by the header menu). */
  id: string;
  name: string;
  value: string;
  audience: string;
  deliverables: string[];
  exclusions: string[];
  approach: string;
  /** Service the offer belongs to: its page and its quote form. */
  service: ServiceKey;
  /** `"service"` = the published band of that service; `null` = price on request (owner decision pending). */
  price: "service" | null;
  preview?: PreviewKind;
}

export interface HubContent {
  metaTitle: string;
  metaDescription: string;
  breadcrumb: string;
  eyebrow: string;
  title: string;
  lead: string;
  primaryCta: string;
  secondaryCta: string;
  jumpLabel: string;
  previewCaption: string;
  offersTitle: string;
  offersLead: string;
  offers: HubOffer[];
  labels: {
    audience: string;
    deliverables: string;
    exclusions: string;
    approach: string;
    price: string;
    priceOnRequest: string;
    priceOnRequestNote: string;
    priceNote: string;
    quote: string;
    service: string;
  };
  compare: { title: string; lead: string; caption: string; corner: string; columns: CompareColumn[]; rows: CompareRow[]; highlight?: string };
  /** Optional second table (the e-commerce hub: who is paid for what). */
  costs?: { title: string; lead: string; caption: string; corner: string; columns: CompareColumn[]; rows: CompareRow[]; sources: { label: string; href: string }[] };
  related: { title: string; lead: string; items: { service: ServiceKey; title: string; text: string }[] };
  packages: { title: string; lead: string; keys: ProjectPackageKey[]; cta: string };
  process: { title: string; steps: TimelineStep[] };
  faq: { title: string; items: FaqItem[] };
  cta: { title: string; lead: string };
}

export interface CareMatrix {
  title: string;
  lead: string;
  caption: string;
  corner: string;
  columns: CompareColumn[];
  rows: (CompareRow & { service: ServiceKey | null })[];
  legend: string;
  enquire: string;
}

export interface V5Content {
  nav: V5Nav;
  home: HomeV5;
  websites: HubContent;
  ecommerce: HubContent;
  care: CareMatrix;
}
