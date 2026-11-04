import { AccountForm, type AccountView } from "@/components/account/AccountForms";
import { AccountHome } from "@/components/account/AccountHome";
import { PageHero, Section } from "@/components/ui/primitives";
import { accountTexts } from "@/i18n/account";
import type { Locale } from "@/i18n/config";
import { routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";

type View = AccountView | "home";

const PATHS: Record<View, string> = {
  home: routes.account,
  signIn: routes.accountSignIn,
  register: routes.accountRegister,
  resend: routes.accountResend,
  verify: routes.accountVerify,
  forgot: routes.accountForgot,
  reset: routes.accountReset,
};

export function accountMetadata(locale: Locale, view: View) {
  const { title, lead } = accountTexts[locale][view];
  return buildMetadata({ locale, title, description: lead, path: PATHS[view], noindex: true });
}

export function AccountPage({ locale, view }: { locale: Locale; view: View }) {
  const t = accountTexts[locale];
  const { title, lead } = t[view];
  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={title} lead={lead} />
      <Section>
        {view === "home" ? <AccountHome locale={locale} /> : <AccountForm view={view} locale={locale} turnstileSiteKey={process.env.TURNSTILE_SITE_KEY} />}
      </Section>
    </>
  );
}
