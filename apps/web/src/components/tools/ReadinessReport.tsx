"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Alert, Button } from "@/components/ui/primitives";
import type { readinessTool } from "@/content/bg/tool-readiness";
import type { Locale } from "@/i18n/config";
import { fetchFormToken } from "@/lib/public-api";
import type { ReadinessAnswers } from "@/lib/readiness";
import {
  type ReadinessContact,
  type ReadinessMeta,
  fetchReadinessMeta,
  requestReadinessReport,
  saveBlob,
  submitReadiness,
} from "@/lib/readiness-api";

type Content = typeof readinessTool;

const LIMITS = { name: 120, email: 254, company: 160, role: 80, message: 1000, reportCompany: 120 } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Signed form token shared by both actions; refreshed after the server rejects one. */
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

/**
 * Optional follow-ups to a readiness result: a server-rendered PDF report (nothing stored) and an
 * explicit "send the result to the team" form (creates an inquiry). The result itself never needs either.
 */
export function ReadinessReport({
  content,
  answers,
  overall,
  locale,
  privacyHref,
  onExport,
}: {
  content: Content;
  answers: ReadinessAnswers;
  overall: number;
  locale: Locale;
  privacyHref: string;
  onExport?: () => void;
}) {
  const formToken = useFormToken();
  return (
    <div className="grid gap-6 print:hidden">
      <ReportDownload content={content.report} answers={answers} overall={overall} locale={locale} formToken={formToken} onExport={onExport} />
      <SendToTeam content={content.send} answers={answers} overall={overall} locale={locale} privacyHref={privacyHref} formToken={formToken} />
    </div>
  );
}

type FormToken = ReturnType<typeof useFormToken>;

function ReportDownload({
  content,
  answers,
  overall,
  locale,
  formToken,
  onExport,
}: {
  content: Content["report"];
  answers: ReadinessAnswers;
  overall: number;
  locale: Locale;
  formToken: FormToken;
  onExport?: () => void;
}) {
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [companyError, setCompanyError] = useState<string | undefined>();

  async function download() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    setCompanyError(undefined);
    onExport?.();
    const result = await requestReadinessReport({ answers, locale, company, formToken: formToken.token, clientOverall: overall });
    setBusy(false);
    if (result.ok) {
      saveBlob(result.blob, result.fileName);
      setStatus({ tone: "success", text: content.done });
      return;
    }
    if (result.kind === "validation" && result.fieldErrors?.company) {
      setCompanyError(result.fieldErrors.company);
      return;
    }
    if (result.kind === "rejected") void formToken.refresh();
    const messages = {
      stale: content.errors.stale,
      rejected: content.errors.rejected,
      rate_limited: content.errors.rateLimited,
      unavailable: content.errors.unavailable,
      network: content.errors.network,
      validation: content.errors.generic,
      server: content.errors.generic,
    } as const;
    setStatus({ tone: "error", text: messages[result.kind] });
  }

  return (
    <section aria-labelledby="readiness-report-title" className="panel grid gap-5 p-6 sm:p-8" data-testid="readiness-report">
      <div>
        <h2 id="readiness-report-title" className="t-h3 flex items-center gap-2 text-xl">
          <Icon name="fileText" className="h-5 w-5 text-brand" />
          {content.title}
        </h2>
        <p className="mt-2 text-fg-muted">{content.text}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label htmlFor="readiness-report-company" className="field-label">
            {content.companyLabel}
          </label>
          <input
            id="readiness-report-company"
            name="company"
            className="field"
            autoComplete="organization"
            maxLength={LIMITS.reportCompany}
            value={company}
            aria-invalid={Boolean(companyError)}
            aria-describedby={companyError ? "readiness-report-company-error" : "readiness-report-company-hint"}
            onChange={(e) => setCompany(e.target.value)}
          />
          {companyError ? (
            <p id="readiness-report-company-error" className="field-error">
              {companyError}
            </p>
          ) : (
            <p id="readiness-report-company-hint" className="field-hint">
              {content.companyHint}
            </p>
          )}
        </div>
        <Button icon="arrowRight" loading={busy} loadingLabel={content.downloading} onClick={download} className="sm:mb-7" data-testid="readiness-report-download">
          {content.download}
        </Button>
      </div>
      <p className="flex gap-2 text-sm text-fg-subtle">
        <Icon name="lock" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        {content.privacy}
      </p>
      <div aria-live="polite" className="empty:hidden">
        {status && (
          <Alert tone={status.tone} role={status.tone === "error" ? "alert" : "status"}>
            {status.text}
          </Alert>
        )}
      </div>
    </section>
  );
}

