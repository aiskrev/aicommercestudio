import { Enrolment } from "@/components/portal/Portal";
import { portalDictionaries } from "@/i18n/portal";
import { getAdminLocale } from "@/lib/admin-locale";

export default async function PortalActivatePage() {
  const locale = await getAdminLocale();
  return <Enrolment t={portalDictionaries[locale]} locale={locale} purpose="activate" />;
}
