import { AdvisorPromo } from "@/components/advisor/AdvisorPromo";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { CheckList, FeatureCard, PageHero, Section, SectionHeading, cx } from "@/components/ui/primitives";
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
  Нисък: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  Висок: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  Критичен: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
};

export default async function AiSolutionsPage({ params }: PageProps<"/[locale]/ai-resheniya">) {
  const locale = await resolveLocale(params);
  const { aiSolutions: page, advisor } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const aiTools = serviceByKey(locale, "ai_tools");

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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {page.types.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
        <AdvisorPromo promo={advisor.promo} href={href(routes.advisor)} className="mt-10" />
      </Section>

      <Section labelledBy="ai-principles" alt>
        <SectionHeading id="ai-principles" title={page.principlesTitle} />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {page.principles.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>

      <Section labelledBy="ai-approval">
        <SectionHeading id="ai-approval" title={page.approvalTitle} lead={page.approvalLead} />
        <div className="card mt-10 overflow-hidden rounded-2xl">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{page.approvalTitle}</caption>
            <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium">Действие</th>
                <th scope="col" className="px-5 py-4 font-medium">Риск</th>
                <th scope="col" className="hidden px-5 py-4 font-medium sm:table-cell">Контрол</th>
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
                    <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", riskTone[row.risk])}>
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

      <Section labelledBy="ai-not-for">
        <div className="card rounded-3xl p-8 sm:p-10">
          <h2 id="ai-not-for" className="text-2xl font-semibold">
            {page.notForTitle}
          </h2>
          <CheckList items={page.notFor} className="mt-6" />
        </div>
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
