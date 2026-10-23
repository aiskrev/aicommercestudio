import { LegalPage } from "@/components/sections/LegalPage";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/poveritelnost">) {
  const locale = await resolveLocale(params);
  const document = getContent(locale).legal.privacyPolicy;
  return buildMetadata({ locale, title: document.title, description: document.metaDescription, path: routes.privacy });
}

export default async function PrivacyPage({ params }: PageProps<"/[locale]/poveritelnost">) {
  const locale = await resolveLocale(params);
  const { legal } = getContent(locale);
  const dict = getDictionary(locale);
  const document = legal.privacyPolicy;
  return (
    <LegalPage
      document={document}
      draftNotice={legal.draftNotice}
      updatedLabel={dict.common.updated}
      breadcrumbs={[
        { name: dict.common.home, path: localizePath(locale, routes.home) },
        { name: document.title, path: localizePath(locale, routes.privacy) },
      ]}
    />
  );
}
