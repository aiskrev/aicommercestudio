"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import { accountTexts } from "@/i18n/account";
import { type Locale, localizePath } from "@/i18n/config";
import { accountFetch, AccountError, takeTokenFromUrl } from "@/lib/account-api";
import { routes } from "@/lib/routes";

export type AccountView = "signIn" | "register" | "resend" | "verify" | "forgot" | "reset";

type Status = { tone: "error" | "success"; text: string } | null;

function TextField({
  id,
  label,
  hint,
  type = "text",
  autoComplete,
  required = true,
  maxLength = 254,
}: {
  id: string;
  label: string;
  hint?: string;
  type?: string;
  autoComplete: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={`account-${id}`} className="field-label">
        {label}
      </label>
      <input
        id={`account-${id}`}
        name={id}
        type={type}
        className="field"
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
        aria-describedby={hint ? `account-${id}-hint` : undefined}
      />
      {hint && (
        <p id={`account-${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

function CheckField({ id, required, children }: { id: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input id={`account-${id}`} name={id} type="checkbox" className="mt-1" required={required} />
      <span>{children}</span>
    </label>
  );
}

/** The sign-in, sign-up, confirmation and recovery forms. Answers never say whether an e-mail is known. */
export function AccountForm({ view, locale }: { view: AccountView; locale: Locale }) {
  const t = accountTexts[locale];
  const router = useRouter();
  const href = (path: string) => localizePath(locale, path);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const needsToken = view === "verify" || view === "reset";
  const [token, setToken] = useState<string | null>(null);
  const [tokenRead, setTokenRead] = useState(!needsToken);

  useEffect(() => {
    if (!needsToken) return;
    // The fragment exists only in the browser, so it can be read only after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(takeTokenFromUrl());
    setTokenRead(true);
  }, [needsToken]);

  const call = <T,>(path: string, body: unknown) =>
    accountFetch<T>(path, locale, t.network, { method: "POST", body });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? "");
    setBusy(true);
    setStatus(null);
    setUnverified(false);
    try {
      if (view === "signIn") {
        await call("/login", { email: text("email"), password: text("password") });
        router.push(href(routes.account));
        return;
      }
      if (view === "register") {
        await call("/register", {
          email: text("email"),
          password: text("password"),
          display_name: text("display_name") || null,
          locale,
          privacy_acknowledged: data.get("privacy") === "on",
          marketing_consent: data.get("marketing") === "on",
        });
        setStatus({ tone: "success", text: t.register.done });
      } else if (view === "resend") {
        await call("/verification/resend", { email: text("email"), locale });
        setStatus({ tone: "success", text: t.resend.done });
      } else if (view === "forgot") {
        await call("/password/forgot", { email: text("email"), locale });
        setStatus({ tone: "success", text: t.forgot.done });
      } else if (view === "verify") {
        await call("/verification/confirm", { token });
        setStatus({ tone: "success", text: t.verify.done });
      } else {
        await call("/password/reset", { token, password: text("password") });
        setStatus({ tone: "success", text: t.reset.done });
      }
      setFinished(true);
    } catch (error) {
      if (error instanceof AccountError && error.code === "email_not_verified") setUnverified(true);
      setStatus({ tone: "error", text: error instanceof Error ? error.message : t.network });
    } finally {
      setBusy(false);
    }
  }

  const missingToken = needsToken && tokenRead && !token;
  const fallback = view === "verify" ? routes.accountResend : routes.accountForgot;
  const heading = view === "verify" ? t.resend.title : t.forgot.title;

  return (
    <div className="max-w-md space-y-5">
      {status && (
        <Alert tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>
          {status.text}
        </Alert>
      )}
      {missingToken && (
        <Alert tone="warning" role="alert">
          {view === "verify" ? t.verify.noToken : t.reset.noToken}
        </Alert>
      )}
      {unverified && (
        <p className="text-sm">
          {t.signIn.notVerified} <Link href={href(routes.accountResend)}>{t.resend.title}</Link>
        </p>
      )}
      {!finished && !missingToken && tokenRead && (
        <form onSubmit={submit} className="space-y-4" noValidate={false}>
          {view === "register" && (
            <TextField id="display_name" label={t.displayName} autoComplete="name" required={false} maxLength={120} />
          )}
          {(view === "signIn" || view === "register" || view === "resend" || view === "forgot") && (
            <TextField id="email" label={t.email} type="email" autoComplete="email" />
          )}
          {view === "signIn" && (
            <TextField id="password" label={t.password} type="password" autoComplete="current-password" maxLength={200} />
          )}
          {(view === "register" || view === "reset") && (
            <TextField
              id="password"
              label={view === "reset" ? t.newPassword : t.password}
              hint={t.passwordHint}
              type="password"
              autoComplete="new-password"
              maxLength={200}
            />
          )}
          {view === "register" && (
            <>
              <CheckField id="privacy" required>
                {t.register.privacyBefore}
                <Link href={href(routes.privacy)}>{t.register.privacyLink}</Link>
                {t.register.privacyAfter}
              </CheckField>
              <CheckField id="marketing">{t.register.marketing}</CheckField>
            </>
          )}
          <Button type="submit" loading={busy} loadingLabel={t.working}>
            {t[view].submit}
          </Button>
        </form>
      )}
      {missingToken && <Link href={href(fallback)}>{heading}</Link>}
      {finished && (view === "verify" || view === "reset") && <Link href={href(routes.accountSignIn)}>{t.signIn.title}</Link>}
      {view === "signIn" && (
        <p className="space-x-4 text-sm">
          <Link href={href(routes.accountForgot)}>{t.signIn.forgot}</Link>
          <Link href={href(routes.accountRegister)}>{t.signIn.noAccount}</Link>
        </p>
      )}
      {view === "register" && (
        <p className="text-sm">
          <Link href={href(routes.accountSignIn)}>{t.register.haveAccount}</Link>
        </p>
      )}
    </div>
  );
}
