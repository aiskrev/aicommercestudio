import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { QuotationView } from "@/components/quotation/QuotationView";
import { PageHero, Section } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { getDictionary } from "@/i18n";
import { localizePath } from "@/i18n/config";
import { resolveLocale } from "@/lib/params";
import { quotationsEnabled } from "@/lib/quotation-flag";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

/** Rendered per request: the flag is read at runtime, so the page is never prerendered as live. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/oferta">) {
  const locale = await resolveLocale(params);
  const t = getContent(locale).quotation;
  // A private page behind a secret link: never indexed, and the link is never passed on in a Referer header.
  return { ...buildMetadata({ locale, title: t.metaTitle, description: t.metaDescription, path: routes.quotation, noindex: true }), referrer: "no-referrer" as const };
}

/**
 * A customer-facing quotation (off by default: 404 until QUOTATIONS_ENABLED=true). The secret of the link is in the
 * URL fragment, which no server ever receives; the browser sends it to the API in a request body.
 */
export default async function QuotationPage({ params }: PageProps<"/[locale]/oferta">) {
  if (!quotationsEnabled()) notFound();
  const locale = await resolveLocale(params);
  const t = getContent(locale).quotation;
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  return (
    <>
      <Breadcrumbs items={[{ name: dict.common.home, path: href(routes.home) }, { name: t.eyebrow, path: href(routes.quotation) }]} />
      <PageHero eyebrow={t.eyebrow} title={t.metaTitle} lead={t.metaDescription} />
      <Section size="wide">
        <QuotationView locale={locale} texts={t} contactHref={href(routes.contact)} />
      </Section>
    </>
  );
}
