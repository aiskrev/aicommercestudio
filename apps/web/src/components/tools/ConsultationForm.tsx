"use client";

import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import type { ConsultationInput } from "@/lib/assessment-api";
import { fetchFormToken } from "@/lib/public-api";

export interface ConsultationTexts {
  title: string;
  text: string;
  open: string;
  name: string;
  email: string;
  company: string;
  message: string;
  privacy: string;
  privacyLink: string;
  marketing: string;
  submit: string;
  submitting: string;
  required: string;
  invalidEmail: string;
  privacyRequired: string;
  failed: string;
  rateLimited: string;
  sent: string;
}

export type ConsultationOutcome = { ok: true; reference: string } | { ok: false; message: string };

const fill = (template: string, values: Record<string, string>) => Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, v), template);

/**
 * Optional consultation / enquiry about a tool result: opened explicitly, contact fields, a required
 * privacy acknowledgement and a separate, unticked marketing consent. A form token and a honeypot
 * protect it; the caller sends it (`send`) and maps API failures to a message. When `unavailable` is
 * set (e.g. the result is not saved yet) it is shown instead of the form.
 */
export function ConsultationForm({
  id,
  content: c,
  privacyHref,
  send,
  unavailable,
}: {
  /** Prefix of the element ids and test ids, e.g. "engine" → engine-consultation, consult-name. */
  id: string;
  content: ConsultationTexts;
  privacyHref: string;
  send: (input: ConsultationInput, formToken: string) => Promise<ConsultationOutcome>;
  unavailable?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", email: "", company: "", message: "", privacy: false, marketing: false, website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [formToken, setFormToken] = useState("");
  const field = (name: string) => (id === "engine" ? `consult-${name}` : `${id}-consult-${name}`);

  useEffect(() => {
    if (open && !formToken) fetchFormToken().then(setFormToken);
  }, [open, formToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (values.name.trim().length < 2) found.name = c.required;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) found.email = c.invalidEmail;
    if (values.company.trim().length < 2) found.company = c.required;
    if (!values.privacy) found.privacy = c.privacyRequired;
    setErrors(found);
    if (Object.keys(found).length) return;
    setSending(true);
    const outcome = await send(
      {
        name: values.name.trim(),
        email: values.email.trim(),
        company: values.company.trim(),
        message: values.message.trim(),
        privacy_acknowledged: values.privacy,
        marketing_consent: values.marketing,
        website: values.website,
      },
      formToken,
    );
    setSending(false);
    fetchFormToken().then(setFormToken);
    setStatus(outcome.ok ? { tone: "success", text: fill(c.sent, { ref: outcome.reference }) } : { tone: "error", text: outcome.message });
  }

  const input = (key: "name" | "email" | "company", label: string, type = "text", autoComplete?: string) => (
    <div className="grid gap-1.5">
      <label htmlFor={field(key)} className="field-label">
        {label} <span className="field-required" aria-hidden="true">*</span>
      </label>
      <input
        id={field(key)}
        type={type}
        autoComplete={autoComplete}
        className="field"
        value={values[key]}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `${field(key)}-error` : undefined}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
      {errors[key] && (
        <p id={`${field(key)}-error`} className="field-error">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <section aria-labelledby={`${id}-consult-title`} className="tool-frame grid gap-4 p-6 sm:p-8 print:hidden" data-testid={`${id}-consultation`}>
      <h2 id={`${id}-consult-title`} className="t-h3-lg">
        {c.title}
      </h2>
      <p className="max-w-2xl text-fg-muted">{c.text}</p>
      {unavailable ? (
        unavailable
      ) : status?.tone === "success" ? (
        <Alert tone="success" role="status">
          {status.text}
        </Alert>
      ) : !open ? (
        <div>
          <Button icon="arrowRight" onClick={() => setOpen(true)}>
            {c.open}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="grid gap-4" data-testid={`${id}-consultation-form`}>
          {status && (
            <Alert tone="error" role="alert">
              {status.text}
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {input("name", c.name, "text", "name")}
            {input("email", c.email, "email", "email")}
            {input("company", c.company, "text", "organization")}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor={field("message")} className="field-label">
              {c.message}
            </label>
            <textarea
              id={field("message")}
              className="field min-h-24"
              maxLength={1000}
              value={values.message}
              onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
            />
          </div>
          <div className="hidden" aria-hidden="true">
            <label htmlFor={field("website")}>Website</label>
            <input id={field("website")} tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-secondary">
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={values.privacy}
                aria-invalid={errors.privacy ? true : undefined}
                aria-describedby={errors.privacy ? `${field("privacy")}-error` : undefined}
                onChange={(e) => setValues((v) => ({ ...v, privacy: e.target.checked }))}
                data-testid="consult-privacy"
              />
              <span>
                {c.privacy}{" "}
                <Link href={privacyHref} className="link">
                  {c.privacyLink}
                </Link>
                .
              </span>
            </label>
            {errors.privacy && (
              <p id={`${field("privacy")}-error`} className="field-error">
                {errors.privacy}
              </p>
            )}
          </div>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-secondary">
            <input
              type="checkbox"
              className="checkbox mt-0.5"
              checked={values.marketing}
              onChange={(e) => setValues((v) => ({ ...v, marketing: e.target.checked }))}
              data-testid="consult-marketing"
            />
            <span>{c.marketing}</span>
          </label>
          <div>
            <Button type="submit" loading={sending} loadingLabel={c.submitting}>
              {c.submit}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
