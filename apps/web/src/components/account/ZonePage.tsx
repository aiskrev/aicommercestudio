import { notFound } from "next/navigation";

import { AdvisorBilling } from "@/components/account/AdvisorBilling";
import { ZoneDashboard, ZoneInvoices, ZoneMembers, ZoneNav, ZonePlan, ZoneSupport } from "@/components/account/ZonePanels";
import { PageHero, Section } from "@/components/ui/primitives";
import type { Locale } from "@/i18n/config";
import { zoneTexts } from "@/i18n/zone";
import { advisorWorkspaceEnabled, commercialProjectsEnabled } from "@/lib/account-flag";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

type View = keyof (typeof zoneTexts)["bg"]["pages"];

const PATHS: Record<View, string> = {
  dashboard: routes.account,
  plan: routes.accountPlan,
  subscriptions: routes.accountSubscriptions,
  invoices: routes.accountInvoices,
  support: routes.accountSupport,
  organisation: routes.accountOrganisation,
};

const PANELS = {
  dashboard: ZoneDashboard,
  plan: ZonePlan,
  subscriptions: AdvisorBilling,
  invoices: ZoneInvoices,
  support: ZoneSupport,
  organisation: ZoneMembers,
} satisfies Record<View, (props: { locale: Locale }) => unknown>;

export function zoneMetadata(locale: Locale, view: View) {
  const { title, lead } = zoneTexts[locale].pages[view];
  return buildMetadata({ locale, title, description: lead, path: PATHS[view], noindex: true });
}

export function ZonePage({ locale, view }: { locale: Locale; view: View }) {
  if (!advisorWorkspaceEnabled()) notFound();
  const t = zoneTexts[locale];
  const { title, lead } = t.pages[view];
  const Panel = PANELS[view];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={title} lead={lead} />
      <Section>
        <ZoneNav locale={locale} delivery={commercialProjectsEnabled()} />
        <Panel locale={locale} />
      </Section>
    </>
  );
}
