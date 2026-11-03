import { notFound } from "next/navigation";

import { AgentLibraryBrowser, type LibraryCard } from "@/components/agents/AgentLibraryBrowser";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Alert, PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { AGENT_SLUGS, LIBRARY, agentText } from "@/lib/agent-library";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";
import { isToolAvailable, toolByKey, toolHrefs } from "@/lib/tools";

export async function generateMetadata({ params }: PageProps<"/[locale]/ai-agenti">) {
  const locale = await resolveLocale(params);
  if (!isToolAvailable(toolByKey("agents"))) return {};
  const { agentLibrary } = getContent(locale);
  return buildMetadata({ locale, title: agentLibrary.metaTitle, description: agentLibrary.metaDescription, path: routes.agentLibrary });
}

/** Agent library: a static catalogue of agent archetypes (lib/agent-library.ts) with client-side filters. */
export default async function AgentLibraryPage({ params }: PageProps<"/[locale]/ai-agenti">) {
  const locale = await resolveLocale(params);
  if (!isToolAvailable(toolByKey("agents"))) notFound();
  const content = getContent(locale);
  const { agentLibrary, teamTool } = content;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const hrefs = toolHrefs(locale);
  const cards: LibraryCard[] = LIBRARY.map((entry) => ({
    key: entry.key,
    href: href(routes.agent(AGENT_SLUGS[entry.key].bg)),
    name: agentText(content, entry.key).name,
    short: agentText(content, entry.key).short,
    purpose: agentText(content, entry.key).purpose,
    departments: entry.departments.map((d) => teamTool.departments.options[d].title),
    approval: teamTool.checkpoints[entry.approval].title,
    complexityLabel: teamTool.complexity[entry.complexity],
  }));

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.tools, path: href(routes.tools) },
          { name: agentLibrary.title, path: href(routes.agentLibrary) },
        ]}
      />
      <PageHero eyebrow={agentLibrary.eyebrow} title={agentLibrary.title} lead={agentLibrary.lead}>
        <Alert tone="info" role="note" className="mt-8 max-w-3xl">
          {agentLibrary.note}
        </Alert>
      </PageHero>
      <Section size="wide">
        <AgentLibraryBrowser
          content={agentLibrary}
          cards={cards}
          departmentNames={Object.fromEntries(Object.entries(teamTool.departments.options).map(([k, v]) => [k, v.title])) as never}
          complexityNames={teamTool.complexity}
          complexityLabel={agentLibrary.filters.complexity}
        />
      </Section>
      <CtaBand
        title={agentLibrary.ctaTitle}
        lead={agentLibrary.ctaText}
        primary={{ href: href(contactWithService("ai_agents")), label: agentLibrary.ctaButton }}
        secondary={hrefs.solution ? { href: hrefs.solution, label: agentLibrary.detail.useInBuilder } : undefined}
      />
    </>
  );
}
