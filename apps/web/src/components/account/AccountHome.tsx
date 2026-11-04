"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import { accountTexts } from "@/i18n/account";
import { type Locale, localizePath } from "@/i18n/config";
import { accountFetch, AccountError, type AccountSession, type Profile } from "@/lib/account-api";
import { routes } from "@/lib/routes";

type Status = { tone: "error" | "success"; text: string } | null;

/** Profile, language, marketing consent, password and sessions of the signed-in customer. */
export function AccountHome({ locale }: { locale: Locale }) {
  const t = accountTexts[locale];
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [status, setStatus] = useState<Status>(null);

  const api = useCallback(
    <T,>(path: string, method = "GET", body?: unknown) => accountFetch<T>(path, locale, t.network, { method, body }),
    [locale, t.network],
  );

  const fail = useCallback(
    (error: unknown) => {
      if (error instanceof AccountError && error.status === 401) {
        router.replace(localizePath(locale, routes.accountSignIn));
        return;
      }
      setStatus({ tone: "error", text: error instanceof Error ? error.message : t.network });
    },
    [locale, router, t.network],
  );

  const load = useCallback(async () => {
    try {
      const [me, list] = await Promise.all([api<Profile>("/me"), api<AccountSession[]>("/sessions")]);
      setProfile(me);
      setSessions(list);
    } catch (error) {
      fail(error);
    }
  }, [api, fail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, done?: string) {
    setStatus(null);
    try {
      await action();
      if (done) setStatus({ tone: "success", text: done });
      await load();
    } catch (error) {
      fail(error);
    }
  }

  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(
      () =>
        api("/me", "PATCH", {
          display_name: String(data.get("display_name") ?? "") || null,
          locale: data.get("locale"),
          marketing_consent: data.get("marketing") === "on",
        }),
      t.home.saved,
    );
  }

  function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      await api("/password/change", "POST", {
        current_password: data.get("current_password"),
        new_password: data.get("new_password"),
      });
      form.reset();
    }, t.home.passwordDone);
  }

  async function signOut() {
    try {
      await api("/logout", "POST");
      router.replace(localizePath(locale, routes.accountSignIn));
    } catch (error) {
      fail(error);
    }
  }

  if (!profile) return status ? <Alert tone={status.tone}>{status.text}</Alert> : <p>{t.working}</p>;

  const date = (value: string) => new Date(value).toLocaleString(locale === "bg" ? "bg-BG" : "en-GB");

  return (
    <div className="max-w-2xl space-y-10">
      {status && (
        <Alert tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>
          {status.text}
        </Alert>
      )}

      <section aria-labelledby="account-profile" className="space-y-4">
        <h2 id="account-profile" className="text-xl font-semibold">
          {t.home.profile}
        </h2>
        <p className="text-sm">{profile.email}</p>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label htmlFor="account-display-name" className="field-label">
              {t.displayName}
            </label>
            <input
              id="account-display-name"
              name="display_name"
              className="field"
              maxLength={120}
              autoComplete="name"
              defaultValue={profile.display_name ?? ""}
            />
          </div>
          <div>
            <label htmlFor="account-locale" className="field-label">
              {t.language}
            </label>
            <select id="account-locale" name="locale" className="field" defaultValue={profile.locale}>
              <option value="bg">{t.languages.bg}</option>
              <option value="en">{t.languages.en}</option>
            </select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input name="marketing" type="checkbox" className="mt-1" defaultChecked={profile.marketing_consent} />
            <span>{t.home.marketing}</span>
          </label>
          <Button type="submit">{t.home.save}</Button>
        </form>
      </section>

      <section aria-labelledby="account-password" className="space-y-4">
        <h2 id="account-password" className="text-xl font-semibold">
          {t.home.passwordTitle}
        </h2>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label htmlFor="account-current" className="field-label">
              {t.currentPassword}
            </label>
            <input id="account-current" name="current_password" type="password" className="field" required autoComplete="current-password" />
          </div>
          <div>
            <label htmlFor="account-new" className="field-label">
              {t.newPassword}
            </label>
            <input id="account-new" name="new_password" type="password" className="field" required autoComplete="new-password" />
            <p className="field-hint">{t.passwordHint}</p>
          </div>
          <Button type="submit">{t.home.passwordSubmit}</Button>
        </form>
      </section>

      <section aria-labelledby="account-sessions" className="space-y-4">
        <h2 id="account-sessions" className="text-xl font-semibold">
          {t.home.sessionsTitle}
        </h2>
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="min-w-0 break-words">
                <strong>{session.current ? t.home.current : (session.user_agent ?? t.home.unknownDevice)}</strong>
                <br />
                {t.home.started}: {date(session.created_at)} · {t.home.lastSeen}: {date(session.last_seen_at)}
              </span>
              {!session.current && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void run(() => api(`/sessions/${session.id}`, "DELETE"))}
                >
                  {t.home.revoke}
                </Button>
              )}
            </li>
          ))}
        </ul>
        {sessions.length > 1 && (
          <Button type="button" variant="secondary" onClick={() => void run(() => api("/sessions/revoke-others", "POST"))}>
            {t.home.revokeOthers}
          </Button>
        )}
      </section>

      <Button type="button" variant="secondary" onClick={() => void signOut()}>
        {t.home.signOut}
      </Button>
    </div>
  );
}
