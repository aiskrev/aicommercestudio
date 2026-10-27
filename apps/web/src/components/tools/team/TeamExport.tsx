"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { fill } from "@/components/tools/team/TeamControls";
import { Icon } from "@/components/ui/Icon";
import { Alert, Button } from "@/components/ui/primitives";
import type { teamTool } from "@/content/bg/tool-team";
import type { Locale } from "@/i18n/config";
import type { TeamConfig } from "@/lib/ai-team";
import { fetchFormToken } from "@/lib/public-api";
import { saveBlob } from "@/lib/readiness-api";
import { type Overrides, type TeamContact, type TeamMeta, requestTeamReport, saveTeamConfiguration, submitTeam } from "@/lib/team-api";

type Content = typeof teamTool;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { name: 120, email: 254, company: 160, role: 80, message: 1000, reportCompany: 120 } as const;

/** Signed anti-bot form token shared by the PDF, save and consultation actions. */
function useFormToken() {
  const [token, setToken] = useState("");
  useEffect(() => {
    let active = true;
    fetchFormToken().then((value) => active && setToken(value));
    return () => {
      active = false;
    };
  }, []);
  return { token, refresh: () => fetchFormToken().then(setToken) };
}
type FormToken = ReturnType<typeof useFormToken>;

/** Follow-ups to a configured team: PDF plan, a saved link, an optional consultation request. */
export function TeamExport({
  content,
  config,
  overrides,
  locale,
  meta,
  privacyHref,
  onExport,
}: {
  content: Content;
  config: TeamConfig;
  overrides: Overrides;
  locale: Locale;
  meta: TeamMeta | null;
  privacyHref: string;
  onExport?: (format: "pdf" | "link") => void;
}) {
  const formToken = useFormToken();
  return (
    <div className="grid gap-6 print:hidden">
      <div className="grid gap-6 lg:grid-cols-2">
        <ReportCard content={content} config={config} overrides={overrides} locale={locale} formToken={formToken} onExport={() => onExport?.("pdf")} />
        <SaveCard content={content} config={config} overrides={overrides} locale={locale} meta={meta} formToken={formToken} onSaved={() => onExport?.("link")} />
      </div>
      <ConsultCard content={content} config={config} overrides={overrides} locale={locale} meta={meta} privacyHref={privacyHref} formToken={formToken} />
    </div>
  );
}

function Status({ status }: { status: { tone: "success" | "error"; text: string } | null }) {
  return (
    <div aria-live="polite" className="empty:hidden">
      {status && (
        <Alert tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>
          {status.text}
        </Alert>
      )}
    </div>
  );
}

function ReportCard({
  content,
  config,
  overrides,
  locale,
  formToken,
  onExport,
}: {
  content: Content;
  config: TeamConfig;
  overrides: Overrides;
  locale: Locale;
  formToken: FormToken;
  onExport: () => void;
}) {
  const t = content.report;
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function download() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    onExport();
    const result = await requestTeamReport({ config, locale, overrides, company, formToken: formToken.token });
    setBusy(false);
    if (result.ok) {
      saveBlob(result.blob, result.fileName);
      setStatus({ tone: "success", text: t.done });
      return;
    }
    if (result.kind === "rejected") void formToken.refresh();
    const e = content.consult.errors;
    const text =
      result.kind === "validation" && result.fieldErrors?.company
        ? result.fieldErrors.company
        : result.kind === "stale"
          ? content.costs.stale
          : result.kind === "rejected"
            ? e.rejected
            : result.kind === "rate_limited"
              ? e.rateLimited
              : result.kind === "network"
                ? e.network
                : e.generic;
    setStatus({ tone: "error", text });
  }

  return (
    <section aria-labelledby="team-report-title" className="panel grid content-start gap-4 p-6" data-testid="team-report">
      <h2 id="team-report-title" className="t-h3 flex items-center gap-2 text-xl">
        <Icon name="fileText" className="h-5 w-5 text-brand" />
        {t.title}
      </h2>
      <p className="text-fg-muted">{t.text}</p>
      <div>
        <label htmlFor="team-report-company" className="field-label">
          {t.companyLabel}
        </label>
        <input
          id="team-report-company"
          className="field"
          autoComplete="organization"
          maxLength={LIMITS.reportCompany}
          value={company}
          aria-describedby="team-report-company-hint"
          onChange={(event) => setCompany(event.target.value)}
        />
        <p id="team-report-company-hint" className="field-hint">
          {t.companyHint}
        </p>
      </div>
      <div>
        <Button icon="arrowRight" loading={busy} loadingLabel={t.downloading} onClick={download}>
          {t.download}
        </Button>
      </div>
      <p className="flex gap-2 text-sm text-fg-subtle">
        <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        {t.privacy}
      </p>
      <Status status={status} />
    </section>
  );
}

