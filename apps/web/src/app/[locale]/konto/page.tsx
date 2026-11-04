import { accountMetadata, AccountPage } from "@/components/account/AccountPage";
import { ZonePage, zoneMetadata } from "@/components/account/ZonePage";
import { advisorWorkspaceEnabled } from "@/lib/account-flag";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto">) {
  const locale = await resolveLocale(params);
  return advisorWorkspaceEnabled() ? zoneMetadata(locale, "dashboard") : accountMetadata(locale, "home");
}

export default async function Page({ params }: PageProps<"/[locale]/konto">) {
  const locale = await resolveLocale(params);
  return advisorWorkspaceEnabled() ? <ZonePage locale={locale} view="dashboard" /> : <AccountPage locale={locale} view="home" />;
}
