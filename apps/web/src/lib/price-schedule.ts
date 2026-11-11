import {
  ACTIVE_PRICE_SCHEDULE,
  AI_MANAGED_PRICES,
  CARE_PLAN_PRICES,
  PRICE_CURRENCY,
  PRICE_SCHEDULE_OWNER_APPROVAL,
  PRICE_SCHEDULE_VERSION,
  PRICE_TAX_TREATMENT,
  type PriceItem,
  type PriceUnit,
  SERVICE_PRICES,
  WORKSHOP_PRICES,
} from "@/lib/prices";

/**
 * The published schedule as one document: what the site shows, in the single active schedule, with the facts a
 * consumer of the numbers needs (currency, unit, approval, tax treatment, that nothing here is binding).
 *
 * lib/prices.ts stays the only place where an amount is written. This snapshot is generated from it into
 * lib/price-schedule.json and copied to apps/api/app/price_schedule.json, so the API reads the same amounts the
 * pages show (scripts/test.ps1 fails when the two files differ). Regenerate with UPDATE_PRICE_SCHEDULE=1.
 */
export type PriceGroup = "service" | "workshop" | "care_plan" | "ai_managed";

export interface ScheduleEntry {
  unit: PriceUnit;
  from: number;
  typical: [number, number];
}

export interface PriceScheduleSnapshot {
  version: string;
  currency: string;
  schedule: string;
  owner_approval: "pending" | "approved";
  tax_treatment: string;
  /** Published prices are indicative: only a written quote is binding. */
  binding: false;
  /** Never part of a published amount. */
  excluded_costs: string[];
  groups: Record<PriceGroup, Record<string, ScheduleEntry>>;
}

/** Third-party costs that no published amount includes (dict.prices.note says the same to visitors). */
export const EXCLUDED_COSTS = ["hosting", "licences", "ai_model_usage"] as const;

function entries(prices: Record<string, PriceItem>): Record<string, ScheduleEntry> {
  return Object.fromEntries(
    Object.entries(prices).map(([key, price]) => {
      const band = price[ACTIVE_PRICE_SCHEDULE];
      return [key, { unit: price.unit, from: band.from, typical: [band.typical[0], band.typical[1]] }];
    }),
  );
}

export const PRICE_GROUPS: Record<PriceGroup, Record<string, PriceItem>> = {
  service: SERVICE_PRICES,
  workshop: WORKSHOP_PRICES,
  care_plan: CARE_PLAN_PRICES,
  ai_managed: AI_MANAGED_PRICES,
};

export function priceScheduleSnapshot(): PriceScheduleSnapshot {
  return {
    version: PRICE_SCHEDULE_VERSION,
    currency: PRICE_CURRENCY,
    schedule: ACTIVE_PRICE_SCHEDULE,
    owner_approval: PRICE_SCHEDULE_OWNER_APPROVAL,
    tax_treatment: PRICE_TAX_TREATMENT,
    binding: false,
    excluded_costs: [...EXCLUDED_COSTS],
    groups: {
      service: entries(PRICE_GROUPS.service),
      workshop: entries(PRICE_GROUPS.workshop),
      care_plan: entries(PRICE_GROUPS.care_plan),
      ai_managed: entries(PRICE_GROUPS.ai_managed),
    },
  };
}
