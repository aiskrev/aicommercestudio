import { LegalPage } from "@/components/sections/LegalPage";
import { getContent } from "@/content";
import { localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** Withdrawal from the contract and refunds: a summary for consumers (the full terms are the subscription terms). */
export async function generateMetadata({ params }: PageProps<"/[locale]/otkaz-i-vazstanovyavane">) {
  const locale = await resolveLocale(params);
  const { legal } = getContent(locale);
  const document = legal.withdrawalInfo;
  return buildMetadata({
    locale,
    title: document.title,
    description: document.metaDescription,
    path: routes.withdrawalInfo,
    noindex: legal.isDraft,
  });
}

export default async function WithdrawalInfoPage({ params }: PageProps<"/[locale]/otkaz-i-vazstanovyavane">) {
  const locale = await resolveLocale(params);
  const { legal } = getContent(locale);
  const dict = getDictionary(locale);
  const document = legal.withdrawalInfo;
  return (
    <LegalPage
      document={document}
      updatedLabel={dict.common.updated}
      breadcrumbs={[
        { name: dict.common.home, path: localizePath(locale, routes.home) },
        { name: document.title, path: localizePath(locale, routes.withdrawalInfo) },
      ]}
    />
  );
}