type ContactField = Exclude<keyof ReadinessContact, "website" | "consultation_requested" | "marketing_consent">;
type ContactErrors = Partial<Record<ContactField, string>>;
const FIELD_ORDER: ContactField[] = ["name", "email", "company", "role", "message", "privacy_acknowledged"];

const emptyContact = (): ReadinessContact => ({
  name: "",
  email: "",
  company: "",
  role: "",
  message: "",
  consultation_requested: false,
  privacy_acknowledged: false,
  marketing_consent: false,
  website: "",
});

function validate(values: ReadinessContact, t: Content["send"]["errors"]): ContactErrors {
  const errors: ContactErrors = {};
  const short = (field: "name" | "company" | "role") => {
    const value = values[field].trim();
    if (!value) errors[field] = t.required;
    else if (value.length < 2) errors[field] = t.short;
  };
  short("name");
  if (!values.email.trim()) errors.email = t.required;
  else if (!EMAIL.test(values.email.trim())) errors.email = t.email;
  short("company");
  short("role");
  if (!values.privacy_acknowledged) errors.privacy_acknowledged = t.privacy;
  return errors;
}

function SendToTeam({
  content,
  answers,
  overall,
  locale,
  privacyHref,
  formToken,
}: {
  content: Content["send"];
  answers: ReadinessAnswers;
  overall: number;
  locale: Locale;
  privacyHref: string;
  formToken: FormToken;
}) {
  const [open, setOpen] = useState(false);
  const [meta, setMeta] = useState<ReadinessMeta | null>(null);
  const [values, setValues] = useState<ReadinessContact>(emptyContact);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<{ reference: string; message: string } | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || meta) return;
    let active = true;
    fetchReadinessMeta().then((value) => active && setMeta(value));
    return () => {
      active = false;
    };
  }, [open, meta]);

  useEffect(() => {
    if (sent) successRef.current?.focus();
  }, [sent]);

  function update<K extends keyof ReadinessContact>(field: K, value: ReadinessContact[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (field in errors) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function showErrors(next: ContactErrors, message: string) {
    setErrors(next);
    setFormError(message);
    requestAnimationFrame(() => {
      const first = FIELD_ORDER.find((field) => next[field]);
      if (first) document.getElementById(`readiness-send-${first}`)?.focus();
      else summaryRef.current?.focus();
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const clientErrors = validate(values, content.errors);
    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors, content.errorSummary);
      return;
    }
    setSubmitting(true);
    const result = await submitReadiness({ answers, locale, contact: values, formToken: formToken.token, clientOverall: overall });
    setSubmitting(false);
    if (result.ok) {
      setSent({ reference: result.reference, message: result.message });
      return;
    }
    if (result.kind === "validation") {
      const { model_version: stale, answers: answerError, ...fields } = result.fieldErrors;
      showErrors(fields as ContactErrors, stale || answerError || result.message || content.errorSummary);
    } else if (result.kind === "rate_limited") {
      showErrors({}, content.errors.rateLimited);
    } else if (result.kind === "network") {
      showErrors({}, content.errors.network);
    } else if (result.kind === "rejected") {
      void formToken.refresh();
      showErrors({}, result.message || content.errors.generic);
    } else {
      showErrors({}, content.errors.generic);
    }
  }

  if (sent) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="panel border-success/40 p-6 outline-none sm:p-8" data-testid="readiness-send-success">
        <h2 className="t-h3 flex items-center gap-2 text-xl">
          <Icon name="check" className="h-5 w-5 text-success" />
          {content.successTitle}
        </h2>
        <p className="mt-3 text-fg-secondary">{sent.message}</p>
        <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-line-default bg-surface-page px-4 py-3 text-fg-secondary">
          {content.reference}: <strong className="font-mono text-lg tracking-wider text-fg-primary">{sent.reference}</strong>
        </p>
        <p className="mt-4 text-sm text-fg-subtle">{content.noEmail}</p>
      </div>
    );
  }

  const describedBy = (field: ContactField, hint?: string) =>
    [hint, errors[field] ? `readiness-send-${field}-error` : null].filter(Boolean).join(" ") || undefined;
  const textField = (field: "name" | "email" | "company" | "role", label: string, extra: Record<string, string> = {}) => (
    <SendField id={field} label={label} required requiredLabel={content.required} error={errors[field]}>
      <input
        id={`readiness-send-${field}`}
        name={field}
        className="field"
        maxLength={LIMITS[field]}
        value={values[field]}
        aria-invalid={Boolean(errors[field])}
        aria-describedby={describedBy(field)}
        onChange={(e) => update(field, e.target.value)}
        {...extra}
      />
    </SendField>
  );

  return (
    <section aria-labelledby="readiness-send-title" className="panel grid gap-5 p-6 sm:p-8" data-testid="readiness-send">
      <div>
        <h2 id="readiness-send-title" className="t-h3 text-xl">
          {content.title}
        </h2>
        <p className="mt-2 text-fg-muted">{content.text}</p>
      </div>
      <div>
        <Button variant="secondary" aria-expanded={open} aria-controls="readiness-send-form" onClick={() => setOpen((v) => !v)}>
          {open ? content.close : content.open}
        </Button>
      </div>
      {open && (
        <form id="readiness-send-form" onSubmit={onSubmit} noValidate className="relative grid gap-5" aria-label={content.title} aria-busy={submitting || undefined}>
          <p className="text-xs text-fg-subtle">{content.requiredNote}</p>
          <div ref={summaryRef} tabIndex={-1} aria-live="assertive" className="outline-none empty:hidden">
            {formError && (
              <Alert tone="error" role="alert">
                {formError}
              </Alert>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {textField("name", content.name, { autoComplete: "name" })}
            {textField("email", content.email, { type: "email", inputMode: "email", autoComplete: "email" })}
            {textField("company", content.company, { autoComplete: "organization" })}
            {textField("role", content.role, { autoComplete: "organization-title", placeholder: content.rolePlaceholder })}
          </div>
          <SendField id="message" label={`${content.message} (${content.optional})`} error={errors.message}>
            <textarea
              id="readiness-send-message"
              name="message"
              rows={3}
              className="field resize-y"
              maxLength={LIMITS.message}
              value={values.message}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={describedBy("message")}
              onChange={(e) => update("message", e.target.value)}
            />
          </SendField>
          <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-fg-secondary">
            <input
              id="readiness-send-consultation"
              name="consultation_requested"
              type="checkbox"
              className="checkbox mt-0.5"
              checked={values.consultation_requested}
              onChange={(e) => update("consultation_requested", e.target.checked)}
            />
            <span>{content.consultation}</span>
          </label>

          {/* Honeypot — hidden from people and assistive technology */}
          <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
            <label htmlFor="readiness-send-website">{content.honeypot}</label>
            <input id="readiness-send-website" name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => update("website", e.target.value)} />
          </div>

          <div className="grid gap-4 rounded-[var(--radius-md)] border border-line-subtle bg-surface-page/60 p-4 sm:p-5">
            <p className="text-sm text-fg-muted" data-testid="readiness-send-storage">
              {meta ? content.storedDays.replace("{days}", String(meta.retention_days)) : content.stored} {content.noEmail}
            </p>
            <div>
              <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-fg-secondary">
                <input
                  id="readiness-send-privacy_acknowledged"
                  name="privacy_acknowledged"
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={values.privacy_acknowledged}
                  aria-invalid={Boolean(errors.privacy_acknowledged)}
                  aria-describedby={describedBy("privacy_acknowledged")}
                  onChange={(e) => update("privacy_acknowledged", e.target.checked)}
                />
                <span>
                  {content.privacy}{" "}
                  <Link href={privacyHref} className="font-medium text-brand underline underline-offset-4" target="_blank">
                    {content.privacyLink}
                  </Link>{" "}
                  {content.privacySuffix} <span className="field-required">*</span>
                </span>
              </label>
              {errors.privacy_acknowledged && (
                <p id="readiness-send-privacy_acknowledged-error" className="field-error">
                  {errors.privacy_acknowledged}
                </p>
              )}
            </div>
            <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-fg-muted">
              <input
                id="readiness-send-marketing_consent"
                name="marketing_consent"
                type="checkbox"
                className="checkbox mt-0.5"
                checked={values.marketing_consent}
                onChange={(e) => update("marketing_consent", e.target.checked)}
              />
              <span>{content.marketing}</span>
            </label>
          </div>
          <div>
            <Button type="submit" icon="arrowRight" loading={submitting} loadingLabel={content.submitting}>
              {content.submit}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function SendField({
  id,
  label,
  required,
  requiredLabel,
  error,
  children,
}: {
  id: ContactField;
  label: string;
  required?: boolean;
  requiredLabel?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`readiness-send-${id}`} className="field-label">
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
        <p id={`readiness-send-${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
