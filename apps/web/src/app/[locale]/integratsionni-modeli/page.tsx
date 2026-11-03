import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { type PatternCard, PatternSearch } from "@/components/reference/PatternSearch";
import { StatusBadge } from "@/components/reference/ReferenceBlocks";
import { Alert, PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { INTEGRATION_STATUSES, PATTERNS, PATTERN_SLUGS } from "@/lib/reference";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/integratsionni-modeli">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).reference.patterns;
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.patterns });
}

/** Searchable catalogue of integration and architecture patterns with an honest integration status. */
export default async function PatternsPage({ params }: PageProps<"/[locale]/integratsionni-modeli">) {
  const locale = await resolveLocale(params);
  const { reference } = getContent(locale);
  const t = reference.patterns;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const cards: PatternCard[] = PATTERNS.map((p) => ({
    key: p.key,
    href: href(routes.pattern(PATTERN_SLUGS[p.key].bg)),
    title: reference.patternTexts[p.key].title,
    summary: reference.patternTexts[p.key].summary,
    status: p.status,
    statusLabel: t.statuses[p.status].label,
  }));

  return (
    <>
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.title, path: href(routes.patterns) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead}>
        <Alert tone="info" role="note" className="mt-8 max-w-3xl">
          <span data-testid="pattern-status-notice">{t.statusNotice}</span>
        </Alert>
      </PageHero>
      <Section size="wide">
        <section aria-labelledby="status-legend-title" className="mb-10">
          <h2 id="status-legend-title" className="t-label">
            {t.statusLabel}
          </h2>
          <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5" data-testid="status-legend">
            {INTEGRATION_STATUSES.map((status) => (
              <div key={status} className="rounded-[var(--radius-md)] border border-line-subtle p-3">
                <dt>
                  <StatusBadge status={status} label={t.statuses[status].label} />
                </dt>
                <dd className="mt-2 text-sm text-fg-muted">{t.statuses[status].text}</dd>
              </div>
            ))}
          </dl>
        </section>
        <PatternSearch cards={cards} labels={{ search: t.searchLabel, placeholder: t.searchPlaceholder, count: t.count, empty: t.empty, open: t.open }} />
        <p className="mt-12">
          <Link href={href(routes.scenarios)} className="link">
            {reference.scenarios.title} →
          </Link>
        </p>
      </Section>
    </>
  );
}
