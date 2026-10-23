"use client";

import { type FormEvent, useState } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { adminFetch, ApiError, safeAdminRedirect } from "@/lib/admin-api";

export function LoginForm({ next }: { next?: string }) {
  const t = useAdminI18n().t.login;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError(t.missing);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await adminFetch("/api/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      window.location.assign(safeAdminRedirect(next));
    } catch (err) {
      setSubmitting(false);
      setPassword("");
      if (err instanceof ApiError && err.status === 429) setError(t.tooMany);
      else if (err instanceof ApiError && (err.status === 401 || err.status === 422)) setError(t.invalid);
      else setError(t.unavailable);
    }
  }

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
