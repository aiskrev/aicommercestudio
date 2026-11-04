import { accountMetadata, AccountPage } from "@/components/account/AccountPage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/nova-parola">) {
  return accountMetadata(await resolveLocale(params), "reset");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/nova-parola">) {
  return <AccountPage locale={await resolveLocale(params)} view="reset" />;
}
