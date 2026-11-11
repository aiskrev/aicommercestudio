"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import type { Dictionary } from "@/i18n";
import type { QuoteContact } from "@/lib/configurator-api";
import { fetchFormToken } from "@/lib/public-api";

export type QuoteSendOutcome = { ok: true; reference: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export interface QuoteContactTexts {
  lead: string;
  goals: { label: string; hint: string };
  special: { label: string; hint: string };
  /** "… Reference: {ref}." */
  sent: string;
  sentNext: string;
  /** Shown above the form when the server names fields to correct. */
  summary: string;
}

type FieldErrors = Partial<Record<string, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\s.-]*$/;

/**
 * Contact and consent fields of a quote request (the project configurator and the quote basket use the same
 * form): required name, company and e-mail, optional phone, goals and special requirements, the required privacy
 * acknowledgement and a separate, unticked marketing consent. A form token and a honeypot protect it. Contact
 * details live only in this component's state: they are never written to browser storage.
 */
export function QuoteContactForm({
  testId,
  form,
  validation,
  texts,
  privacyHref,
  send,
}: {
  testId: string;
  form: Dictionary["form"];
  validation: Dictionary["validation"];
  texts: QuoteContactTexts;
  privacyHref: string;
  /** Sends the request; the caller maps API failures to a message (and field errors, keyed like the API). */
  send: (contact: QuoteContact, formToken: string) => Promise<QuoteSendOutcome>;
}) {
  const [contact, setContact] = useState({ name: "", email: "", company: "", phone: "", goals: "", special: "", privacy: false, marketing: false, website: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [formToken, setFormToken] = useState("");
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    void fetchFormToken().then(setFormToken);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const found: FieldErrors = {};
    if (contact.name.trim().length < 2) found.name = validation.required;
    if (!EMAIL.test(contact.email.trim())) found.email = validation.email;
    if (contact.company.trim().length < 2) found.company = validation.required;
    if (!PHONE.test(contact.phone)) found.phone = validation.phone;
    if (!contact.privacy) found.privacy = validation.privacy;
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`cfg-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setSending(true);
    const outcome = await send(
      {
        name: contact.name.trim(),
        email: contact.email.trim(),
        company: contact.company.trim(),
        phone: contact.phone.trim(),
        goals: contact.goals.trim(),
        special_requirements: contact.special.trim(),
        privacy_acknowledged: contact.privacy,
        marketing_consent: contact.marketing,
        website: contact.website,
      },
      formToken,
    );
    setSending(false);
    if (outcome.ok) {
      setStatus({ tone: "success", text: texts.sent.replace("{ref}", outcome.reference) });
      return;
    }
    void fetchFormToken().then(setFormToken);
    if (outcome.fieldErrors && Object.keys(outcome.fieldErrors).length) {
      const mapped: FieldErrors = {};
      for (const [field, message] of Object.entries(outcome.fieldErrors)) mapped[field === "special_requirements" ? "special" : field] = message;
      setErrors(mapped);
      setStatus({ tone: "error", text: texts.summary });
      return;
    }
    setStatus({ tone: "error", text: outcome.message });
  }

  const textField = (key: "name" | "email" | "company" | "phone", label: string, inputType: string, autoComplete: string, required: boolean) => (
    <div className="grid gap-1.5">
      <label htmlFor={`cfg-${key}`} className="field-label">
        {label}{" "}
        {required ? (
          <span className="field-required" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="font-normal text-fg-muted">({form.optional})</span>
        )}
      </label>
      <input
        id={`cfg-${key}`}
        type={inputType}
        autoComplete={autoComplete}
        className="field"
        maxLength={key === "email" ? 254 : key === "phone" ? 40 : 160}
        required={required}
        value={contact[key]}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `cfg-${key}-error` : undefined}
        onChange={(event) => setContact((previous) => ({ ...previous, [key]: event.target.value }))}
      />
      {errors[key] && (
        <p id={`cfg-${key}-error`} className="field-error">
          {errors[key]}
        </p>
      )}
    </div>
  );

  const area = (key: "goals" | "special", content: { label: string; hint: string }) => (
    <div className="grid gap-1.5">
      <label htmlFor={`cfg-${key}`} className="field-label">
        {content.label}
      </label>
      <textarea
        id={`cfg-${key}`}
        className="field min-h-24"
        maxLength={600}
        value={contact[key]}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={`cfg-${key}-hint${errors[key] ? ` cfg-${key}-error` : ""}`}
        onChange={(event) => setContact((previous) => ({ ...previous, [key]: event.target.value }))}
      />
      <p id={`cfg-${key}-hint`} className="field-hint">
        {content.hint}
      </p>
      {errors[key] && (
        <p id={`cfg-${key}-error`} className="field-error">
          {errors[key]}
        </p>
      )}
    </div>
  );

  if (status?.tone === "success") {
    return (
      <div role="status" className="grid gap-2" data-testid={`${testId}-sent`}>
        <Alert tone="success">{status.text}</Alert>
        <p className="text-body-sm text-fg-muted">{texts.sentNext}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" data-testid={testId}>
      <p className="max-w-2xl text-fg-muted">{texts.lead}</p>
      {status && (
        <Alert tone="error" role="alert">
          {status.text}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {textField("name", form.name, "text", "name", true)}
        {textField("company", form.company, "text", "organization", true)}
        {textField("email", form.email, "email", "email", true)}
        {textField("phone", form.phone, "tel", "tel", false)}
      </div>
      {area("goals", texts.goals)}
      {area("special", texts.special)}
      <div className="hidden" aria-hidden="true">
        <label htmlFor="cfg-website">Website</label>
        <input id="cfg-website" tabIndex={-1} autoComplete="off" value={contact.website} onChange={(event) => setContact((previous) => ({ ...previous, website: event.target.value }))} />
      </div>
      <div className="grid gap-1.5">
        <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-secondary">
          <input
            id="cfg-privacy"
            type="checkbox"
            className="checkbox mt-0.5"
            checked={contact.privacy}
            required
            aria-invalid={errors.privacy ? true : undefined}
            aria-describedby={errors.privacy ? "cfg-privacy-error" : undefined}
            onChange={(event) => setContact((previous) => ({ ...previous, privacy: event.target.checked }))}
          />
          <span>
            {form.privacy}{" "}
            <Link href={privacyHref} className="link">
              {form.privacyLink}
            </Link>
            {form.privacySuffix}
          </span>
        </label>
        {errors.privacy && (
          <p id="cfg-privacy-error" className="field-error">
            {errors.privacy}
          </p>
        )}
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-secondary">
        <input id="cfg-marketing" type="checkbox" className="checkbox mt-0.5" checked={contact.marketing} onChange={(event) => setContact((previous) => ({ ...previous, marketing: event.target.checked }))} />
        <span>{form.marketing}</span>
      </label>
      <div>
        <Button type="submit" loading={sending} loadingLabel={form.submitting}>
          {form.submit}
        </Button>
      </div>
    </form>
  );
}
