import { ZonePage, zoneMetadata } from "@/components/account/ZonePage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/plan">) {
  return zoneMetadata(await resolveLocale(params), "plan");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/plan">) {
  return <ZonePage locale={await resolveLocale(params)} view="plan" />;
}
