"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { LOCALE_COOKIE } from "@/i18n/config";
import { type PortalDictionary } from "@/i18n/portal";

/**
 * Read-only client portal. The organisation always comes from the authenticated session on the
 * server; nothing here takes or sends an organisation id. Sign-in is password, then a TOTP code.
 */

type View = "loading" | "unavailable" | "login" | "mfa" | "app";

const CSRF_COOKIE = "acs_portal_csrf";

function csrf(): string {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : "";
}

async function call(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if ((init.method ?? "GET") !== "GET") headers.set("X-CSRF-Token", csrf());
  return fetch(`/api/portal${path}`, { ...init, headers, credentials: "same-origin", cache: "no-store" });
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, String(v)), template);

function Shell({ t, children, onLanguage }: { t: PortalDictionary; children: ReactNode; onLanguage: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-5xl content-start gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-fg">{t.title}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t.tagline}</p>
        </div>
        <button type="button" className="text-sm text-brand hover:underline" onClick={onLanguage}>
          {t.language}
        </button>
      </header>
      {children}
    </main>
  );
}

export function useLanguageSwitch(locale: "bg" | "en") {
  return () => {
    document.cookie = `${LOCALE_COOKIE}=${locale === "bg" ? "en" : "bg"}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };
}

function Card({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section className="rounded-2xl border border-line-subtle bg-surface-1 p-5" data-testid={testId}>
      <h2 className="mb-3 text-base font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

interface Dashboard { organization: string; agents_by_status: Record<string, number>; open_incidents: number; evaluations: number; telemetry: { connected: boolean } }
interface Agent { name: string; status: string; environment: string; approved_version: number | null }
interface Evaluation { agent: string; dataset: string; dataset_version: number; agent_version: number; passed: number; total: number; simulated: boolean; finished_at: string }
interface Incident { number: number; title: string; severity: string; impact: string; status: string; client_summary: string | null; detected_at: string; resolved_at: string | null }

type PortalData = { dashboard: Dashboard; agents: Agent[]; evaluations: Evaluation[]; incidents: Incident[] };
type Loaded = { view: View; data?: PortalData };

/** The session decides what is shown: unavailable (portal off), sign-in, second factor or the data. */
async function fetchAll(): Promise<Loaded> {
  const response = await call("/dashboard");
  if (response.status === 404) return { view: "unavailable" };
  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));
    return { view: body.code === "portal_mfa_required" ? "mfa" : "login" };
  }
  if (!response.ok) return { view: "login" };
  const [agents, evaluations, incidents] = await Promise.all(["/agents", "/evaluations", "/incidents"].map((p) => call(p).then((r) => r.json())));
  return { view: "app", data: { dashboard: await response.json(), agents, evaluations, incidents } };
}

export function Portal({ t, locale }: { t: PortalDictionary; locale: "bg" | "en" }) {
  const [view, setView] = useState<View>("loading");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", code: "" });
  const [data, setData] = useState<PortalData | null>(null);
  const language = useLanguageSwitch(locale);
  const date = (v: string) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "bg-BG", { dateStyle: "medium" }).format(new Date(v));

  const apply = useCallback((result: Loaded) => {
    if (result.data) setData(result.data);
    setView(result.view);
  }, []);
  const load = useCallback(() => fetchAll().then(apply), [apply]);

  useEffect(() => {
    fetchAll().then(apply);
  }, [apply]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await call("/login", { method: "POST", body: JSON.stringify({ email: form.email, password: form.password }) });
    if (response.ok) {
      setForm({ ...form, password: "" });
      return setView("mfa");
    }
    setError(response.status === 404 ? t.unavailable : t.invalidLogin);
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await call("/login/mfa", { method: "POST", body: JSON.stringify({ code: form.code }) });
    setForm({ ...form, code: "" });
    if (response.ok) return load();
    setError(response.status === 401 ? t.sessionExpired : t.invalidCode);
    if (response.status === 401) setView("login");
  }

  async function signOut() {
    await call("/logout", { method: "POST" });
    setData(null);
    setView("login");
  }

  const errorBox = error && <p role="alert" className="rounded-lg border border-line-strong bg-surface-1 px-3 py-2 text-sm text-danger">{error}</p>;

  if (view === "loading") return <Shell t={t} onLanguage={language}><p className="text-fg-muted">…</p></Shell>;
  if (view === "unavailable") {
    return (
      <Shell t={t} onLanguage={language}>
        <Card title={t.unavailable} testId="portal-unavailable"><p className="text-sm text-fg-secondary">{t.unavailableText}</p></Card>
      </Shell>
    );
  }
  if (view === "login" || view === "mfa") {
    return (
      <Shell t={t} onLanguage={language}>
        <Card title={view === "login" ? t.signIn : t.verify}>
          {view === "login" ? (
            <form onSubmit={signIn} className="grid max-w-sm gap-3" data-testid="portal-login">
              <label className="grid gap-1.5 text-sm text-fg-secondary">{t.email}<input className="field" type="email" autoComplete="username" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
              <label className="grid gap-1.5 text-sm text-fg-secondary">{t.password}<input className="field" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
              {errorBox}
              <button type="submit" className="btn btn-md btn-primary">{t.signIn}</button>
            </form>
          ) : (
            <form onSubmit={verify} className="grid max-w-sm gap-3" data-testid="portal-mfa">
              <label className="grid gap-1.5 text-sm text-fg-secondary">{t.code}<input className="field font-mono tracking-widest" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
              {errorBox}
              <button type="submit" className="btn btn-md btn-primary">{t.verify}</button>
            </form>
          )}
        </Card>
      </Shell>
    );
  }

  const d = data!;
  return (
    <Shell t={t} onLanguage={language}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg text-fg" data-testid="portal-organization">{d.dashboard.organization}</p>
        <button type="button" className="btn btn-sm btn-secondary" onClick={signOut}>{t.signOut}</button>
      </div>
      <p className="rounded-lg border border-line-default bg-surface-1 px-4 py-3 text-sm text-fg-secondary" role="note" data-testid="portal-not-connected">{t.notConnected}</p>
      <p className="text-xs text-fg-subtle">{t.readOnly}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card title={t.agents}><p className="text-3xl font-bold text-fg">{d.agents.length}</p></Card>
        <Card title={t.openIncidents}><p className="text-3xl font-bold text-fg">{d.dashboard.open_incidents}</p></Card>
        <Card title={t.evaluationCount}><p className="text-3xl font-bold text-fg">{d.dashboard.evaluations}</p></Card>
      </div>
      <Card title={t.agents} testId="portal-agents">
        {d.agents.length === 0 ? <p className="text-sm text-fg-muted">{t.noAgents}</p> : (
          <ul className="grid gap-2 text-sm">
            {d.agents.map((a) => (
              <li key={a.name} className="flex flex-wrap justify-between gap-2 text-fg-secondary">
                <span className="text-fg">{a.name}</span>
                <span>{t.agentStatus[a.status] ?? a.status} · {t.environments[a.environment] ?? a.environment} · {t.version} {a.approved_version ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t.evaluations} testId="portal-evaluations">
        {d.evaluations.length === 0 ? <p className="text-sm text-fg-muted">{t.noEvaluations}</p> : (
          <ul className="grid gap-2 text-sm">
            {d.evaluations.map((e, i) => (
              <li key={i} className="text-fg-secondary">
                <span className="text-fg">{e.agent}</span> · {e.dataset} v{e.dataset_version} · {t.version} {e.agent_version} · {fill(t.passed, { passed: e.passed, total: e.total })} · {date(e.finished_at)}
                {e.simulated && <span className="ml-2 text-xs text-warning">{t.simulated}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title={t.incidents} testId="portal-incidents">
        {d.incidents.length === 0 ? <p className="text-sm text-fg-muted">{t.noIncidents}</p> : (
          <ul className="grid gap-3 text-sm">
            {d.incidents.map((i) => (
              <li key={i.number} className="text-fg-secondary">
                <span className="text-fg">#{i.number} {i.title}</span> · {i.severity.toUpperCase()} · {t.incidentStatus[i.status] ?? i.status} · {date(i.detected_at)}
                {i.client_summary && <p className="mt-1 text-fg-muted">{i.client_summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}

/** Invitation activation and account recovery: password, then TOTP enrolment with the first code. */
export function Enrolment({ t, locale, purpose }: { t: PortalDictionary; locale: "bg" | "en"; purpose: "activate" | "recover" }) {
  const token = useRef("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const language = useLanguageSwitch(locale);

  useEffect(() => {
    // The token travels in the URL fragment, so it never reaches a server log; drop it from the address bar.
    token.current = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function start(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await call(`/${purpose}`, { method: "POST", body: JSON.stringify({ token: token.current, password }) });
    if (response.ok) return setSecret((await response.json()).secret);
    setError(response.status === 422 ? t.passwordHint : response.status === 404 ? t.unavailable : t.invalidLink);
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await call(`/${purpose}/confirm`, { method: "POST", body: JSON.stringify({ token: token.current, code }) });
    if (response.ok) return setDone(true);
    setError(t.invalidCode);
  }

  return (
    <Shell t={t} onLanguage={language}>
      <Card title={purpose === "activate" ? t.activateTitle : t.recoverTitle} testId="portal-enrolment">
        {done ? (
          <div className="grid gap-3 text-sm text-fg-secondary">
            <p role="status">{t.activated}</p>
            <Link className="text-brand hover:underline" href="/portal">{t.goSignIn}</Link>
          </div>
        ) : !secret ? (
          <form onSubmit={start} className="grid max-w-sm gap-3">
            <label className="grid gap-1.5 text-sm text-fg-secondary">{t.password}<input className="field" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} /><span className="text-xs text-fg-subtle">{t.passwordHint}</span></label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" className="btn btn-md btn-primary">{t.setPassword}</button>
          </form>
        ) : (
          <form onSubmit={confirm} className="grid max-w-md gap-3">
            <p className="text-sm text-fg-secondary">{t.enrolText}</p>
            <p className="text-sm text-fg-muted">{t.secret}: <code className="break-all font-mono text-fg" data-testid="portal-secret">{secret}</code></p>
            <label className="grid gap-1.5 text-sm text-fg-secondary">{t.code}<input className="field font-mono tracking-widest" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} /></label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" className="btn btn-md btn-primary">{t.confirm}</button>
          </form>
        )}
      </Card>
    </Shell>
  );
}
