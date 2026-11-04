"use client";

import { type FormEvent, useMemo, useState } from "react";
import { encode } from "uqr";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Panel } from "@/components/admin/ui";
import { Alert, Button } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { adminFetch, ApiError } from "@/lib/admin-api";
import type { AdminSession, MfaConfirm, MfaSetup, MfaStatus } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";
import { useAdminData } from "@/lib/use-admin-data";

/** Base32 key in groups of four, easier to type into an authenticator app. */
export function groupKey(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(" ") ?? secret;
}

/**
 * The otpauth URI as a QR code. The URI contains the TOTP secret, so the code is built here and drawn as
 * inline SVG: nothing leaves the page and the CSP needs no change. Black on its own white background with
 * the standard four-module quiet zone, because scanners fail on the dark admin theme. Four pixels per
 * module keeps every module the same size on screen.
 */
function KeyQrCode({ uri, label }: { uri: string; label: string }) {
  const { size, path } = useMemo(() => {
    const qr = encode(uri, { ecc: "M", border: 4 });
    const modules = qr.data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : "")));
    return { size: qr.size, path: modules.join("") };
  }, [uri]);

  return (
    <svg
      role="img"
      aria-label={label}
      data-testid="mfa-qr"
      viewBox={`0 0 ${size} ${size}`}
      width={size * 4}
      height={size * 4}
      shapeRendering="crispEdges"
      className="h-auto max-w-full shrink-0 rounded-lg"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

function codeError(err: unknown, invalid: string, fallback: string): string {
  if (err instanceof ApiError && err.code === "mfa_code_invalid") return invalid;
  return err instanceof ApiError ? err.message : fallback;
}

function CodeField({ id, value, onChange, recovery = false }: { id: string; value: string; onChange: (value: string) => void; recovery?: boolean }) {
  const t = useAdminI18n().t.mfa;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-200">
        {t.code}
      </label>
      <input
        id={id}
        className="field font-mono tracking-widest"
        inputMode={recovery ? "text" : "numeric"}
        autoComplete="one-time-code"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={recovery ? 32 : 6}
        aria-describedby={recovery ? `${id}-hint` : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
      {recovery && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-400">
          {t.codeHint}
        </p>
      )}
    </div>
  );
}

/** Second sign-in step: an authenticator code or a one-time recovery code. */
export function MfaCodeStep({ onVerified, onCancel, onLocked }: { onVerified: () => void; onCancel: () => void; onLocked: () => void }) {
  const t = useAdminI18n().t.mfa;
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return setError(t.missingCode);
    setBusy(true);
    setError(null);
    try {
      await adminFetch<AdminSession>("/api/admin/auth/mfa/verify", { method: "POST", body: JSON.stringify({ code: code.trim() }) });
      onVerified();
    } catch (err) {
      setBusy(false);
      setCode("");
      if (err instanceof ApiError && err.status === 429) return onLocked();
      setError(codeError(err, t.invalidCode, t.failed));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-5" aria-label={t.codeTitle} data-testid="mfa-code-step">
      <div>
        <h2 className="text-lg font-semibold text-white">{t.codeTitle}</h2>
        <p className="mt-1 text-sm text-slate-400">{t.codeIntro}</p>
      </div>
      {error && <Alert tone="error" role="alert">{error}</Alert>}
      <CodeField id="mfa-code" value={code} onChange={setCode} recovery />
      <div className="grid gap-2">
        <Button type="submit" size="lg" className="w-full" loading={busy} loadingLabel={t.verifying}>
          {t.verify}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onCancel} disabled={busy}>
          {t.cancel}
        </Button>
      </div>
    </form>
  );
}

/** Show a new key, then activate it with a first code. Used at sign-in (forced) and on the account page. */
export function MfaEnrolment({ onConfirmed, onCancel }: { onConfirmed: (result: MfaConfirm) => void; onCancel?: () => void }) {
  const t = useAdminI18n().t.mfa;
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  /** Copies the key without the display spaces: some authenticator apps refuse them. */
  async function copyKey(secret: string) {
    setError(null);
    try {
      await navigator.clipboard.writeText(secret);
      setKeyCopied(true);
    } catch {
      setKeyCopied(false);
      setError(t.copyKeyFailed);
    }
  }

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setSetup(await adminFetch<MfaSetup>("/api/admin/auth/mfa/setup", { method: "POST" }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.failed);
    }
    setBusy(false);
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) return setError(t.missingCode);
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch<MfaConfirm>("/api/admin/auth/mfa/confirm", { method: "POST", body: JSON.stringify({ code: code.trim() }) });
      onConfirmed(result);
    } catch (err) {
      setBusy(false);
      setCode("");
      setError(codeError(err, t.invalidCode, t.failed));
    }
  }

  if (!setup) {
    return (
      <div className="grid gap-4 text-sm text-slate-300" data-testid="mfa-enrolment">
        <p>{t.enrolIntro}</p>
        {error && <Alert tone="error" role="alert">{error}</Alert>}
        <div className="flex flex-wrap gap-2">
          <Button icon="shield" onClick={start} loading={busy} loadingLabel={t.starting}>
            {t.start}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={busy}>
              {t.cancel}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} noValidate className="grid gap-4 text-sm text-slate-300" data-testid="mfa-enrolment">
      <p>{t.keyIntro}</p>
      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-white/[0.07] p-4">
        <KeyQrCode uri={setup.otpauth_uri} label={t.qrLabel} />
        <div className="min-w-56 flex-1">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t.key}</p>
          <code className="mt-1 block break-all font-mono text-base text-white" data-testid="mfa-secret" data-secret={setup.secret}>
            {groupKey(setup.secret)}
          </code>
          <Button variant="secondary" size="sm" icon="clipboard" className="mt-3" onClick={() => copyKey(setup.secret)}>
            {keyCopied ? t.copied : t.copyKey}
          </Button>
          <a href={setup.otpauth_uri} className="mt-3 block text-sm text-brand hover:underline">
            {t.openApp}
          </a>
        </div>
      </div>
      {error && <Alert tone="error" role="alert">{error}</Alert>}
      <CodeField id="mfa-enrol-code" value={code} onChange={setCode} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={busy} loadingLabel={t.confirming}>
          {t.confirm}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {t.cancel}
          </Button>
        )}
      </div>
    </form>
  );
}

