import { ZonePage, zoneMetadata } from "@/components/account/ZonePage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/zapitvaniya">) {
  return zoneMetadata(await resolveLocale(params), "support");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/zapitvaniya">) {
  return <ZonePage locale={await resolveLocale(params)} view="support" />;
}
