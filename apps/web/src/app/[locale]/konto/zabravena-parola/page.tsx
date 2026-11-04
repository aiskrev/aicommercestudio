import { accountMetadata, AccountPage } from "@/components/account/AccountPage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/zabravena-parola">) {
  return accountMetadata(await resolveLocale(params), "forgot");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/zabravena-parola">) {
  return <AccountPage locale={await resolveLocale(params)} view="forgot" />;
}
