import { LegalPage } from "@/components/sections/LegalPage";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** Terms for paid plans and online payments (draft until a lawyer has read them). */
export async function generateMetadata({ params }: PageProps<"/[locale]/usloviya-za-abonament">) {
  const locale = await resolveLocale(params);
  const { legal } = getContent(locale);
  const document = legal.subscriptionTerms;
  return buildMetadata({
    locale,
    title: document.title,
    description: document.metaDescription,
    path: routes.subscriptionTerms,
    noindex: legal.subscriptionDraft,
  });
}

export default async function SubscriptionTermsPage({ params }: PageProps<"/[locale]/usloviya-za-abonament">) {
  const locale = await resolveLocale(params);
  const { legal } = getContent(locale);
  const dict = getDictionary(locale);
  const document = legal.subscriptionTerms;
  return (
    <LegalPage
      document={document}
      draftNotice={legal.subscriptionDraft ? legal.subscriptionDraftNotice : undefined}
      updatedLabel={dict.common.updated}
      breadcrumbs={[
        { name: dict.common.home, path: localizePath(locale, routes.home) },
        { name: document.title, path: localizePath(locale, routes.subscriptionTerms) },
      ]}
    />
  );
}
