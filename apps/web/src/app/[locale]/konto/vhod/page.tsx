import { accountMetadata, AccountPage } from "@/components/account/AccountPage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/vhod">) {
  return accountMetadata(await resolveLocale(params), "signIn");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/vhod">) {
  return <AccountPage locale={await resolveLocale(params)} view="signIn" />;
}
