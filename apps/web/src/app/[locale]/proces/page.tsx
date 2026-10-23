import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Icon } from "@/components/ui/Icon";
import { CheckList, PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/proces">) {
  const locale = await resolveLocale(params);
  const { processPage } = getContent(locale);
  return buildMetadata({
    locale,
    title: processPage.metaTitle,
    description: processPage.metaDescription,
    path: routes.process,
  });
}

export default async function ProcessPage({ params }: PageProps<"/[locale]/proces">) {
  const locale = await resolveLocale(params);
  const { processPage: page, home } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.process, path: href(routes.process) },
        ]}
      />
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} />

      <Section>
        <ol className="relative grid gap-6">
          {page.steps.map((step, index) => (
            <li key={step.title} className="glass grid gap-6 rounded-2xl p-6 sm:p-8 lg:grid-cols-[auto_1fr_0.8fr]">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-400/10 font-display font-semibold text-cyan-200">
                {index + 1}
              </span>
              <div>
                <h2 className="text-xl font-semibold">{step.title}</h2>
                <p className="mt-1 text-slate-400">{step.summary}</p>
                <CheckList items={step.details} className="mt-5" />
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 lg:self-start">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Резултат</p>
                <p className="mt-2 text-slate-200">{step.outcome}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="needs-title" className="bg-ink-900/50">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 id="needs-title" className="text-3xl font-semibold">
            {page.needsTitle}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {page.needs.map((need) => (
              <li key={need} className="glass flex gap-3 rounded-xl p-4 text-slate-200">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
                {need}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: dict.nav.cta }}
      />
    </>
  );
}
