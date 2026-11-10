import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";
import type { CarePlanKey } from "@/lib/care-plans";
import type { WorkshopKey } from "@/lib/workshop-slugs";

/**
 * Published indicative prices, decided by the owner on 2026-11-10.
 *
 * The baseline of each row is the recommendation of the pricing report of 2026-11-10 ("Пазарни цени на
 * услугите", kept by the owner, not in this public repository): the lowest sensible scope ("from") and the
 * typical range. The owner's rule:
 *   * Bulgarian pages (clients in Bulgaria): the report's figures 10 % lower.
 *   * English pages (clients in the EU and elsewhere): the report's EU uplift (+20 %, the middle of its
 *     15–25 %) and then the same 10 % lower, i.e. +8 % on the baseline.
 * Amounts are final: the company is not VAT registered, so nothing is added. Third-party costs (hosting,
 * licences, AI model usage) are never included. The exact price is always set in a written quote.
 *
 * To change prices, change a baseline row or a factor here; every page reads this module.
 */
export const BG_FACTOR = 0.9;
export const EU_FACTOR = 1.2 * 0.9;

export type PriceMarket = "bg" | "eu";
export type PriceUnit = "project" | "month";

/** Baseline in EUR: [from, typical low, typical high]. */
type Baseline = readonly [number, number, number];

export interface PriceBand {
  from: number;
  typical: readonly [number, number];
}

export interface PriceItem {
  unit: PriceUnit;
  bg: PriceBand;
  eu: PriceBand;
}

/** Round to amounts a person would quote: 5 below 100, 10 below 1 000, 50 above. */
export function roundPrice(value: number): number {
  const step = value < 100 ? 5 : value < 1000 ? 10 : 50;
  return Math.round(value / step) * step;
}

function band(baseline: Baseline, factor: number): PriceBand {
  const [from, low, high] = baseline.map((value) => roundPrice(value * factor));
  return { from, typical: [low, high] };
}

function item(unit: PriceUnit, baseline: Baseline): PriceItem {
  return { unit, bg: band(baseline, BG_FACTOR), eu: band(baseline, EU_FACTOR) };
}

/** Service pages (/uslugi/<slug>). Monthly services are priced per month. */
export const SERVICE_PRICES: Record<ServiceKey, PriceItem> = {
  business_websites: item("project", [900, 1500, 2500]),
  store_development: item("project", [1200, 2500, 4000]), // Shopify from, WooCommerce typical
  portals_web_apps: item("project", [4000, 8000, 15000]),
  payments_subscriptions: item("project", [500, 800, 7000]), // one provider … recurring billing
  security_performance: item("project", [300, 500, 900]),
  maintenance: item("month", [90, 180, 350]),
  seo: item("month", [200, 300, 500]),
  analytics: item("project", [300, 500, 1500]), // GA4 set-up … CRO audit
  integrations: item("project", [1500, 3000, 8000]),
  ai_agents: item("project", [2500, 5000, 10000]),
  automation: item("project", [800, 1500, 4000]),
  ai_tools: item("project", [900, 1500, 12000]), // website assistant … RAG assistant
  audit: item("project", [900, 2000, 3500]),
  ai_managed: item("month", [250, 350, 3000]), // Essential … Advanced, per system
  integration_care: item("month", [150, 250, 450]),
};

/** Workshops and advisory assessments (/rabotni-sreshti/<slug>), fixed packages. */
export const WORKSHOP_PRICES: Record<WorkshopKey, PriceItem> = {
  ai_strategy_discovery: item("project", [800, 1200, 1800]),
  ai_readiness_mapping: item("project", [1800, 2500, 3500]),
  agent_architecture: item("project", [2000, 3000, 4000]),
  landing_zone_assessment: item("project", [2000, 3000, 4500]),
  kubernetes_review: item("project", [1500, 2500, 4000]),
  devops_gitops_assessment: item("project", [1500, 2500, 4000]),
  observability_sre: item("project", [1800, 2500, 4000]),
  ecommerce_integration_discovery: item("project", [1000, 1500, 3000]),
  rag_data_readiness: item("project", [1800, 2500, 3500]),
  responsible_ai_review: item("project", [900, 1500, 3000]),
};

/** Care plans (/paketi), per month and per system. The report has no row for website, cloud and
 * security care: website and security follow store maintenance, cloud follows the Essential level. */
export const CARE_PLAN_PRICES: Record<CarePlanKey, PriceItem> = {
  website: item("month", [90, 180, 350]),
  commerce: item("month", [90, 180, 350]),
  automation: item("month", [150, 250, 450]),
  cloud: item("month", [250, 350, 500]),
  security: item("month", [90, 180, 350]),
};

/** AI Managed Services levels, per month and per system, without third-party costs. */
export const AI_MANAGED_PRICES: Record<"essential" | "managed" | "advanced", PriceItem> = {
  essential: item("month", [250, 350, 500]),
  managed: item("month", [700, 900, 1400]),
  advanced: item("month", [1800, 2200, 3000]),
};

export function marketFor(locale: Locale): PriceMarket {
  return locale === "bg" ? "bg" : "eu";
}

export interface PriceText {
  from: string;
  typical: string;
}

function euros(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** "от 1 350 €" / "From €1,600" and "Обикновено 2 250–3 600 €" / "Typically €2,700–€4,300" (+ "/месец"). */
export function priceText(locale: Locale, price: PriceItem): PriceText {
  const b = price[marketFor(locale)];
  const per = price.unit === "month" ? (locale === "bg" ? " на месец" : " per month") : "";
  const range = `${euros(locale, b.typical[0])}–${euros(locale, b.typical[1])}`;
  return locale === "bg"
    ? { from: `от ${euros(locale, b.from)}${per}`, typical: `Обикновено ${range}${per}` }
    : { from: `From ${euros(locale, b.from)}${per}`, typical: `Typically ${range}${per}` };
}
