import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Alert, PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { SCENARIO_CATEGORIES, SCENARIO_SLUGS, scenariosIn } from "@/lib/reference";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/referentni-stsenarii">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).reference.scenarios;
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.scenarios });
}

/** Reference scenarios grouped by category, with an in-page category navigation (works without JavaScript). */
export default async function ScenariosPage({ params }: PageProps<"/[locale]/referentni-stsenarii">) {
  const locale = await resolveLocale(params);
  const { reference } = getContent(locale);
  const t = reference.scenarios;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  return (
    <>
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.title, path: href(routes.scenarios) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
        <Alert tone="warning" role="note" className="mt-8 max-w-3xl">
          <span data-testid="fictional-notice">{t.fictionalNotice}</span>
        </Alert>
      </PageHero>
      <Section size="wide">
        <nav aria-label={t.categoryNav} className="mb-10">
          <ul className="flex flex-wrap gap-2" data-testid="scenario-categories">
            {SCENARIO_CATEGORIES.map((category) => (
              <li key={category}>
                <a href={`#${category}`} className="badge hover:border-brand">
                  {t.categories[category].title} · {scenariosIn(category).length}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="grid gap-14">
          {SCENARIO_CATEGORIES.map((category) => (
            <section key={category} id={category} aria-labelledby={`${category}-title`} className="scroll-mt-28">
              <h2 id={`${category}-title`} className="t-h2">
                {t.categories[category].title}
              </h2>
              <p className="mt-2 max-w-3xl text-fg-muted">{t.categories[category].text}</p>
              <ul className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3" data-testid="scenario-cards">
                {scenariosIn(category).map((key) => {
                  const s = reference.scenarioTexts[key];
                  return (
                    <li key={key}>
                      <article className="card card-interactive relative flex h-full flex-col p-6" data-scenario={key}>
                        <span className="badge badge-warning self-start">{t.detail.fictionalLabel}</span>
                        <h3 className="t-h3 mt-4">
                          <Link href={href(routes.scenario(SCENARIO_SLUGS[key].bg))} className="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">
                            {s.title}
                          </Link>
                        </h3>
                        <p className="mt-1.5 text-body-sm leading-relaxed text-fg-muted">{s.summary}</p>
                        <p className="mt-auto pt-5 text-sm font-medium text-brand">{t.open}</p>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-12">
          <Link href={href(routes.patterns)} className="link">
            {reference.patterns.title} →
          </Link>
        </p>
      </Section>
      <CtaBand title={t.detail.ctaTitle} lead={t.detail.ctaText} primary={{ href: href(contactWithService("audit")), label: t.detail.ctaButton }} />
    </>
  );
}
