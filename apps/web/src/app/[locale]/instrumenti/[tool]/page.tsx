import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ReadinessAssessment } from "@/components/tools/ReadinessAssessment";
import { ToolState } from "@/components/tools/ToolUi";
import { Icon } from "@/components/ui/Icon";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import type { ServiceKey } from "@/content/types";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";
import { isToolAvailable, TOOL_SLUGS, toolByKey, toolHrefs } from "@/lib/tools";

export const dynamicParams = false;

/** Tools hosted under /instrumenti/<slug>. Only available tools (implemented + flag on) get a page. */
const HOSTED: Record<string, "readiness"> = { [TOOL_SLUGS.readiness]: "readiness" };

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return [];
  return Object.entries(HOSTED)
    .filter(([, key]) => isToolAvailable(toolByKey(key)))
    .map(([tool]) => ({ tool }));
}

function resolveTool(slug: string) {
  const key = HOSTED[slug];
  if (!key || !isToolAvailable(toolByKey(key))) return null;
  return key;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/instrumenti/[tool]">) {
  const locale = await resolveLocale(params);
  const { tool } = await params;
  if (!resolveTool(tool)) return {};
  const { readinessTool } = getContent(locale);
  return buildMetadata({
    locale,
    title: readinessTool.metaTitle,
    description: readinessTool.metaDescription,
    path: routes.tool(tool),
  });
}

export default async function ToolPage({ params }: PageProps<"/[locale]/instrumenti/[tool]">) {
  const locale = await resolveLocale(params);
  const { tool } = await params;
  if (!resolveTool(tool)) notFound();

  const { readinessTool, tools } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const serviceKeys: ServiceKey[] = ["integrations", "audit", "ai_managed", "ai_agents"];
  const services = Object.fromEntries(
    serviceKeys.map((key) => {
      const service = serviceByKey(locale, key);
      return [key, { href: href(routes.service(service.slug)), label: service.shortTitle }];
    }),
  );

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.tools, path: href(routes.tools) },
          { name: readinessTool.title, path: href(routes.tool(tool)) },
        ]}
      />
      <PageHero eyebrow={readinessTool.eyebrow} title={readinessTool.title} lead={readinessTool.lead}>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-fg-secondary">
          {readinessTool.facts.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-2">
              <Icon name="check" className="h-4 w-4 text-brand" />
              {fact}
            </li>
          ))}
        </ul>
      </PageHero>
      <Section size="narrow">
        <Suspense fallback={<ToolState kind="loading" title={tools.ui.loadingTitle} />}>
          <ReadinessAssessment
            content={readinessTool}
            ui={tools.ui}
            services={services}
            contactHref={href(contactWithService("audit"))}
            advisorHref={toolHrefs(locale).advisor}
            locale={locale}
          />
        </Suspense>
      </Section>
    </>
  );
}
