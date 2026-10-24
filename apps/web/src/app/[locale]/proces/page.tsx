import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Icon } from "@/components/ui/Icon";
import { EditorialSplit } from "@/components/ui/patterns";
import { CheckList, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
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
            <li
              key={step.title}
              className="card grid gap-6 p-6 sm:p-8 lg:grid-cols-[3rem_minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-8"
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-brand/35 bg-brand/[0.08] font-mono text-sm font-medium text-brand"
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <h2 className="t-h3-lg">{step.title}</h2>
                <p className="mt-2 text-fg-muted">{step.summary}</p>
                <CheckList items={step.details} className="mt-5" />
              </div>
              <div className="rounded-[var(--radius-md)] border border-line-subtle bg-surface-page p-5 lg:self-start">
                <p className="t-label">{dict.ui.processResult}</p>
                <p className="mt-2 text-fg-secondary">{step.outcome}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="needs-title" alt>
        <EditorialSplit aside={<SectionHeading id="needs-title" title={page.needsTitle} />}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {page.needs.map((need) => (
              <li key={need} className="card flex gap-3 p-4 text-fg-secondary">
                <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                {need}
              </li>
            ))}
          </ul>
        </EditorialSplit>
      </Section>

      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: dict.nav.cta }}
      />
    </>
  );
}
