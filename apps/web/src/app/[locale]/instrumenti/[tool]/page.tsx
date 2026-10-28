import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ReadinessAssessment } from "@/components/tools/ReadinessAssessment";
import { ReadinessMethodology } from "@/components/tools/ReadinessMethodology";
import { EngineAssessment } from "@/components/tools/assessment/EngineAssessment";
import { OpportunityFinder } from "@/components/tools/finder/OpportunityFinder";
import { RoiCalculator } from "@/components/tools/roi/RoiCalculator";
import { SolutionBuilder } from "@/components/tools/solution/SolutionBuilder";
import { AiTeamTool } from "@/components/tools/team/AiTeamTool";
import { ToolIntro } from "@/components/tools/ToolIntro";
import { ToolState } from "@/components/tools/ToolUi";
import { Icon } from "@/components/ui/Icon";
import { PageHero, Section } from "@/components/ui/primitives";
import { domainByKey, getContent, serviceByKey } from "@/content";
import type { ServiceKey } from "@/content/types";
import { type Locale, isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { AGENT_KEYS } from "@/lib/ai-team";
import { AGENT_SLUGS } from "@/lib/agent-library";
import { ACTION_SERVICE } from "@/lib/readiness";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";
import { domainHubLinks } from "@/lib/domain-links";
import { type DomainKey, domainDefinition } from "@/lib/domains";
import { TOOL_PAGE_SLUGS } from "@/lib/tool-slugs";
import { isToolAvailable, isToolPlanned, TOOL_SLUGS, toolByKey, toolHrefs, TOOLS, type ToolKey, toolMinutes } from "@/lib/tools";

export const dynamicParams = false;

type HostedTool = "readiness" | "team" | "roi" | "finder" | "solution" | "cloud_maturity" | "devops_maturity" | "observability";

/** Tools hosted under /instrumenti/<slug>. Only available tools (implemented + flag on) get a page. */
const HOSTED: Record<string, HostedTool> = {
  [TOOL_SLUGS.readiness]: "readiness",
  [TOOL_SLUGS.team]: "team",
  [TOOL_SLUGS.roi]: "roi",
  [TOOL_SLUGS.finder]: "finder",
  [TOOL_SLUGS.solution]: "solution",
  [TOOL_SLUGS.cloud_maturity]: "cloud_maturity",
  [TOOL_SLUGS.devops_maturity]: "devops_maturity",
  [TOOL_SLUGS.observability]: "observability",
};

/** Engine assessments: the API key behind each tool, and how long a saved result is kept (ASSESSMENT_RETENTION_DAYS). */
const ENGINE = {
  cloud_maturity: "cloud_platform",
  devops_maturity: "devops_delivery",
  observability: "observability_reliability",
} as const;
const ASSESSMENT_RETENTION_DAYS = 90;

/** Services each hosted tool can link to from its result. */
const TOOL_SERVICES: Record<HostedTool, ServiceKey[]> = {
  readiness: [...new Set(Object.values(ACTION_SERVICE))],
  team: ["ai_agents", "integrations", "ai_managed"],
  roi: [],
  finder: ["automation", "ai_tools", "ai_agents", "integrations", "audit"],
  solution: ["ai_agents", "integrations", "automation", "ai_tools", "ai_managed", "audit"],
  cloud_maturity: [],
  devops_maturity: [],
  observability: [],
};

/**
 * Planned tools get an intro page under their final slug ("Coming soon": no form, no start button,
 * `noindex` and not in the sitemap until the tool is live).
 */
const PLANNED_INTROS: Record<string, ToolKey> = Object.fromEntries(
  TOOLS.filter(isToolPlanned).map((tool) => [TOOL_PAGE_SLUGS[tool.key].bg, tool.key]),
);

/** Live tools offered on an intro page as alternatives that work today. */
const INTRO_ALTERNATIVES: ToolKey[] = ["readiness", "advisor"];

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return [
    ...Object.entries(HOSTED)
      .filter(([, key]) => isToolAvailable(toolByKey(key)))
      .map(([tool]) => ({ tool })),
    ...Object.keys(PLANNED_INTROS).map((tool) => ({ tool })),
  ];
}

