import { getContent } from "@/content";
import { type Locale, localizePath } from "@/i18n/config";
import { domainHubLinks } from "@/lib/domain-links";
import type { DomainKey } from "@/lib/domains";
import { PATTERN_SLUGS, type PatternKey, SCENARIO_SLUGS, type ScenarioKey } from "@/lib/reference";
import { routes } from "@/lib/routes";
import { type ToolKey, toolHrefs } from "@/lib/tools";

/** Contextual links of the reference pages; unpublished hubs and unavailable tools are left out. */
export function serviceLinks(locale: Locale, domains: DomainKey[]) {
  const hubs = domainHubLinks(locale);
  return domains.flatMap((key) => (hubs[key] ? [hubs[key]!] : []));
}

export function assessmentLinks(locale: Locale, keys: ToolKey[]) {
  const hrefs = toolHrefs(locale);
  const items = getContent(locale).tools.items as { key: string; title: string }[];
  return keys.flatMap((key) => {
    const href = hrefs[key];
    const title = items.find((i) => i.key === key)?.title;
    return href && title ? [{ href, label: title }] : [];
  });
}

export function patternLinks(locale: Locale, keys: PatternKey[]) {
  const texts = getContent(locale).reference.patternTexts;
  return keys.map((key) => ({ href: localizePath(locale, routes.pattern(PATTERN_SLUGS[key].bg)), label: texts[key].title }));
}

export function scenarioLinks(locale: Locale, keys: ScenarioKey[]) {
  const texts = getContent(locale).reference.scenarioTexts;
  return keys.map((key) => ({ href: localizePath(locale, routes.scenario(SCENARIO_SLUGS[key].bg)), label: texts[key].title }));
}
