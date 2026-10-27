import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ReadinessAssessment } from "@/components/tools/ReadinessAssessment";
import { OpportunityFinder } from "@/components/tools/finder/OpportunityFinder";
import { RoiCalculator } from "@/components/tools/roi/RoiCalculator";
import { AiTeamTool } from "@/components/tools/team/AiTeamTool";
import { ToolState } from "@/components/tools/ToolUi";
import { Icon } from "@/components/ui/Icon";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import type { ServiceKey } from "@/content/types";
import { type Locale, isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { ACTION_SERVICE } from "@/lib/readiness";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";
import { isToolAvailable, TOOL_SLUGS, toolByKey, toolHrefs } from "@/lib/tools";

export const dynamicParams = false;

type HostedTool = "readiness" | "team" | "roi" | "finder";

/** Tools hosted under /instrumenti/<slug>. Only available tools (implemented + flag on) get a page. */
const HOSTED: Record<string, HostedTool> = {
  [TOOL_SLUGS.readiness]: "readiness",
  [TOOL_SLUGS.team]: "team",
  [TOOL_SLUGS.roi]: "roi",
  [TOOL_SLUGS.finder]: "finder",
};

/** Services each hosted tool can link to from its result. */
const TOOL_SERVICES: Record<HostedTool, ServiceKey[]> = {
  readiness: [...new Set(Object.values(ACTION_SERVICE))],
  team: ["ai_agents", "integrations", "ai_managed"],
  roi: [],
  finder: [],
};

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return Object.entries(HOSTED)
    .filter(([, key]) => isToolAvailable(toolByKey(key)))
    .map(([tool]) => ({ tool }));
}

function resolveTool(slug: string): HostedTool | null {
  const key = HOSTED[slug];
  if (!key || !isToolAvailable(toolByKey(key))) return null;
  return key;
}

function toolContent(locale: Locale, key: HostedTool) {
  const content = getContent(locale);
  const pages = { readiness: content.readinessTool, team: content.teamTool, roi: content.roiTool, finder: content.finderTool };
  return pages[key];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/instrumenti/[tool]">) {
  const locale = await resolveLocale(params);
  const { tool } = await params;
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
  const key = resolveTool(tool);
  if (!key) notFound();

  const { readinessTool, teamTool, roiTool, finderTool, tools } = getContent(locale);
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
          />
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
            />
          </Suspense>
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