function plannedIntro(locale: Locale, slug: string) {
  const key = PLANNED_INTROS[slug];
  if (!key) return null;
  const content = getContent(locale).tools.items.find((item) => item.key === key);
  return content ? { key, content } : null;
}

function resolveTool(slug: string): HostedTool | null {
  const key = HOSTED[slug];
  if (!key || !isToolAvailable(toolByKey(key))) return null;
  return key;
}

/** Published domain hubs (they list the workshops and consultant-led assessments). */
function hubLinks(locale: Locale, domains: DomainKey[]): { href: string; label: string }[] {
  return domains
    .filter((domain) => domainDefinition(domain).published)
    .map((domain) => {
      const hub = domainByKey(locale, domain);
      return { href: localizePath(locale, routes.service(hub.slug)), label: hub.name };
    });
}

function toolContent(locale: Locale, key: HostedTool) {
  const content = getContent(locale);
  const pages = {
    readiness: content.readinessTool,
    team: content.teamTool,
    roi: content.roiTool,
    finder: content.finderTool,
    solution: content.solutionTool,
    cloud_maturity: content.engineeringTool.pages.cloud_maturity,
    devops_maturity: content.engineeringTool.pages.devops_maturity,
    observability: content.engineeringTool.pages.observability,
  };
  return pages[key];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/instrumenti/[tool]">) {
  const locale = await resolveLocale(params);
  const { tool } = await params;
  const intro = plannedIntro(locale, tool);
  if (intro) {
    return buildMetadata({
      locale,
      title: intro.content.metaTitle ?? intro.content.title,
      description: intro.content.metaDescription ?? intro.content.description,
      path: routes.tool(tool),
      noindex: true,
    });
  }
  const key = resolveTool(tool);
  if (!key) return {};
  const content = toolContent(locale, key);
  return buildMetadata({
    locale,
    title: content.metaTitle,
    description: content.metaDescription,
    path: routes.tool(tool),
  });
}

