import { Portal } from "@/components/portal/Portal";
import { portalDictionaries } from "@/i18n/portal";
import { getAdminLocale } from "@/lib/admin-locale";

export default async function PortalPage() {
  const locale = await getAdminLocale();
  return <Portal t={portalDictionaries[locale]} locale={locale} />;
}
