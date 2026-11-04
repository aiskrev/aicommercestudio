import Link from "next/link";

import { PaymentResult } from "@/components/account/AdvisorBilling";
import { PageHero, Section } from "@/components/ui/primitives";
import { billingTexts } from "@/i18n/billing";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/advisor/payment">) {
  const locale = await resolveLocale(params);
  const t = billingTexts[locale];
  return buildMetadata({
    locale,
    title: t.paymentTitle,
    description: t.paymentLead,
    path: routes.accountAdvisorPayment,
    noindex: true,
  });
}

export default async function Page({ params }: PageProps<"/[locale]/konto/advisor/payment">) {
  const locale = await resolveLocale(params);
  const t = billingTexts[locale];
  return (
    <>
      <PageHero eyebrow={t.title} title={t.paymentTitle} lead={t.paymentLead} />
      <Section>
        <div className="max-w-xl space-y-4">
          <PaymentResult locale={locale} />
          <Link href={localizePath(locale, routes.accountAdvisor)}>{t.back}</Link>
        </div>
      </Section>
    </>
  );
}
