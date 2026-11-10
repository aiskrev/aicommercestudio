import { MarketingWithdrawal } from "@/components/marketing/MarketingWithdrawal";
import { PageHero, Section } from "@/components/ui/primitives";
import { marketingTexts } from "@/i18n/marketing";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** Reached only from the link in a marketing message; never indexed, never in the sitemap, never measured. */
export async function generateMetadata({ params }: PageProps<"/[locale]/otkaz-ot-marketing">) {
  const locale = await resolveLocale(params);
  const t = marketingTexts[locale];
  return buildMetadata({ locale, title: t.title, description: t.lead, path: routes.marketingOptOut, noindex: true });
}

export default async function MarketingOptOutPage({ params }: PageProps<"/[locale]/otkaz-ot-marketing">) {
  const locale = await resolveLocale(params);
  const t = marketingTexts[locale];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <Section>
        <MarketingWithdrawal locale={locale} />
      </Section>
    </>
  );
}
