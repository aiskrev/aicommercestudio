import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { Faq } from "@/components/sections/Faq";
import { JsonLd } from "@/components/seo/JsonLd";
import { Icon } from "@/components/ui/Icon";
import { ButtonLink, CheckList, Container, Eyebrow, IconBadge, Section } from "@/components/ui/primitives";
import { findService, getContent, serviceByKey } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata, faqJsonLd, serviceJsonLd } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getContent("bg").services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/uslugi/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const service = findService(locale, slug);
  if (!service) return {};
  return buildMetadata({
    locale,
    title: service.metaTitle,
    description: service.metaDescription,
    path: routes.service(service.slug),
  });
}

export default async function ServicePage({ params }: PageProps<"/[locale]/uslugi/[slug]">) {
  const locale = await resolveLocale(params);
  const { slug } = await params;
  const service = findService(locale, slug);
  if (!service) notFound();

  const dict = getDictionary(locale);
  const { home } = getContent(locale);
  const href = (path: string) => localizePath(locale, path);
  const path = href(routes.service(service.slug));
  const related = service.related.map((key) => serviceByKey(locale, key));
  const contactHref = href(contactWithService(service.key));

  return (
    <>
      <JsonLd
        data={[
          serviceJsonLd({ title: service.title, metaDescription: service.metaDescription, path, type: service.shortTitle }),
          faqJsonLd(service.faqs),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.services, path: href(routes.services) },
          { name: service.shortTitle, path },
        ]}
      />

      <div className="relative overflow-hidden border-b border-white/5">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative grid gap-12 py-14 sm:py-20 lg:grid-cols-[1.25fr_0.75fr] lg:items-start">
          <div>
            <Eyebrow>{dict.nav.services}</Eyebrow>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.1] sm:text-5xl">{service.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">{service.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={contactHref} size="lg" icon="arrowRight">
                {dict.common.requestQuote}
              </ButtonLink>
              <ButtonLink href={href(routes.services)} size="lg" variant="secondary">
                {dict.common.allServices}
              </ButtonLink>
            </div>
          </div>
          <aside className="glass rounded-2xl p-6" aria-labelledby="signals-title">
            <div className="flex items-center gap-3">
              <IconBadge name={service.icon} />
              <h2 id="signals-title" className="text-lg font-semibold">
                {dict.service.signals}
              </h2>
            </div>
            <CheckList items={service.signals} className="mt-5" />
          </aside>
        </Container>
      </div>

      <Section labelledBy="capabilities-title">
        <h2 id="capabilities-title" className="text-3xl font-semibold">
          {dict.service.capabilities}
        </h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {service.capabilities.map((capability) => (
            <div key={capability.title} className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold">{capability.title}</h3>
              <p className="mt-2 leading-relaxed text-slate-400">{capability.description}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="bg-ink-900/50">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">{dict.service.deliverables}</h2>
            <CheckList items={service.deliverables} className="mt-6" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{dict.service.engagement}</h2>
            <ul className="mt-6 grid gap-3">
              {service.engagement.map((model) => (
                <li key={model} className="glass flex items-center gap-3 rounded-xl px-5 py-4 text-slate-200">
                  <Icon name="layers" className="h-5 w-5 text-cyan-300" />
                  {model}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500">{dict.service.pricingNote}</p>
          </div>
        </div>
      </Section>

      <Section labelledBy="service-process-title">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <h2 id="service-process-title" className="text-3xl font-semibold">
            {dict.service.process}
          </h2>
          <ButtonLink href={href(routes.process)} variant="ghost" icon="arrowRight">
            {dict.common.learnMore}
          </ButtonLink>
        </div>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {home.process.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4 rounded-2xl border border-white/[0.07] p-5">
              <span className="font-display text-sm font-semibold text-cyan-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section labelledBy="service-faq-title" className="bg-ink-900/50">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <h2 id="service-faq-title" className="text-3xl font-semibold">
            {dict.service.faq}
          </h2>
          <Faq items={service.faqs} />
        </div>
      </Section>

      <Section labelledBy="related-title">
        <h2 id="related-title" className="text-2xl font-semibold">
          {dict.service.related}
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {related.map((item) => (
            <li key={item.key}>
              <Link
                href={href(routes.service(item.slug))}
                className="glass glass-hover flex h-full items-start gap-4 rounded-2xl p-5"
              >
                <IconBadge name={item.icon} />
                <div>
                  <h3 className="font-semibold">{item.shortTitle}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{item.summary}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <CtaBand
        title={dict.service.ctaTitle}
        lead={dict.service.ctaLead}
        primary={{ href: contactHref, label: dict.nav.cta }}
      />
    </>
  );
}
