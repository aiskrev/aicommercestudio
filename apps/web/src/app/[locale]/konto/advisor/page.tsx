import { AdvisorBilling } from "@/components/account/AdvisorBilling";
import { AdvisorWorkspace } from "@/components/account/AdvisorWorkspace";
import { PageHero, Section } from "@/components/ui/primitives";
import { workspaceTexts } from "@/i18n/workspace";
import { resolveLocale } from "@/lib/params";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/advisor">) {
  const locale = await resolveLocale(params);
  const t = workspaceTexts[locale];
  return buildMetadata({ locale, title: t.title, description: t.lead, path: routes.accountAdvisor, noindex: true });
}

export default async function Page({ params }: PageProps<"/[locale]/konto/advisor">) {
  const locale = await resolveLocale(params);
  const t = workspaceTexts[locale];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} lead={t.lead} />
      <Section>
        <div className="space-y-10">
          <AdvisorBilling locale={locale} />
          <AdvisorWorkspace locale={locale} />
        </div>
      </Section>
    </>
  );
}
