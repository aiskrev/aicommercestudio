import { ZonePage, zoneMetadata } from "@/components/account/ZonePage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/abonamenti">) {
  return zoneMetadata(await resolveLocale(params), "subscriptions");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/abonamenti">) {
  return <ZonePage locale={await resolveLocale(params)} view="subscriptions" />;
}
