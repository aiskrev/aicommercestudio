import type { Locale } from "@/i18n/config";

/**
 * Structure of a maintenance or managed-services level agreement (docs/legal-templates/).
 *
 * NO NUMBER IN THIS FILE IS A PROMISE. Response times, resolution targets, coverage hours, availability and
 * credits are `null` until they are written into an individual contract with a named customer; `null` is shown as
 * "Agreed in the individual contract". Do not put a figure here, in a page or in a marketing text unless the owner
 * has decided it and a lawyer has reviewed the contract that carries it. `sla.test.ts` fails while any value is set.
 */
export const SEVERITY_LEVELS = ["P1", "P2", "P3", "P4"] as const;
export type SeverityLevel = (typeof SEVERITY_LEVELS)[number];

/** A target expressed in clock or business hours; both are chosen per contract. */
export interface TimeTarget {
  amount: number;
  unit: "minutes" | "hours" | "business_days";
  clock: "calendar" | "business";
}

export interface SeverityTerms {
  /** What the level means in plain words (the same wording is used in the contract template). */
  definition: Record<Locale, string>;
  firstResponse: TimeTarget | null;
  resolutionTarget: TimeTarget | null;
  /** How the customer reaches us for this level. */
  channel: string | null;
}

export interface ServiceLevelSchema {
  /** Hours when the service is staffed, e.g. weekdays 09:00–18:00 Sofia time. */
  coverageHours: string | null;
  /** Agreed availability of the maintained system, if any is promised. A percentage as text, e.g. "99.5%". */
  availabilityTarget: string | null;
  maintenanceWindows: string | null;
  severity: Record<SeverityLevel, SeverityTerms>;
  /** Who is contacted, in order, when a target is missed. */
  escalation: string | null;
  /** Credits or other remedies for a missed target; none unless the contract says so. */
  remedies: string | null;
  /** Always shown: what the levels never cover, so it is not left to the fine print. */
  exclusions: Record<Locale, readonly string[]>;
}

const DEFINITIONS: Record<SeverityLevel, Record<Locale, string>> = {
  P1: {
    bg: "Критичен: системата е недостъпна или има загуба на данни, без работещо заобикаляне.",
    en: "Critical: the system is unavailable or data is being lost, with no workaround.",
  },
  P2: {
    bg: "Висок: съществена функция не работи или работи сериозно влошено; има заобикаляне.",
    en: "High: an important function does not work or is badly degraded; a workaround exists.",
  },
  P3: {
    bg: "Среден: ограничена функция не работи; основната работа не е засегната.",
    en: "Medium: a limited function does not work; the main work is not affected.",
  },
  P4: {
    bg: "Нисък: въпрос, малка корекция или искане за промяна.",
    en: "Low: a question, a small fix or a change request.",
  },
};

function empty(level: SeverityLevel): SeverityTerms {
  return { definition: DEFINITIONS[level], firstResponse: null, resolutionTarget: null, channel: null };
}

/** The schema every contract starts from. All commitments are empty. */
export const SERVICE_LEVEL_TEMPLATE: ServiceLevelSchema = {
  coverageHours: null,
  availabilityTarget: null,
  maintenanceWindows: null,
  severity: { P1: empty("P1"), P2: empty("P2"), P3: empty("P3"), P4: empty("P4") },
  escalation: null,
  remedies: null,
  exclusions: {
    bg: [
      "Проблеми, причинени от трети страни (хостинг, платформи, платежни и куриерски системи, AI доставчици).",
      "Работа извън договорения обхват и нови функции.",
      "Събития извън разумния ни контрол.",
      "Системи и достъпи, които клиентът не е осигурил.",
    ],
    en: [
      "Problems caused by third parties (hosting, platforms, payment and courier systems, AI providers).",
      "Work outside the agreed scope and new features.",
      "Events outside our reasonable control.",
      "Systems and access the customer has not provided.",
    ],
  },
};

export const AGREED_IN_CONTRACT: Record<Locale, string> = {
  bg: "Договаря се в индивидуалния договор",
  en: "Agreed in the individual contract",
};

/** What to print for any commitment: the value if a contract sets one, otherwise the fixed fallback. */
export function slaText(locale: Locale, value: string | TimeTarget | null): string {
  if (value === null) return AGREED_IN_CONTRACT[locale];
  if (typeof value === "string") return value;
  const unit = {
    minutes: locale === "bg" ? "мин." : "min",
    hours: locale === "bg" ? "ч." : "h",
    business_days: locale === "bg" ? "работни дни" : "business days",
  }[value.unit];
  const clock = value.clock === "business" ? (locale === "bg" ? "в работно време" : "in business hours") : locale === "bg" ? "астрономически" : "calendar time";
  return `${value.amount} ${unit} (${clock})`;
}
