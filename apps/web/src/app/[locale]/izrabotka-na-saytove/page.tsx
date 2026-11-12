import { HubPage } from "@/components/v5/HubPage";
import { getContent } from "@/content";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** Website development hub (/bg/izrabotka-na-saytove ↔ /en/website-development), V5 phase 05. */
export async function generateMetadata({ params }: PageProps<"/[locale]/izrabotka-na-saytove">) {
  const locale = await resolveLocale(params);
  const hub = getContent(locale).v5.websites;
  return buildMetadata({ locale, title: hub.metaTitle, description: hub.metaDescription, path: routes.websites });
}

export default async function WebsiteDevelopmentPage({ params }: PageProps<"/[locale]/izrabotka-na-saytove">) {
  const locale = await resolveLocale(params);
  return <HubPage locale={locale} hub={getContent(locale).v5.websites} path={routes.websites} primaryService="business_websites" />;
}
