import { accountMetadata, AccountPage } from "@/components/account/AccountPage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/potvardi">) {
  return accountMetadata(await resolveLocale(params), "verify");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/potvardi">) {
  return <AccountPage locale={await resolveLocale(params)} view="verify" />;
}
