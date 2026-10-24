import { AdvisorPromo } from "@/components/advisor/AdvisorPromo";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { ServiceMotif } from "@/components/sections/ServiceMotif";
import { EditorialSplit } from "@/components/ui/patterns";
import { ButtonLink, CheckList, cx, FeatureIndex, FeatureMatrix, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/ai-resheniya">) {
  const locale = await resolveLocale(params);
  const { aiSolutions } = getContent(locale);
  return buildMetadata({
    locale,
    title: aiSolutions.metaTitle,
    description: aiSolutions.metaDescription,
    path: routes.aiSolutions,
  });
}

const riskTone: Record<string, string> = {
  low: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  high: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  critical: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
};

export default async function AiSolutionsPage({ params }: PageProps<"/[locale]/ai-resheniya">) {
  const locale = await resolveLocale(params);
  const { aiSolutions: page, advisor } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const aiTools = serviceByKey(locale, "ai_tools");
  const managedService = serviceByKey(locale, "ai_managed");

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.aiSolutions, path: href(routes.aiSolutions) },
        ]}
      />
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} />

      <Section>
        <FeatureIndex items={page.types} />
        <AdvisorPromo promo={advisor.promo} href={href(routes.advisor)} className="mt-10" />
      </Section>

      <Section labelledBy="ai-principles" tone="light">
        <SectionHeading id="ai-principles" title={page.principlesTitle} />
        <FeatureMatrix items={page.principles} className="mt-10" />
      </Section>

      <Section labelledBy="ai-approval">
        <SectionHeading id="ai-approval" title={page.approvalTitle} lead={page.approvalLead} />
        <div className="card mt-10 overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{page.approvalTitle}</caption>
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium">{page.approvalHeaders.action}</th>
                <th scope="col" className="px-5 py-4 font-medium">{page.approvalHeaders.risk}</th>
                <th scope="col" className="hidden px-5 py-4 font-medium sm:table-cell">{page.approvalHeaders.control}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {page.approvalRows.map((row) => (
                <tr key={row.action}>
                  <th scope="row" className="px-5 py-4 font-medium text-white">
                    {row.action}
                    <span className="mt-1 block text-xs font-normal text-slate-400 sm:hidden">{row.control}</span>
                  </th>
                  <td className="px-5 py-4">
                    <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", riskTone[row.level])}>
                      {row.risk}
                    </span>
                  </td>
                  <td className="hidden px-5 py-4 text-slate-300 sm:table-cell">{row.control}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section labelledBy="ai-lifecycle" alt>
        <SectionHeading id="ai-lifecycle" title={page.lifecycleTitle} />
        <ProcessTimeline steps={page.lifecycle} className="mt-14" />
      </Section>

      <Section labelledBy="ai-managed-title">
        <div className="card card-accent grid gap-6 p-8 sm:p-10 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
          <ServiceMotif service="ai_managed" className="h-20 w-28" />
          <div>
            <h2 id="ai-managed-title" className="t-h2 text-2xl sm:text-3xl">
              {page.managed.title}
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-fg-secondary">{page.managed.lead}</p>
          </div>
          <ButtonLink href={href(routes.service(managedService.slug))} icon="arrowRight">
            {page.managed.cta}
          </ButtonLink>
        </div>
      </Section>

      <Section labelledBy="ai-not-for" alt>
        <EditorialSplit aside={<SectionHeading id="ai-not-for" title={page.notForTitle} />}>
          <CheckList items={page.notFor} />
        </EditorialSplit>
      </Section>

      <CtaBand
        title={dict.service.ctaTitle}
        lead={dict.service.ctaLead}
        primary={{ href: href(contactWithService("ai_tools")), label: dict.nav.cta }}
        secondary={{ href: href(routes.service(aiTools.slug)), label: aiTools.shortTitle }}
      />
    </>
  );
}