function SaveCard({
  content,
  config,
  overrides,
  locale,
  meta,
  formToken,
  onSaved,
}: {
  content: Content;
  config: TeamConfig;
  overrides: Overrides;
  locale: Locale;
  meta: TeamMeta | null;
  formToken: FormToken;
  onSaved: () => void;
}) {
  const t = content.save;
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; expires: string } | null>(null);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    const result = await saveTeamConfiguration(config, locale, overrides, formToken.token);
    setBusy(false);
    if (!result.ok) {
      if (result.kind === "rejected") void formToken.refresh();
      setStatus({ tone: "error", text: result.kind === "rejected" ? content.consult.errors.rejected : result.kind === "rate_limited" ? content.consult.errors.rateLimited : t.error });
      return;
    }
    onSaved();
    const expires = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "bg-BG", { dateStyle: "long" }).format(new Date(result.data.expires_at));
    setLink({ url: `${window.location.origin}${window.location.pathname}?c=${encodeURIComponent(result.data.token)}`, expires });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setStatus({ tone: "success", text: t.copied });
    } catch {
      setStatus({ tone: "error", text: t.error });
    }
  }

  return (
    <section aria-labelledby="team-save-title" className="panel grid content-start gap-4 p-6" data-testid="team-save">
      <h2 id="team-save-title" className="t-h3 flex items-center gap-2 text-xl">
        <Icon name="database" className="h-5 w-5 text-brand" />
        {t.title}
      </h2>
      <p className="text-fg-muted">{fill(t.text, { days: meta?.retention_days ?? 90 })}</p>
      {link ? (
        <div className="grid gap-3" role="status">
          <p className="text-sm text-fg-secondary">{fill(t.saved, { date: link.expires })}</p>
          <label htmlFor="team-saved-link" className="sr-only">
            {t.title}
          </label>
          <input id="team-saved-link" readOnly className="field font-mono text-sm" value={link.url} onFocus={(event) => event.target.select()} data-testid="team-saved-link" />
          <div>
            <Button variant="secondary" size="sm" onClick={copy}>
              {t.copy}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button variant="secondary" loading={busy} loadingLabel={t.saving} onClick={save}>
            {t.button}
          </Button>
        </div>
      )}
      <Status status={status} />
    </section>
  );
}

type ContactField = "name" | "email" | "company" | "role" | "message" | "privacy_acknowledged";
const FIELD_ORDER: ContactField[] = ["name", "email", "company", "role", "message", "privacy_acknowledged"];
const emptyContact = (): TeamContact => ({ name: "", email: "", company: "", role: "", message: "", privacy_acknowledged: false, marketing_consent: false, website: "" });

