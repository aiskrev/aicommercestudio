"use client";

import { type FormEvent, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { MfaCodeStep, MfaEnrolment, RecoveryCodes } from "@/components/admin/Mfa";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { adminFetch, ApiError, safeAdminRedirect } from "@/lib/admin-api";
import type { AdminSession } from "@/lib/admin-types";

/** Password → (when the account has TOTP, or ADMIN_MFA_REQUIRED is on) a code or enrolment step. */
type Step = "password" | "verify" | "enrol" | "codes";

export function LoginForm({ next }: { next?: string }) {
  const { t: dict } = useAdminI18n();
  const t = dict.login;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("password");
  const [codes, setCodes] = useState<string[]>([]);

  const finish = () => window.location.assign(safeAdminRedirect(next));

  function backToPassword(message: string | null) {
    setStep("password");
    setSubmitting(false);
    setError(message);
  }

  async function cancel() {
    // Ends the pending session; failure is harmless (it expires on its own).
    await adminFetch("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    backToPassword(null);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError(t.missing);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await adminFetch<AdminSession>("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setPassword("");
      if (session.mfa) {
        setStep(session.mfa);
        return;
      }
      finish();
    } catch (err) {
      setSubmitting(false);
      setPassword("");
      if (err instanceof ApiError && err.status === 429) setError(t.tooMany);
      else if (err instanceof ApiError && (err.status === 401 || err.status === 422)) setError(t.invalid);
      else setError(t.unavailable);
    }
  }

  if (step === "verify") {
    return <MfaCodeStep onVerified={finish} onCancel={cancel} onLocked={() => backToPassword(t.tooMany)} />;
  }
  if (step === "enrol") {
    return (
      <div className="grid gap-4">
        <h2 className="text-lg font-semibold text-white">{dict.mfa.enrolTitle}</h2>
        <MfaEnrolment
          onCancel={cancel}
          onConfirmed={(result) => {
            setCodes(result.recovery_codes);
            setStep("codes");
          }}
        />
      </div>
    );
  }
  if (step === "codes") return <RecoveryCodes codes={codes} onDone={finish} />;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5" aria-label={t.formLabel}>
      <div aria-live="assertive">
        {error && (
          <p role="alert" className="flex gap-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">
            <Icon name="alert" className="h-5 w-5 shrink-0" />
            {error}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="login-email" className="mb-2 block text-sm font-medium text-slate-200">
          {t.email}
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          className="field"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label htmlFor="login-password" className="mb-2 block text-sm font-medium text-slate-200">
          {t.password}
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit" className={cx(buttonClass("primary", "lg"), "w-full")} disabled={submitting}>
        {submitting ? t.submitting : t.submit}
      </button>
    </form>
  );
}
