"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import type { Dictionary } from "@/i18n";
import {
  type ContactErrors,
  type ContactField,
  type ContactValues,
  emptyContactValues,
  LIMITS,
  toPayload,
  validateContact,
} from "@/lib/contact-validation";
import { fetchFormToken, submitLead } from "@/lib/public-api";

export interface ServiceOption {
  value: string;
  label: string;
}

interface Props {
  labels: Dictionary["form"];
  messages: Dictionary["validation"];
  services: ServiceOption[];
  initialService?: string;
  privacyHref: string;
}

type Status = "idle" | "submitting" | "success";

const FIELD_ORDER: ContactField[] = ["service", "name", "company", "email", "phone", "message", "privacy_acknowledged"];

export function ContactForm({ labels, messages, services, initialService = "", privacyHref }: Props) {
  const allowed = services.map((s) => s.value);
  const [values, setValues] = useState<ContactValues>(() =>
    emptyContactValues(allowed.includes(initialService) ? initialService : ""),
  );
  const [errors, setErrors] = useState<ContactErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [reference, setReference] = useState("");
  const [token, setToken] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchFormToken().then((value) => active && setToken(value));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  function update<K extends ContactField>(field: K, value: ContactValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function showErrors(next: ContactErrors, message: string) {
    setErrors(next);
    setFormError(message);
    requestAnimationFrame(() => {
      const first = FIELD_ORDER.find((field) => next[field]);
      if (first) document.getElementById(`contact-${first}`)?.focus();
      else summaryRef.current?.focus();
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;
    setFormError(null);

    const clientErrors = validateContact(values, messages, allowed);
    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors, labels.errorSummary);
      return;
    }

    setStatus("submitting");
    const result = await submitLead(toPayload(values, token));
    if (result.ok) {
      setReference(result.reference);
      setStatus("success");
      return;
    }

    setStatus("idle");
    if (result.kind === "validation") {
      showErrors(result.fieldErrors as ContactErrors, result.message || labels.errorSummary);
    } else if (result.kind === "rate_limited") {
      showErrors({}, labels.rateLimited);
    } else if (result.kind === "network") {
      showErrors({}, labels.networkError);
    } else if (result.kind === "rejected") {
      setToken(await fetchFormToken());
      showErrors({}, result.message || labels.genericError);
    } else {
      showErrors({}, labels.genericError);
    }
  }

  function reset() {
    setValues(emptyContactValues());
    setErrors({});
    setFormError(null);
    setReference("");
    setStatus("idle");
    fetchFormToken().then(setToken);
  }

  if (status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="glass rounded-3xl p-8 text-center outline-none sm:p-12"
        data-testid="contact-success"
      >
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
          <Icon name="check" className="h-7 w-7" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold">{labels.successTitle}</h2>
        <p className="mt-3 text-slate-400">
          {labels.successReference}: <strong className="font-mono text-white">{reference}</strong>
        </p>
        <button type="button" onClick={reset} className={cx(buttonClass("secondary"), "mt-8")}>
          {labels.successAnother}
        </button>
      </div>
    );
  }

  const describedBy = (field: ContactField, hint?: string) =>
    [hint, errors[field] ? `contact-${field}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="glass relative grid gap-6 rounded-3xl p-6 sm:p-8" aria-label={labels.submit}>
      <div ref={summaryRef} tabIndex={-1} aria-live="assertive" className="outline-none">
        {formError && (
          <p role="alert" className="flex gap-3 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200">
            <Icon name="alert" className="h-5 w-5 shrink-0" />
            {formError}
          </p>
        )}
      </div>

      <Field id="service" label={labels.service} required requiredLabel={labels.required} error={errors.service}>
        <div className="relative">
          <select
            id="contact-service"
            name="service"
            className="field appearance-none"
            value={values.service}
            aria-invalid={Boolean(errors.service)}
            aria-describedby={describedBy("service")}
            onChange={(e) => update("service", e.target.value)}
          >
            <option value="">{labels.servicePlaceholder}</option>
            {services.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          />
        </div>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="name" label={labels.name} required requiredLabel={labels.required} error={errors.name}>
          <input
            id="contact-name"
            name="name"
            className="field"
            autoComplete="name"
            maxLength={LIMITS.name.max}
            value={values.name}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={describedBy("name")}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>
        <Field id="company" label={labels.company} required requiredLabel={labels.required} error={errors.company}>
          <input
            id="contact-company"
            name="company"
            className="field"
            autoComplete="organization"
            maxLength={LIMITS.company.max}
            value={values.company}
            aria-invalid={Boolean(errors.company)}
            aria-describedby={describedBy("company")}
            onChange={(e) => update("company", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="email" label={labels.email} required requiredLabel={labels.required} error={errors.email}>
          <input
            id="contact-email"
            name="email"
            type="email"
            inputMode="email"
            className="field"
            autoComplete="email"
            maxLength={LIMITS.email.max}
            value={values.email}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={describedBy("email")}
            onChange={(e) => update("email", e.target.value)}
          />
        </Field>
        <Field id="phone" label={`${labels.phone} (${labels.optional})`} error={errors.phone}>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className="field"
            autoComplete="tel"
            maxLength={LIMITS.phone.max}
            value={values.phone}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={describedBy("phone")}
            onChange={(e) => update("phone", e.target.value)}
          />
        </Field>
      </div>

      <Field
        id="message"
        label={labels.message}
        required
        requiredLabel={labels.required}
        error={errors.message}
        hint={labels.messageHint}
      >
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          className="field resize-y"
          maxLength={LIMITS.message.max}
          value={values.message}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy("message", "contact-message-hint")}
          onChange={(e) => update("message", e.target.value)}
        />
      </Field>

      {/* Honeypot — hidden from people and assistive technology */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">{labels.honeypot}</label>
        <input
          id="contact-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={values.website}
          onChange={(e) => update("website", e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        <div>
          <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-slate-300">
            <input
              id="contact-privacy_acknowledged"
              name="privacy_acknowledged"
              type="checkbox"
              className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-400"
              checked={values.privacy_acknowledged}
              aria-invalid={Boolean(errors.privacy_acknowledged)}
              aria-describedby={describedBy("privacy_acknowledged")}
              onChange={(e) => update("privacy_acknowledged", e.target.checked)}
            />
            <span>
              {labels.privacy}{" "}
              <Link href={privacyHref} className="font-medium text-cyan-300 underline underline-offset-4" target="_blank">
                {labels.privacyLink}
              </Link>{" "}
              {labels.privacySuffix} <span className="text-rose-300">*</span>
            </span>
          </label>
          {errors.privacy_acknowledged && (
            <p id="contact-privacy_acknowledged-error" className="mt-2 text-sm text-rose-300">
              {errors.privacy_acknowledged}
            </p>
          )}
        </div>
        <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-slate-400">
          <input
            id="contact-marketing_consent"
            name="marketing_consent"
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-400"
            checked={values.marketing_consent}
            onChange={(e) => update("marketing_consent", e.target.checked)}
          />
          <span>{labels.marketing}</span>
        </label>
      </div>

      <button type="submit" className={cx(buttonClass("primary", "lg"), "w-full sm:w-auto sm:justify-self-start")} disabled={status === "submitting"}>
        {status === "submitting" ? labels.submitting : labels.submit}
        {status !== "submitting" && <Icon name="arrowRight" className="h-4 w-4" />}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  requiredLabel,
  error,
  hint,
  children,
}: {
  id: ContactField;
  label: string;
  required?: boolean;
  requiredLabel?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`contact-${id}`} className="mb-2 block text-sm font-medium text-slate-200">
        {label}
        {required && (
          <span className="text-rose-300" aria-hidden="true">
            {" "}
            *
          </span>
        )}
        {required && <span className="sr-only"> ({requiredLabel})</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`contact-${id}-hint`} className="mt-2 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`contact-${id}-error`} className="mt-2 text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