function ConsultCard({
  content,
  config,
  overrides,
  locale,
  meta,
  privacyHref,
  formToken,
}: {
  content: Content;
  config: TeamConfig;
  overrides: Overrides;
  locale: Locale;
  meta: TeamMeta | null;
  privacyHref: string;
  formToken: FormToken;
}) {
  const t = content.consult;
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<TeamContact>(emptyContact);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ reference: string; message: string } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  function update<K extends keyof TeamContact>(field: K, value: TeamContact[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validate(): Partial<Record<ContactField, string>> {
    const e: Partial<Record<ContactField, string>> = {};
    for (const field of ["name", "company", "role"] as const) {
      const value = values[field].trim();
      if (!value) e[field] = t.errors.required;
      else if (value.length < 2) e[field] = t.errors.short;
    }
    if (!values.email.trim()) e.email = t.errors.required;
    else if (!EMAIL.test(values.email.trim())) e.email = t.errors.email;
    if (!values.privacy_acknowledged) e.privacy_acknowledged = t.errors.privacy;
    return e;
  }

  function showErrors(next: Partial<Record<ContactField, string>>, message: string) {
    setErrors(next);
    setFormError(message);
    requestAnimationFrame(() => {
      const first = FIELD_ORDER.find((field) => next[field]);
      if (first) document.getElementById(`team-consult-${first}`)?.focus();
      else summaryRef.current?.focus();
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors, t.errorSummary);
      return;
    }
    setSubmitting(true);
    const result = await submitTeam({ config, locale, overrides, contact: values, formToken: formToken.token });
    setSubmitting(false);
    if (result.ok) {
      setSent({ reference: result.reference, message: result.message });
      return;
    }
    if (result.kind === "validation") {
      const { model_version: stale, config: configError, ...fields } = result.fieldErrors;
      showErrors(fields as Partial<Record<ContactField, string>>, stale || configError || result.message || t.errorSummary);
    } else if (result.kind === "rate_limited") showErrors({}, t.errors.rateLimited);
    else if (result.kind === "network") showErrors({}, t.errors.network);
    else if (result.kind === "rejected") {
      void formToken.refresh();
      showErrors({}, result.message || t.errors.rejected);
    } else showErrors({}, t.errors.generic);
  }

  if (sent) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="panel border-success/40 p-6 outline-none sm:p-8" data-testid="team-consult-success">
        <h2 className="t-h3 flex items-center gap-2 text-xl">
          <Icon name="check" className="h-5 w-5 text-success" />
          {t.successTitle}
        </h2>
        <p className="mt-3 text-fg-secondary">{sent.message}</p>
        <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-line-default bg-surface-page px-4 py-3 text-fg-secondary">
          {t.reference}: <strong className="font-mono text-lg tracking-wider text-fg">{sent.reference}</strong>
        </p>
        <p className="mt-4 text-sm text-fg-subtle">{t.noEmail}</p>
      </div>
    );
  }

  const describedBy = (field: ContactField) => (errors[field] ? `team-consult-${field}-error` : undefined);
  const textField = (field: "name" | "email" | "company" | "role", label: string, extra: Record<string, string> = {}) => (
    <Field id={field} label={label} required requiredLabel={t.required} error={errors[field]}>
      <input
        id={`team-consult-${field}`}
        name={field}
        className="field"
        maxLength={LIMITS[field]}
        value={values[field]}
        aria-invalid={Boolean(errors[field]) || undefined}
        aria-describedby={describedBy(field)}
        onChange={(event) => update(field, event.target.value)}
        {...extra}
      />
    </Field>
  );

  return (
    <section aria-labelledby="team-consult-title" className="panel grid gap-5 p-6 sm:p-8" data-testid="team-consult">
      <div>
        <h2 id="team-consult-title" className="t-h3 text-xl">
          {t.title}
        </h2>
        <p className="mt-2 text-fg-muted">{t.text}</p>
      </div>
      <div>
        <Button variant="secondary" aria-expanded={open} aria-controls="team-consult-form" onClick={() => setOpen((v) => !v)}>
          {open ? t.close : t.open}
        </Button>
      </div>
      {open && (
        <form id="team-consult-form" onSubmit={onSubmit} noValidate className="relative grid gap-5" aria-label={t.title} aria-busy={submitting || undefined}>
          <p className="text-xs text-fg-subtle">{t.requiredNote}</p>
          <div ref={summaryRef} tabIndex={-1} aria-live="assertive" className="outline-none empty:hidden">
            {formError && (
              <Alert tone="error" role="alert">
                {formError}
              </Alert>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {textField("name", t.name, { autoComplete: "name" })}
            {textField("email", t.email, { type: "email", inputMode: "email", autoComplete: "email" })}
            {textField("company", t.company, { autoComplete: "organization" })}
            {textField("role", t.role, { autoComplete: "organization-title" })}
          </div>
          <Field id="message" label={`${t.message} (${t.optional})`} error={errors.message}>
            <textarea
              id="team-consult-message"
              name="message"
              rows={3}
              className="field resize-y"
              maxLength={LIMITS.message}
              value={values.message}
              onChange={(event) => update("message", event.target.value)}
            />
          </Field>
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label htmlFor="team-consult-website">{t.honeypot}</label>
            <input id="team-consult-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => update("website", event.target.value)} />
          </div>
          <div className="grid gap-4 rounded-[var(--radius-md)] border border-line-subtle bg-surface-page/60 p-4 sm:p-5">
            <p className="text-sm text-fg-muted" data-testid="team-consult-storage">
              {fill(t.stored, { days: meta?.submission_retention_days ?? 365 })} {t.noEmail}
            </p>
            <div>
              <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-fg-secondary">
                <input
                  id="team-consult-privacy_acknowledged"
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={values.privacy_acknowledged}
                  aria-invalid={Boolean(errors.privacy_acknowledged) || undefined}
                  aria-describedby={describedBy("privacy_acknowledged")}
                  onChange={(event) => update("privacy_acknowledged", event.target.checked)}
                />
                <span>
                  {t.privacy}{" "}
                  <Link href={privacyHref} className="font-medium text-brand underline underline-offset-4" target="_blank">
                    {t.privacyLink}
                  </Link>{" "}
                  {t.privacySuffix} <span className="field-required">*</span>
                </span>
              </label>
              {errors.privacy_acknowledged && (
                <p id="team-consult-privacy_acknowledged-error" className="field-error">
                  {errors.privacy_acknowledged}
                </p>
              )}
            </div>
            <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-fg-muted">
              <input
                id="team-consult-marketing_consent"
                type="checkbox"
                className="checkbox mt-0.5"
                checked={values.marketing_consent}
                onChange={(event) => update("marketing_consent", event.target.checked)}
              />
              <span>{t.marketing}</span>
            </label>
          </div>
          <div>
            <Button type="submit" icon="arrowRight" loading={submitting} loadingLabel={t.submitting}>
              {t.submit}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function Field({ id, label, required, requiredLabel, error, children }: { id: ContactField; label: string; required?: boolean; requiredLabel?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={`team-consult-${id}`} className="field-label">
        {label}
        {required && (
          <span className="field-required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
        {required && <span className="sr-only"> ({requiredLabel})</span>}
      </label>
      {children}
      {error && (
        <p id={`team-consult-${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
