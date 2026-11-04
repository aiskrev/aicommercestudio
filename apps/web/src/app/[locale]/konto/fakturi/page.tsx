import { ZonePage, zoneMetadata } from "@/components/account/ZonePage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/fakturi">) {
  return zoneMetadata(await resolveLocale(params), "invoices");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/fakturi">) {
  return <ZonePage locale={await resolveLocale(params)} view="invoices" />;
}
