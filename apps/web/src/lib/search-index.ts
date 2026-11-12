import { getContent, isIndexableCategory } from "@/content";
import { type Locale, localizePath } from "@/i18n/config";
import { AGENT_SLUGS, agentText, LIBRARY_KEYS } from "@/lib/agent-library";
import { getCatalogue } from "@/lib/catalogue";
import { isDomainPublished } from "@/lib/domains";
import { PATTERN_KEYS, PATTERN_SLUGS, SCENARIO_KEYS, SCENARIO_SLUGS } from "@/lib/reference";
import { demoTexts } from "@/i18n/demos";
import { DEMO_KEYS, DEMO_SLUGS } from "@/lib/demo-slugs";
import { routes } from "@/lib/routes";
import type { SearchEntry, SearchType } from "@/lib/search";
import { isToolAvailable, TOOLS } from "@/lib/tools";
import { WORKSHOP_KEYS, WORKSHOP_SLUGS } from "@/lib/workshops";

/** One searchable page: title and a short description shown in the result, `text` only for matching. */
function entry(locale: Locale, type: SearchType, path: string, title: string, description: string, text: string[] = []): SearchEntry {
  return { type, url: localizePath(locale, path), title, description, text: text.filter(Boolean).join(" ") };
}

/**
 * Everything a visitor can open and that the sitemap lists, with its title and description, for one language.
 * Same sources as `app/sitemap.ts`, so the search never offers a page the site itself does not publish
 * (draft legal pages, thin topic pages and tools that are not live stay out).
 */
export async function buildSearchIndex(locale: Locale): Promise<SearchEntry[]> {
  const content = getContent(locale);
  // Prices are published on these pages, so people searching for them should land here.
  const priceWords = locale === "bg" ? "цена цени ценоразпис" : "price prices pricing cost";
  const out: SearchEntry[] = [];

  const page = (path: string, title: string, description: string, text: string[] = []) =>
    out.push(entry(locale, "page", path, title, description, text));

  page(routes.services, content.servicesPage.title, content.servicesPage.lead);
  page(routes.aiSolutions, content.aiSolutions.title, content.aiSolutions.lead);
  page(routes.tools, content.toolsPage.title, content.toolsPage.lead);
  page(routes.pricing, content.pricingPage.title, content.pricingPage.lead, [priceWords]);
  page(routes.carePlans, content.carePlans.title, content.carePlans.lead, [priceWords]);
  page(
    routes.projectPackages,
    content.projectPackages.title,
    content.projectPackages.lead,
    [priceWords, ...Object.values(content.projectPackages.packages).map((item) => item.name)],
  );
  page(routes.demoCentre, content.demoCentre.title, content.demoCentre.lead);
  for (const [path, hub] of [[routes.websites, content.v5.websites], [routes.ecommerce, content.v5.ecommerce]] as const) {
    page(path, hub.title, hub.lead, [priceWords, hub.breadcrumb, ...hub.offers.map((offer) => offer.name)]);
  }
  for (const key of DEMO_KEYS) page(routes.demoScenario(DEMO_SLUGS[key].bg), demoTexts[locale].scenarios[key].title, demoTexts[locale].scenarios[key].lead);
  page(routes.industries, content.industries.title, content.industries.lead, content.industries.segments.map((s) => s.title));
  page(routes.process, content.processPage.title, content.processPage.lead, content.processPage.steps.map((s) => s.title));
  page(routes.about, content.about.title, content.about.lead);
  page(routes.founder, content.founder.profile.heading, content.founder.profile.subheading);
  page(routes.insights, content.insightsPage.title, content.insightsPage.lead);
  page(routes.workshops, content.workshops.page.title, content.workshops.page.lead);
  page(routes.scenarios, content.reference.scenarios.title, content.reference.scenarios.lead);
  page(routes.patterns, content.reference.patterns.title, content.reference.patterns.lead);
  page(routes.contact, locale === "bg" ? "Контакти и заявка за оферта" : "Contact and quote requests", content.home.finalCta.lead);

  for (const service of content.services) {
    out.push(
      entry(locale, "service", routes.service(service.slug), service.title, service.summary, [
        service.shortTitle,
        priceWords,
        service.intro,
        ...service.capabilities.map((c) => c.title),
        ...service.deliverables,
      ]),
    );
  }

  for (const domain of content.domains.filter((d) => isDomainPublished(d.key))) {
    out.push(
      entry(locale, "service", routes.service(domain.slug), domain.name, domain.summary, [
        domain.positioning,
        ...Object.values(domain.families).map((f) => f.title),
      ]),
    );
  }

  const catalogue = await getCatalogue(locale);
  for (const item of catalogue.entries.filter((e) => e.origin === "catalogue")) {
    out.push(entry(locale, "service", routes.service(item.slug), item.name, item.summary, [item.shortName ?? ""]));
  }

  for (const key of WORKSHOP_KEYS) {
    const text = content.workshops.texts[key];
    out.push(entry(locale, "workshop", routes.workshop(WORKSHOP_SLUGS[key].bg), text.title, text.summary, [priceWords, ...text.audience, ...text.problems]));
  }

  for (const tool of TOOLS.filter(isToolAvailable)) {
    const item = content.tools.items.find((t) => t.key === tool.key);
    if (item) out.push(entry(locale, "tool", tool.path, item.title, item.description));
  }

  for (const key of LIBRARY_KEYS) {
    const text = agentText(content, key);
    out.push(entry(locale, "agent", routes.agent(AGENT_SLUGS[key].bg), text.name, text.short, [text.purpose]));
  }

  for (const key of SCENARIO_KEYS) {
    const text = content.reference.scenarioTexts[key];
    out.push(entry(locale, "reference", routes.scenario(SCENARIO_SLUGS[key].bg), text.title, text.summary, [text.problem]));
  }
  for (const key of PATTERN_KEYS) {
    const text = content.reference.patternTexts[key];
    out.push(entry(locale, "reference", routes.pattern(PATTERN_SLUGS[key].bg), text.title, text.summary, [text.description]));
  }

  for (const article of content.articles) {
    out.push(entry(locale, "article", routes.article(article.slug), article.title, article.description));
  }
  for (const category of content.editorialCategories.filter((c) => isIndexableCategory(locale, c.key))) {
    out.push(entry(locale, "article", routes.insightsCategory(category.slug), category.name, category.description));
  }

  // One entry per page: the first one wins (a tool that has its own page is listed as the tool).
  const seen = new Set<string>();
  return out.filter((item) => !seen.has(item.url) && seen.add(item.url));
}
