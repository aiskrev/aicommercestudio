import { accountMetadata, AccountPage } from "@/components/account/AccountPage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/registratsiya">) {
  return accountMetadata(await resolveLocale(params), "register");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/registratsiya">) {
  return <AccountPage locale={await resolveLocale(params)} view="register" />;
}
