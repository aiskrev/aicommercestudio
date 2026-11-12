import { HubPage } from "@/components/v5/HubPage";
import { getContent } from "@/content";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** E-commerce hub (/bg/online-magazini ↔ /en/ecommerce), V5 phase 06. */
export async function generateMetadata({ params }: PageProps<"/[locale]/online-magazini">) {
  const locale = await resolveLocale(params);
  const hub = getContent(locale).v5.ecommerce;
  return buildMetadata({ locale, title: hub.metaTitle, description: hub.metaDescription, path: routes.ecommerce });
}

export default async function EcommercePage({ params }: PageProps<"/[locale]/online-magazini">) {
  const locale = await resolveLocale(params);
  return <HubPage locale={locale} hub={getContent(locale).v5.ecommerce} path={routes.ecommerce} primaryService="store_development" />;
}
