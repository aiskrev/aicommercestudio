import { AdvisorTool } from "@/components/advisor/AdvisorTool";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Faq } from "@/components/sections/Faq";
import { ProcessTimeline } from "@/components/sections/ProcessTimeline";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { CheckList, Container, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { contactFormProps } from "@/lib/contact-form-props";
import { buildMetadata, faqJsonLd } from "@/lib/seo";

/** Default shown before the client reads the configured value from /api/public/advisor/status. */
const DEFAULT_RETENTION_DAYS = 30;

export async function generateMetadata({ params }: PageProps<"/[locale]/ai-automation-advisor">) {
  const locale = await resolveLocale(params);
  const { advisor } = getContent(locale);
  return buildMetadata({
    locale,
    title: advisor.metaTitle,
    description: advisor.metaDescription,
    path: routes.advisor,
  });
}

export default async function AdvisorPage({ params }: PageProps<"/[locale]/ai-automation-advisor">) {
  const locale = await resolveLocale(params);
  const { advisor } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  const contact = contactFormProps(locale);

  return (
    <>
      <JsonLd data={faqJsonLd(advisor.faq)} />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.tools, path: href(routes.tools) },
          { name: advisor.eyebrow, path: href(routes.advisor) },
        ]}
      />
      <PageHero eyebrow={advisor.eyebrow} title={advisor.title} lead={advisor.lead}>
        <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
          {advisor.facts.map((fact) => (
            <li key={fact} className="inline-flex items-center gap-2">
              <Icon name="check" className="h-4 w-4 text-cyan-300" />
              {fact}
            </li>
          ))}
        </ul>
      </PageHero>

      <section aria-label={advisor.form.title} className="py-12 sm:py-16">
        <Container className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <AdvisorTool content={advisor} contact={contact} retentionDays={DEFAULT_RETENTION_DAYS} locale={locale} />
          </div>
          <aside className="grid content-start gap-5 print:hidden">
            <section className="card rounded-2xl p-6" aria-labelledby="advisor-privacy-title">
              <h2 id="advisor-privacy-title" className="flex items-center gap-2 text-lg font-semibold">
                <Icon name="lock" className="h-5 w-5 text-cyan-300" />
                {advisor.privacyTitle}
              </h2>
              <ul className="mt-4 grid gap-3 text-sm leading-relaxed text-slate-300">
                {advisor.privacy.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            <section className="card rounded-2xl p-6" aria-labelledby="advisor-limits-title">
              <h2 id="advisor-limits-title" className="flex items-center gap-2 text-lg font-semibold">
                <Icon name="info" className="h-5 w-5 text-cyan-300" />
                {advisor.limitsTitle}
              </h2>
              <CheckList items={advisor.limits} className="mt-4 text-sm" />
            </section>
          </aside>
        </Container>
      </section>

      <Section labelledBy="advisor-steps" alt>
        <SectionHeading id="advisor-steps" title={advisor.stepsTitle} />
        <ProcessTimeline steps={advisor.steps} className="mt-14" />
      </Section>

      <Section labelledBy="advisor-faq">
        <SectionHeading id="advisor-faq" title={advisor.faqTitle} />
        <div className="mt-10 max-w-3xl">
          <Faq items={advisor.faq} />
        </div>
      </Section>
    </>
  );
}
