import { notFound } from "next/navigation";

import { ProjectConfigurator } from "@/components/configurator/ProjectConfigurator";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { projectConfiguratorEnabled } from "@/lib/configurator-flag";
import { resolveLocale } from "@/lib/params";
import { quoteBasketEnabled } from "@/lib/quote-basket-flag";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** Rendered per request: the flag is read at runtime, so the page is never prerendered as live. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/konfigurator">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).configurator;
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.configurator, noindex: !projectConfiguratorEnabled() });
}

/**
 * Project configurator (off by default: 404 until PROJECT_CONFIGURATOR_ENABLED=true). The form collects
 * enumerated answers; the server computes the review from the published price schedule. Nothing here is a quote.
 */
export default async function ConfiguratorPage({ params }: PageProps<"/[locale]/konfigurator">) {
  if (!projectConfiguratorEnabled()) notFound();
  const locale = await resolveLocale(params);
  const content = getContent(locale);
  const t = content.configurator;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  const names = {
    packages: Object.fromEntries(Object.entries(content.projectPackages.packages).map(([key, item]) => [key, item.name])),
    services: Object.fromEntries(content.services.map((service) => [service.key, service.shortTitle])),
    carePlans: Object.fromEntries(Object.entries(content.carePlans.plans).map(([key, plan]) => [key, plan.name])),
  };

  return (
    <>
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.title, path: href(routes.configurator) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <Section size="wide">
        <ProjectConfigurator
          locale={locale}
          texts={t}
          form={dict.form}
          validation={dict.validation}
          inquiry={dict.inquiry}
          names={names}
          privacyHref={href(routes.privacy)}
          basket={quoteBasketEnabled() ? { href: href(routes.quoteBasket), texts: content.quoteBasket.configurator } : undefined}
        />
      </Section>
    </>
  );
}
