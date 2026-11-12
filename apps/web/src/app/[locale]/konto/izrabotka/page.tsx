import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeliveryProjects } from "@/components/account/DeliveryProjects";
import { ZoneNav } from "@/components/account/ZonePanels";
import { PageHero, Section } from "@/components/ui/primitives";
import { projectTexts } from "@/i18n/projects";
import { advisorWorkspaceEnabled, commercialProjectsEnabled } from "@/lib/account-flag";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/izrabotka">) {
  const locale = await resolveLocale(params);
  const t = projectTexts[locale];
  // A private page: never indexed. Its data comes from authenticated, no-store API calls made by the browser.
  return buildMetadata({ locale, title: t.title, description: t.lead, path: routes.accountDelivery, noindex: true });
}

/** The customer's delivery projects (off by default: 404 until COMMERCIAL_PROJECTS_ENABLED=true). The project is chosen with `?p=`, and the API looks it up only inside the caller's own workspace. */
export default async function Page({ params }: PageProps<"/[locale]/konto/izrabotka">) {
  if (!commercialProjectsEnabled()) notFound();
  const locale = await resolveLocale(params);
  const t = projectTexts[locale];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <Section>
        {advisorWorkspaceEnabled() && <ZoneNav locale={locale} delivery />}
        <Suspense fallback={<p role="status">{t.loading}</p>}>
          <DeliveryProjects locale={locale} />
        </Suspense>
      </Section>
    </>
  );
}
