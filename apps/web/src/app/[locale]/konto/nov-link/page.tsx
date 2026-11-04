import { accountMetadata, AccountPage } from "@/components/account/AccountPage";
import { resolveLocale } from "@/lib/params";

export async function generateMetadata({ params }: PageProps<"/[locale]/konto/nov-link">) {
  return accountMetadata(await resolveLocale(params), "resend");
}

export default async function Page({ params }: PageProps<"/[locale]/konto/nov-link">) {
  return <AccountPage locale={await resolveLocale(params)} view="resend" />;
}
