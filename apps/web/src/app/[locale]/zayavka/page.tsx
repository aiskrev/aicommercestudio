import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { QuoteBasket } from "@/components/quote/QuoteBasket";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { CARE_PLANS } from "@/lib/care-plans";
import { projectConfiguratorEnabled } from "@/lib/configurator-flag";
import { resolveLocale } from "@/lib/params";
import { quoteBasketEnabled } from "@/lib/quote-basket-flag";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";
import { WORKSHOP_KEYS } from "@/lib/workshop-slugs";

/** Rendered per request: the flag is read at runtime, so the page is never prerendered as live. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/zayavka">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).quoteBasket;
  // A personal draft: never indexed, whatever the flag says.
  return buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.quoteBasket, noindex: true });
}

/**
 * The visitor's quote request (off by default: 404 until QUOTE_BASKET_ENABLED=true). The page ships labels only;
 * the basket itself is fetched by the browser with its token and computed by the server.
 */
export default async function QuoteBasketPage({ params }: PageProps<"/[locale]/zayavka">) {
  if (!quoteBasketEnabled()) notFound();
  const locale = await resolveLocale(params);
  const content = getContent(locale);
  const t = content.quoteBasket;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);

  const names = {
    packages: Object.fromEntries(Object.entries(content.projectPackages.packages).map(([key, item]) => [key, item.name])),
    offers: {
      service: content.services.map((service) => ({ key: service.key, name: service.shortTitle })),
      care_plan: CARE_PLANS.map((plan) => ({ key: plan.key, name: content.carePlans.plans[plan.key].name })),
      ai_managed: content.aiManaged.packages.items.map((item) => ({ key: item.key, name: item.name })),
      workshop: WORKSHOP_KEYS.map((key) => ({ key, name: content.workshops.texts[key].title })),
    },
  };

  return (
    <>
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.title, path: href(routes.quoteBasket) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <Section size="wide">
        <QuoteBasket
          locale={locale}
          texts={t}
          results={content.configurator.review}
          fields={{ goals: content.configurator.questions.goals, special: content.configurator.questions.special }}
          featureLabels={content.configurator.questions.features.options}
          form={dict.form}
          validation={dict.validation}
          names={names}
          privacyHref={href(routes.privacy)}
          configuratorHref={projectConfiguratorEnabled() ? href(routes.configurator) : null}
          packagesHref={href(routes.projectPackages)}
        />
      </Section>
    </>
  );
}
