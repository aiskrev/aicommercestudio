import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { CheckList, IconBadge, PageHero, Section, SectionHeading } from "@/components/ui/primitives";
import { getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/za-kogo">) {
  const locale = await resolveLocale(params);
  const { industries } = getContent(locale);
  return buildMetadata({
    locale,
    title: industries.metaTitle,
    description: industries.metaDescription,
    path: routes.industries,
  });
}

export default async function IndustriesPage({ params }: PageProps<"/[locale]/za-kogo">) {
  const locale = await resolveLocale(params);
  const { industries: page, home } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.industries, path: href(routes.industries) },
        ]}
      />
      <PageHero eyebrow={page.eyebrow} title={page.title} lead={page.lead} />

      <Section>
        <ul className="grid gap-5 lg:grid-cols-2">
          {page.segments.map((segment) => (
            <li key={segment.title} className="card flex flex-col rounded-2xl p-6 sm:p-7">
              <div className="flex items-start gap-4">
                {segment.icon && <IconBadge name={segment.icon} />}
                <div>
                  <h2 className="t-h3-lg">{segment.title}</h2>
                  <p className="mt-2 leading-relaxed text-fg-muted">{segment.description}</p>
                </div>
              </div>
              <CheckList items={segment.needs} className="mt-6" />
              <div className="mt-6 flex flex-wrap gap-2 border-t border-line-subtle pt-5">
                {segment.services.map((key) => {
                  const service = serviceByKey(locale, key);
                  return (
                    <Link
                      key={key}
                      href={href(routes.service(service.slug))}
                      className="rounded-full border border-brand-strong/20 bg-brand-strong/[0.06] px-3 py-1.5 text-xs font-medium text-brand-soft hover:border-brand/50"
                    >
                      {service.shortTitle}
                    </Link>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="sectors-title" alt>
        <SectionHeading id="sectors-title" title={page.sectorsTitle} lead={page.sectorsLead} />
        <ul className="mt-8 flex flex-wrap gap-3">
          {page.sectors.map((sector) => (
            <li key={sector} className="card rounded-full px-4 py-2 text-sm text-fg-secondary">
              {sector}
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title={home.finalCta.title}
        lead={home.finalCta.lead}
        primary={{ href: href(routes.contact), label: dict.nav.cta }}
        secondary={{ href: href(routes.services), label: dict.common.allServices }}
      />
    </>
  );
}
