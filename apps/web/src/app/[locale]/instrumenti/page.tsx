import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ToolsPreview } from "@/components/home/ToolsPreview";
import { CtaBand } from "@/components/sections/CtaBand";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";
import { toolHrefs } from "@/lib/tools";

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
 * Interactive tools hub. Lists the tools from the shared catalog: live tools link to their page,
 * planned tools are shown as "in preparation" without links (lib/tools.ts decides which is which).
 */
export default async function ToolsPage({ params }: PageProps<"/[locale]/instrumenti">) {
  const locale = await resolveLocale(params);
  const { toolsPage, tools, advisor, home } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.tools, path: href(routes.tools) },
        ]}
      />
      <PageHero eyebrow={toolsPage.eyebrow} title={toolsPage.title} lead={toolsPage.lead} />

      <Section>
        <ToolsPreview catalog={tools} hrefs={toolHrefs(locale)} showcase={advisor.showcase} headingLevel={2} />
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
