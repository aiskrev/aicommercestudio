import { accountMetadata, AccountPage } from "@/components/account/AccountPage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/sigurnost">) {
  return accountMetadata(await resolveLocale(params), "home");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/sigurnost">) {
  return <AccountPage locale={await resolveLocale(params)} view="home" />;
}
