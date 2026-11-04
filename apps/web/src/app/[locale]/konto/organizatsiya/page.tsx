import { ZonePage, zoneMetadata } from "@/components/account/ZonePage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/organizatsiya">) {
  return zoneMetadata(await resolveLocale(params), "organisation");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/organizatsiya">) {
  return <ZonePage locale={await resolveLocale(params)} view="organisation" />;
}
