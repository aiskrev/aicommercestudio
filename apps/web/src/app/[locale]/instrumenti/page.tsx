import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { JsonLd } from "@/components/seo/JsonLd";
import { ToolCard } from "@/components/tools/ToolCard";
import { type DirectoryTool, ToolsDirectory } from "@/components/tools/ToolsDirectory";
import { PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata, itemListJsonLd } from "@/lib/seo";
import { isToolAvailable, TOOL_CATEGORIES, TOOLS, toolHrefs, toolIntroHrefs, toolMinutes } from "@/lib/tools";

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
 * Interactive tools hub: the featured tools ("Start here"), then every tool with category and
 * availability filters. Availability comes from the registry (lib/tools.ts): available tools link to
 * the tool; planned tools are marked "Coming soon" and link only to an intro page that has no form
 * and no start button. Estimated time appears only for available tools that state it.
 */
export default async function ToolsPage({ params }: PageProps<"/[locale]/instrumenti">) {
  const locale = await resolveLocale(params);
  const { toolsPage, tools, home } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const hrefs = toolHrefs(locale);
  const intros = toolIntroHrefs(locale);
  const minutes = toolMinutes();
  const cardLabels = { liveBadge: tools.liveBadge, upcomingBadge: tools.upcomingBadge, ...tools.labels };

  // Registry order; a tool that is neither available nor planned with an intro (e.g. a live tool
  // switched off by its flag) is left out rather than shown as a dead card.
  const directory: DirectoryTool[] = TOOLS.flatMap((definition) => {
    const content = tools.items.find((item) => item.key === definition.key);
    const live = isToolAvailable(definition);
    if (!content || (!live && !intros[definition.key])) return [];
    return [
      {
        content,
        category: definition.category,
        status: live ? ("live" as const) : ("planned" as const),
        href: live ? hrefs[definition.key] : undefined,
        introHref: live ? undefined : intros[definition.key],
        minutes: live ? minutes[definition.key] : undefined,
      },
    ];
  });
  const featured = directory.filter((tool) => tool.status === "live" && TOOLS.find((t) => t.key === tool.content.key)?.featured);

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          toolsPage.title,
          directory.filter((tool) => tool.status === "live").map((tool) => ({ name: tool.content.title, path: tool.href! })),
        )}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.tools, path: href(routes.tools) },
        ]}
      />
      <PageHero eyebrow={toolsPage.eyebrow} title={toolsPage.title} lead={toolsPage.lead} />

      {featured.length > 0 && (
        <Section labelledBy="tools-featured-title">
          <SectionHeading id="tools-featured-title" size="sm" title={tools.hub.featuredTitle} lead={tools.hub.featuredLead} />
          <ul className="mt-8 grid gap-5 md:grid-cols-3" data-testid="tools-featured">
            {featured.map((tool) => (
              <li key={tool.content.key} className="min-w-0">
                <ToolCard tool={tool.content} href={tool.href} minutes={tool.minutes} labels={cardLabels} headingLevel={3} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section labelledBy="tools-all-title" tone="raised">
        <SectionHeading id="tools-all-title" size="sm" title={tools.hub.allTitle} lead={tools.hub.allLead} />
        <div className="mt-8">
          <ToolsDirectory tools={directory} categories={TOOL_CATEGORIES} labels={tools.hub} cardLabels={cardLabels} />
        </div>
      </Section>

      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: dict.nav.cta }}
        secondary={{ href: href(routes.services), label: dict.common.allServices }}
      />
    </>
  );
}
