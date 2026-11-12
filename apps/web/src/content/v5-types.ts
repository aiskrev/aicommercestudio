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
  /** Quick-start strip at the bottom of every desktop panel and in the mobile sheet (Future Commerce). */
  quick: { title: string; text: string; selector: string };
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

/* ------------------------------------------------------------------ Future Commerce (docs/FUTURE_COMMERCE_REDESIGN_REPORT.md) */

export type FutureCardKey = "website" | "store" | "platform" | "ai";

export interface FutureServiceCard {
  key: FutureCardKey;
  service: ServiceKey;
  icon: IconName;
  title: string;
  summary: string;
  audience: string;
  includes: string[];
  more: string;
}

export type ShowcaseKey = "corporate" | "interactive" | "store" | "saas";

export interface ShowcaseItem {
  key: ShowcaseKey;
  icon: IconName;
  label: string;
  title: string;
  text: string;
  points: string[];
  link: string;
  /** Sample text drawn inside the mock-up (decorative; the caption says it is a demonstration). */
  mock: { brand: string; title: string; subtitle: string; items: string[]; action: string; meta: string[] };
}

export interface ProcessStage {
  title: string;
  text: string;
  output: string;
  input: string;
}

export interface FlowNode {
  key: "website" | "api" | "crm" | "automation" | "analytics";
  icon: IconName;
  title: string;
  text: string;
}

export type AiActor = "system" | "ai" | "human";

export interface AiDemoSample {
  key: "enquiry" | "order" | "invoice";
  label: string;
  input: string;
  /** One output per step, in step order. */
  outputs: string[];
}

export type CompareOptionKey = "static" | "cms" | "interactive" | "store" | "app";

export interface FutureContent {
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
    chips: { icon: IconName; label: string }[];
  };
  services: {
    eyebrow: string;
    title: string;
    lead: string;
    audienceLabel: string;
    includesLabel: string;
    quoteLabel: string;
    priceNote: string;
    hint: string;
    selectorTitle: string;
    selectorText: string;
    selectorCta: string;
    cards: FutureServiceCard[];
  };
  showcase: { eyebrow: string; title: string; lead: string; tabsLabel: string; caption: string; platformsLabel: string; items: ShowcaseItem[] };
  compare: {
    eyebrow: string;
    title: string;
    lead: string;
    focusLabel: string;
    caption: string;
    corner: string;
    priceRow: string;
    priceOnRequest: string;
    priceNote: string;
    quote: string;
    more: string;
    staticVsInteractive: { title: string; static: string; interactive: string };
    options: { key: CompareOptionKey; service: ServiceKey; label: string; summary: string }[];
    rows: { label: string; cells: string[] }[];
  };
  process: { eyebrow: string; title: string; lead: string; tabsLabel: string; outputLabel: string; inputLabel: string; link: string; steps: ProcessStage[] };
  flow: { eyebrow: string; title: string; lead: string; caption: string; note: string; nodes: FlowNode[]; cta: string };
  packages: {
    eyebrow: string;
    title: string;
    lead: string;
    filterLabel: string;
    filters: { key: "all" | "websites" | "stores" | "custom"; label: string }[];
    scopeLabel: string;
    paymentsLabel: string;
    integrationsLabel: string;
    deliveryLabel: string;
    careLabel: string;
    compareCta: string;
    pricingCta: string;
    careTitle: string;
    careText: string;
    careCta: string;
  };
  aiDemo: {
    eyebrow: string;
    title: string;
    lead: string;
    disclaimer: string;
    samplesLabel: string;
    inputLabel: string;
    start: string;
    next: string;
    approve: string;
    reject: string;
    restart: string;
    waiting: string;
    approved: string;
    rejected: string;
    actors: Record<AiActor, string>;
    states: { pending: string; active: string; done: string; waiting: string };
    steps: { key: string; actor: AiActor; title: string }[];
    samples: AiDemoSample[];
    toolsTitle: string;
    toolsText: string;
  };
  about: { eyebrow: string; title: string; lead: string; points: string[] };
  finalCta: { eyebrow: string; title: string; lead: string; primary: string; secondary: string; points: string[] };
  selector: {
    eyebrow: string;
    title: string;
    lead: string;
    goalLabel: string;
    goals: { key: "landing" | "website" | "store" | "app" | "automate"; label: string; hint: string }[];
    needsLabel: string;
    needs: { key: "payments" | "accounts" | "cms" | "integrations" | "languages" | "maintenance"; label: string }[];
    resultLabel: string;
    packageLabel: string;
    serviceLabel: string;
    relatedLabel: string;
    careLabel: string;
    noPackage: string;
    adjusted: string;
    disclaimer: string;
    quote: string;
    open: string;
    reset: string;
  };
}

export interface V5Content {
  nav: V5Nav;
  home: HomeV5;
  websites: HubContent;
  ecommerce: HubContent;
  care: CareMatrix;
  future: FutureContent;
}