/** One-time recovery codes, shown once after enrolment or replacement. */
export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone?: () => void }) {
  const t = useAdminI18n().t.mfa;
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-4 text-sm text-slate-300" data-testid="mfa-recovery-codes">
      <div>
        <h3 className="font-semibold text-white">{t.codesTitle}</h3>
        <p className="mt-1">{t.codesIntro}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.07] p-4 font-mono text-white">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon="clipboard" onClick={copy}>
          {copied ? t.copied : t.copy}
        </Button>
        {onDone && <Button onClick={onDone}>{t.codesDone}</Button>}
      </div>
    </div>
  );
}

/** Account page: status, enrolment, replacing recovery codes and switching the factor off. */
export function MfaPanel() {
  const status = useAdminData<MfaStatus>("/api/admin/auth/mfa");
  const { t: dict, locale } = useAdminI18n();
  const t = dict.mfa;
  const [enrolling, setEnrolling] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"regenerate" | "disable" | null>(null);
  const [regenerateCode, setRegenerateCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [password, setPassword] = useState("");

  async function regenerate(event: FormEvent) {
    event.preventDefault();
    if (!regenerateCode.trim()) return setError(t.missingCode);
    setBusy("regenerate");
    setError(null);
    setNotice(null);
    try {
      const result = await adminFetch<{ recovery_codes: string[] }>("/api/admin/auth/mfa/recovery-codes", {
        method: "POST",
        body: JSON.stringify({ code: regenerateCode.trim() }),
      });
      setCodes(result.recovery_codes);
      status.reload();
    } catch (err) {
      setError(codeError(err, t.invalidCode, t.failed));
    }
    setRegenerateCode("");
    setBusy(null);
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    if (!disableCode.trim() || !password) return setError(t.missingCode);
    setBusy("disable");
    setError(null);
    setNotice(null);
    try {
      await adminFetch("/api/admin/auth/mfa/disable", { method: "POST", body: JSON.stringify({ password, code: disableCode.trim() }) });
      setNotice(t.disabled);
      setCodes(null);
      status.reload();
    } catch (err) {
      setError(codeError(err, t.invalidCode, t.failed));
    }
    setPassword("");
    setDisableCode("");
    setBusy(null);
  }

  const data = status.data;
  return (
    <Panel title={t.panelTitle}>
      <div className="grid gap-4 text-sm text-slate-300" data-testid="mfa-panel">
        {status.error && <Alert tone="error" role="alert">{status.error}</Alert>}
        {data && (
          <p data-testid="mfa-status">
            {data.enabled && data.enabled_at ? fmt(t.statusOn, { date: formatDateTime(data.enabled_at, locale) }) : t.statusOff}
            {data.required && <span className="ml-1 text-slate-400">{t.required}</span>}
          </p>
        )}
        {notice && <Alert tone="success" role="status">{notice}</Alert>}
        {error && <Alert tone="error" role="alert">{error}</Alert>}
        {codes && <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />}

        {data && !data.enabled && !codes && (
          enrolling ? (
            <MfaEnrolment
              onCancel={() => setEnrolling(false)}
              onConfirmed={(result) => {
                setEnrolling(false);
                setCodes(result.recovery_codes);
                setNotice(t.enabled);
                status.reload();
              }}
            />
          ) : (
            <div>
              <Button icon="shield" onClick={() => setEnrolling(true)}>
                {t.setUp}
              </Button>
            </div>
          )
        )}

        {data?.enabled && !codes && (
          <>
            <p>{fmt(t.remaining, { count: data.recovery_codes_remaining })}</p>
            <form onSubmit={regenerate} noValidate className="grid max-w-sm gap-3" aria-label={t.regenerateTitle}>
              <h3 className="font-semibold text-white">{t.regenerateTitle}</h3>
              <p className="text-xs text-slate-400">{t.regenerateHint}</p>
              <CodeField id="mfa-regenerate-code" value={regenerateCode} onChange={setRegenerateCode} />
              <div>
                <Button type="submit" variant="secondary" loading={busy === "regenerate"} disabled={busy !== null}>
                  {t.regenerate}
                </Button>
              </div>
            </form>
            {!data.required && (
              <form onSubmit={disable} noValidate className="grid max-w-sm gap-3" aria-label={t.disableTitle}>
                <h3 className="font-semibold text-white">{t.disableTitle}</h3>
                <p className="text-xs text-slate-400">{t.disableHint}</p>
                <div>
                  <label htmlFor="mfa-disable-password" className="mb-2 block text-sm font-medium text-slate-200">
                    {t.password}
                  </label>
                  <input
                    id="mfa-disable-password"
                    type="password"
                    autoComplete="current-password"
                    className="field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <CodeField id="mfa-disable-code" value={disableCode} onChange={setDisableCode} />
                <div>
                  <Button type="submit" variant="dangerOutline" loading={busy === "disable"} disabled={busy !== null}>
                    {t.disable}
                  </Button>
                </div>
              </form>
            )}
            <p className="text-xs text-slate-400">{t.lostDevice}</p>
          </>
        )}
      </div>
    </Panel>
  );
}
