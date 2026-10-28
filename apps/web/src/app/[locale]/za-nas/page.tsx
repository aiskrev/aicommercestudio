import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { FounderPortrait } from "@/components/sections/Founder";
import { Icon } from "@/components/ui/Icon";
import { EditorialSplit } from "@/components/ui/patterns";
import { ButtonLink, FeatureMatrix, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/za-nas">) {
  const locale = await resolveLocale(params);
  const { about } = getContent(locale);
  return buildMetadata({ locale, title: about.metaTitle, description: about.metaDescription, path: routes.about });
}

export default async function AboutPage({ params }: PageProps<"/[locale]/za-nas">) {
  const locale = await resolveLocale(params);
  const { about: page, home, founder } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.about, path: href(routes.about) },
        ]}
      />
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} />

      <Section labelledBy="mission-title">
        <EditorialSplit aside={<SectionHeading id="mission-title" title={page.mission.title} />}>
          <div className="measure grid gap-5 text-lg leading-relaxed text-fg-secondary">
            {page.mission.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </EditorialSplit>
      </Section>

      <Section tone="light">
        <FeatureMatrix items={page.principles} />
      </Section>

      <Section labelledBy="leadership-title" tone="raised">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:gap-10">
          <FounderPortrait alt={founder.portraitAlt} sizes="(min-width: 768px) 12rem, 10rem" className="aspect-[4/5] w-40 md:w-full" />
          <div className="min-w-0">
            <h2 id="leadership-title" className="t-h3-lg">
              {founder.aboutCard.title}
            </h2>
            <p className="mt-1 font-medium text-fg-secondary">
              {founder.name} · {founder.title}
            </p>
            <p className="measure mt-3 leading-relaxed text-fg-muted">{founder.aboutCard.text}</p>
            <ButtonLink href={href(routes.founder)} variant="ghost" icon="arrowRight" className="mt-4">
              {founder.aboutCard.cta}
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section labelledBy="company-title">
        <div className="card flex gap-5 rounded-2xl p-6 sm:p-8">
          <Icon name="info" className="mt-1 h-6 w-6 shrink-0 text-brand" />
          <div>
            <h2 id="company-title" className="t-h3-lg">
              {page.companyTitle}
            </h2>
            <p className="mt-2 leading-relaxed text-fg-muted">{page.companyNote}</p>
          </div>
        </div>
      </Section>

      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: dict.nav.cta }}
        secondary={{ href: href(routes.process), label: dict.nav.process }}
      />
    </>
  );
}
