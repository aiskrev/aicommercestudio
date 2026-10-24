import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { ToolCard } from "@/components/tools/ToolCard";
import { PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";
import { toolHrefs, toolMinutes } from "@/lib/tools";

export async function generateMetadata({ params }: PageProps<"/[locale]/instrumenti">) {
  const locale = await resolveLocale(params);
  const { toolsPage } = getContent(locale);
  return buildMetadata({
    locale,
    title: toolsPage.metaTitle,
    description: toolsPage.metaDescription,
    path: routes.tools,
  });
}

/**
 * Interactive tools hub. Availability comes from the registry (lib/tools.ts): implemented tools
 * whose feature flag is on are linked; every other tool is listed under "in preparation" with no
 * link, so visitors are never routed into an unfinished workflow.
 */
export default async function ToolsPage({ params }: PageProps<"/[locale]/instrumenti">) {
  const locale = await resolveLocale(params);
  const { toolsPage, tools, home } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const hrefs = toolHrefs(locale);
  const minutes = toolMinutes();
  const labels = { liveBadge: tools.liveBadge, upcomingBadge: tools.upcomingBadge, ...tools.labels };
  const live = tools.items.filter((tool) => hrefs[tool.key]);
  const upcoming = tools.items.filter((tool) => !hrefs[tool.key]);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.tools, path: href(routes.tools) },
        ]}
      />
      <PageHero eyebrow={toolsPage.eyebrow} title={toolsPage.title} lead={toolsPage.lead} />

      <Section labelledBy="tools-live-title">
        <SectionHeading id="tools-live-title" size="sm" title={tools.liveTitle} />
        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {live.map((tool) => (
            <li key={tool.key}>
              <ToolCard tool={tool} href={hrefs[tool.key]} minutes={minutes[tool.key]} labels={labels} headingLevel={3} />
            </li>
          ))}
        </ul>
      </Section>

      {upcoming.length > 0 && (
        <Section labelledBy="tools-upcoming-title" tone="raised">
          <SectionHeading id="tools-upcoming-title" size="sm" title={tools.upcomingTitle} lead={tools.upcomingLead} />
          <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {upcoming.map((tool) => (
              <li key={tool.key}>
                <ToolCard tool={tool} labels={labels} headingLevel={3} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: dict.nav.cta }}
        secondary={{ href: href(routes.services), label: dict.common.allServices }}
      />
    </>
  );
}