export default async function ToolPage({ params }: PageProps<"/[locale]/instrumenti/[tool]">) {
  const locale = await resolveLocale(params);
  const { tool } = await params;
  const intro = plannedIntro(locale, tool);
  if (intro) return <PlannedToolPage locale={locale} slug={tool} tool={intro.content} toolKey={intro.key} />;
  const key = resolveTool(tool);
  if (!key) notFound();

  const { readinessTool, teamTool, roiTool, finderTool, solutionTool, agentLibrary, tools, engineeringTool } = getContent(locale);
  const hrefs = toolHrefs(locale);
  const page = toolContent(locale, key);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const services = Object.fromEntries(
    TOOL_SERVICES[key].map((service) => {
      const entry = serviceByKey(locale, service);
      return [service, { href: href(routes.service(entry.slug)), label: entry.shortTitle }];
    }),
  );
  const loading = <ToolState kind="loading" title={tools.ui.loadingTitle} />;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.tools, path: href(routes.tools) },
          { name: page.title, path: href(routes.tool(tool)) },
        ]}
      />
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead}>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-fg-secondary">
          {page.facts.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-2">
              <Icon name="check" className="h-4 w-4 text-brand" />
              {fact}
            </li>
          ))}
        </ul>
      </PageHero>
      {key === "roi" && (
        <Section size="wide">
          <Suspense fallback={loading}>
            <RoiCalculator
              content={roiTool}
              ui={tools.ui}
              locale={locale}
              contactHref={href(contactWithService("automation"))}
              finderHref={hrefs.finder}
              teamHref={hrefs.team}
            />
          </Suspense>
        </Section>
      )}
      {key === "finder" && (
        <Section size="wide">
          <OpportunityFinder
            content={finderTool}
            ui={tools.ui}
            locale={locale}
            areaNames={Object.fromEntries(Object.entries(teamTool.departments.options).map(([k, v]) => [k, v.title])) as never}
            agentNames={Object.fromEntries(Object.entries(teamTool.agents).map(([k, v]) => [k, v.name])) as never}
            contactHref={href(contactWithService("automation"))}
            roiHref={hrefs.roi}
            teamHref={hrefs.team}
            advisorHref={hrefs.advisor}
            services={services}
            workshops={hubLinks(locale, ["ai_agents_automation", "advisory_enablement"])}
          />
        </Section>
      )}
      {key === "solution" && (
        <Section size="wide">
          <Suspense fallback={loading}>
            <SolutionBuilder
              content={solutionTool}
              team={teamTool}
              library={agentLibrary}
              ui={tools.ui}
              services={services}
              contactHref={href(contactWithService("ai_agents"))}
              libraryHref={hrefs.agents}
              agentHrefs={hrefs.agents ? Object.fromEntries(AGENT_KEYS.map((a) => [a, href(routes.agent(AGENT_SLUGS[a].bg))])) : undefined}
              locale={locale}
            />
          </Suspense>
        </Section>
      )}
      {key === "readiness" && (
        <Section size="narrow">
          <Suspense fallback={loading}>
            <ReadinessAssessment
              content={readinessTool}
              ui={tools.ui}
              services={services}
              contactHref={href(contactWithService("audit"))}
              advisorHref={hrefs.advisor}
              privacyHref={href(routes.privacy)}
              locale={locale}
              workshops={hubLinks(locale, ["ai_strategy", "advisory_enablement"])}
            />
          </Suspense>
        </Section>
      )}
      {key === "readiness" && (
        <Section tone="raised" labelledBy="readiness-methodology-title">
          <ReadinessMethodology content={readinessTool} />
        </Section>
      )}
      {(key === "cloud_maturity" || key === "devops_maturity" || key === "observability") && (
        <Section size="narrow">
          <EngineAssessment
            assessment={ENGINE[key]}
            tool={key}
            content={engineeringTool}
            locale={locale}
            domainLinks={domainHubLinks(locale)}
            contactHref={href(contactWithService(domainDefinition(ENGINE[key] === "cloud_platform" ? "cloud_platform" : "devops_sre").contactService))}
            privacyHref={href(routes.privacy)}
            retentionDays={ASSESSMENT_RETENTION_DAYS}
          />
        </Section>
      )}
      {key === "team" && (
        <Section size="wide">
          <Suspense fallback={loading}>
            <AiTeamTool
              content={teamTool}
              ui={tools.ui}
              services={services}
              contactHref={href(contactWithService("ai_agents"))}
              advisorHref={hrefs.advisor}
              roiHref={hrefs.roi}
              privacyHref={href(routes.privacy)}
              locale={locale}
            />
          </Suspense>
        </Section>
      )}
    </>
  );
}

function PlannedToolPage({
  locale,
  slug,
  tool,
  toolKey,
}: {
  locale: Locale;
  slug: string;
  tool: ReturnType<typeof getContent>["tools"]["items"][number];
  toolKey: ToolKey;
}) {
  const { tools } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const hrefs = toolHrefs(locale);
  const minutes = toolMinutes();
  const definition = toolByKey(toolKey);
  const domain = definition.domain && domainDefinition(definition.domain).published ? domainByKey(locale, definition.domain) : undefined;
  const contactService = definition.domain ? domainDefinition(definition.domain).contactService : "audit";
  const alternatives = INTRO_ALTERNATIVES.flatMap((key) => {
    const content = tools.items.find((item) => item.key === key);
    return content && hrefs[key] ? [{ tool: content, href: hrefs[key]!, minutes: minutes[key] }] : [];
  });

  return (
    <ToolIntro
      tool={tool}
      breadcrumbs={[
        { name: dict.common.home, path: href(routes.home) },
        { name: dict.nav.tools, path: href(routes.tools) },
        { name: tool.title, path: href(routes.tool(slug)) },
      ]}
      badge={tools.upcomingBadge}
      labels={tools.intro}
      audienceLabel={tools.labels.audience}
      contactHref={href(contactWithService(contactService))}
      domain={domain ? { name: domain.name, href: href(routes.service(domain.slug)) } : undefined}
      alternatives={alternatives}
      cardLabels={{ liveBadge: tools.liveBadge, upcomingBadge: tools.upcomingBadge, ...tools.labels }}
    />
  );
}
