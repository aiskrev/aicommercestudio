import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Icon } from "@/components/ui/Icon";
import { FeatureCard, PageHero, Section } from "@/components/ui/primitives";
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
  const { about: page, home } = getContent(locale);
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
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <h2 id="mission-title" className="text-3xl font-semibold">
            {page.mission.title}
          </h2>
          <div className="grid gap-5 text-lg leading-relaxed text-slate-300">
            {page.mission.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </Section>

      <Section alt>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {page.principles.map((item) => (
            <FeatureCard key={item.title} {...item} />
          ))}
        </div>
      </Section>

      <Section labelledBy="company-title">
        <div className="card flex gap-5 rounded-2xl p-6 sm:p-8">
          <Icon name="info" className="mt-1 h-6 w-6 shrink-0 text-cyan-300" />
          <div>
            <h2 id="company-title" className="text-xl font-semibold">
              {page.companyTitle}
            </h2>
            <p className="mt-2 leading-relaxed text-slate-400">{page.companyNote}</p>
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
