"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { Alert, Button, buttonClass, cx } from "@/components/ui/primitives";
import type { Dictionary } from "@/i18n";
import { AiManagedFields } from "@/components/contact/AiManagedFields";
import { Field } from "@/components/contact/FormField";
import {
  AI_MANAGED_SERVICE,
  type ContactErrors,
  type ContactField,
  type ContactValues,
  emptyContactValues,
  type InquiryKind,
  LIMITS,
  QUOTE_OPTIONS,
  submissionEndpoint,
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
  inquiry: Dictionary["inquiry"];
  services: ServiceOption[];
  initialService?: string;
  initialInquiry?: InquiryKind;
  privacyHref: string;
  nextSteps?: string[];
  /** Pre-filled project description (e.g. a consultation request from the AI advisor). */
  initialMessage?: string;
  /** Stored advisor assessment to attach to the lead, with a note explaining that to the visitor. */
  advisorAssessmentId?: string;
  advisorNote?: string;
  /** UI language: sent with the inquiry and used as the default communication language. */
  locale?: "bg" | "en";
  /** Labels for the AI Managed Services section (shown when that service is selected). */
  aiLabels: Dictionary["aiManagedForm"];
}

type Status = "idle" | "submitting" | "success";

const FIELD_ORDER: ContactField[] = [
  "service",
  "name",
  "company",
  "email",
  "phone",
  "platform",
  "budget_range",
  "timeline",
  "website_url",
  "ai_sector",
  "ai_system_types",
  "ai_agents_count",
  "ai_provider",
  "ai_hosting",
  "ai_support_interests",
  "ai_communication_language",
  "ai_additional_notes",
  "message",
  "privacy_acknowledged",
];

export function ContactForm({
  labels,
  messages,
  inquiry,
  services,
  initialService = "",
  initialInquiry = "contact",
  privacyHref,
  nextSteps,
  initialMessage = "",
  advisorAssessmentId,
  advisorNote,
  locale = "bg",
  aiLabels,
}: Props) {
  const allowed = services.map((s) => s.value);
  const [values, setValues] = useState<ContactValues>(() => ({
    ...emptyContactValues(allowed.includes(initialService) ? initialService : "", initialInquiry),
    message: initialMessage,
    ai_communication_language: locale,
  }));
  const aiManaged = values.service === AI_MANAGED_SERVICE;
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

  /** Validate a single field when the visitor leaves it (only once something was typed). */
  function validateOnBlur(field: ContactField) {
    const value = values[field];
    if (typeof value === "string" && !value.trim()) return;
    const fieldError = validateContact(values, messages, allowed)[field];
    setErrors((current) => ({ ...current, [field]: fieldError }));
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
    // The outline alone is not a project description.
    if (values.message.trim() === labels.messageTemplate.trim()) clientErrors.message = messages.required;
    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors, labels.errorSummary);
      return;
    }

    setStatus("submitting");
    const payload = toPayload(values, token, locale);
    const result = await submitLead(
      advisorAssessmentId ? { ...payload, advisor_assessment_id: advisorAssessmentId } : payload,
      submissionEndpoint(values),
      locale,
    );
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
    setValues((current) => ({ ...emptyContactValues("", current.inquiry_type), ai_communication_language: locale }));
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
        className="panel border-success/40 p-8 outline-none sm:p-10"
        data-testid="contact-success"
      >
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-[var(--radius-md)] border border-success/40 bg-success/10 text-success">
          <Icon name="check" className="h-7 w-7" />
        </span>
        <h2 className="t-h2 mt-6 text-2xl sm:text-3xl">{labels.successTitle}</h2>
        <p className="mt-3 text-slate-300">{labels.successLead}</p>
        <p className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-line-default bg-surface-page px-4 py-3 text-fg-secondary">
          {labels.successReference}: <strong className="font-mono text-lg tracking-wider text-white">{reference}</strong>
        </p>
        {nextSteps && nextSteps.length > 0 && (
          <ol className="mt-6 grid gap-3">
            {nextSteps.map((step, index) => (
              <li key={step} className="flex gap-3 text-slate-300">
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] border border-brand/40 font-mono text-xs text-brand">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        )}
        <button type="button" onClick={reset} className={cx(buttonClass("secondary"), "mt-8")}>
          {labels.successAnother}
        </button>
      </div>
    );
  }

  const describedBy = (field: ContactField, hint?: string) =>
    [hint, errors[field] ? `contact-${field}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="panel relative grid gap-6 p-6 sm:p-8"
      aria-label={labels.submit}
      aria-busy={status === "submitting" || undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-h3 text-xl">{labels.formTitle}</h2>
        <p className="text-xs text-slate-400">{labels.requiredNote}</p>
      </div>
      <div ref={summaryRef} tabIndex={-1} aria-live="assertive" className="outline-none empty:hidden">
        {formError && (
          <Alert tone="error" role="alert">
            {formError}
          </Alert>
        )}
      </div>
      {advisorAssessmentId && advisorNote && (
        <Alert tone="info" role="note">
          {advisorNote}
        </Alert>
      )}

      <FormGroup index={1} label={labels.groupRequest} />
      <fieldset>
        <legend className="field-label">{inquiry.legend}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["contact", "quote"] as const).map((kind) => (
            <label
              key={kind}
              className={cx(
                "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                values.inquiry_type === kind
                  ? "border-cyan-400/60 bg-cyan-400/[0.07]"
                  : "border-white/[0.12] hover:border-white/25",
              )}
            >
              <input
                type="radio"
                name="inquiry_type"
                value={kind}
                checked={values.inquiry_type === kind}
                onChange={() => update("inquiry_type", kind)}
                className="checkbox mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold text-white">{inquiry.types[kind].label}</span>
                <span className="block text-xs text-slate-400">{inquiry.types[kind].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

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

      <FormGroup index={2} label={labels.groupAbout} />
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
            onBlur={() => validateOnBlur("name")}
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
            onBlur={() => validateOnBlur("company")}
          />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="email" label={labels.email} required requiredLabel={labels.required} error={errors.email} hint={labels.emailHint}>
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
            aria-describedby={describedBy("email", errors.email ? undefined : "contact-email-hint")}
            onChange={(e) => update("email", e.target.value)}
            onBlur={() => validateOnBlur("email")}
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
            onBlur={() => validateOnBlur("phone")}
          />
        </Field>
      </div>

      <FormGroup index={3} label={labels.groupProject} />
      {values.inquiry_type === "quote" && (
        <div className="grid gap-6 rounded-[var(--radius-lg)] border border-line-subtle bg-surface-page/60 p-4 sm:p-5" data-testid="quote-fields">
          <div className="grid gap-6 sm:grid-cols-3">
            {(
              [
                ["platform", inquiry.platform, inquiry.platformPlaceholder, inquiry.platforms],
                ["budget_range", inquiry.budget, inquiry.budgetPlaceholder, inquiry.budgets],
                ["timeline", inquiry.timeline, inquiry.timelinePlaceholder, inquiry.timelines],
              ] as const
            ).map(([field, label, placeholder, options]) => (
              <Field key={field} id={field} label={label} required requiredLabel={labels.required} error={errors[field]}>
                <div className="relative">
                  <select
                    id={`contact-${field}`}
                    name={field}
                    className="field"
                    value={values[field]}
                    aria-invalid={Boolean(errors[field])}
                    aria-describedby={describedBy(field)}
                    onChange={(e) => update(field, e.target.value)}
                  >
                    <option value="">{placeholder}</option>
                    {QUOTE_OPTIONS[field].map((value) => (
                      <option key={value} value={value}>
                        {(options as Record<string, string>)[value]}
                      </option>
                    ))}
                  </select>
                  <Icon
                    name="chevronDown"
                    className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  />
                </div>
              </Field>
            ))}
          </div>
          <Field id="website_url" label={`${inquiry.website} (${labels.optional})`} error={errors.website_url} hint={inquiry.websiteHint}>
            <input
              id="contact-website_url"
              name="website_url"
              type="url"
              inputMode="url"
              className="field"
              autoComplete="url"
              maxLength={LIMITS.websiteUrl.max}
              value={values.website_url}
              aria-invalid={Boolean(errors.website_url)}
              aria-describedby={describedBy("website_url", errors.website_url ? undefined : "contact-website_url-hint")}
              onChange={(e) => update("website_url", e.target.value)}
              onBlur={() => validateOnBlur("website_url")}
            />
          </Field>
          <p className="text-xs text-slate-400">{inquiry.budgetNote}</p>
        </div>
      )}

      {aiManaged && (
        <AiManagedFields
          values={values}
          errors={errors}
          labels={aiLabels}
          requiredLabel={labels.required}
          optionalLabel={labels.optional}
          update={update}
          validateOnBlur={validateOnBlur}
          describedBy={describedBy}
        />
      )}

      <Field
        id="message"
        label={aiManaged ? aiLabels.problems : labels.message}
        required
        requiredLabel={labels.required}
        error={errors.message}
        hint={aiManaged ? aiLabels.problemsHint : labels.messageHint}
      >
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          className="field resize-y"
          maxLength={LIMITS.message.max}
          value={values.message}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={describedBy("message", "contact-message-hint contact-message-counter")}
          onChange={(e) => update("message", e.target.value)}
          onBlur={() => validateOnBlur("message")}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span id="contact-message-counter">
            {labels.messageCounter
              .replace("{n}", String(values.message.trim().length))
              .replace("{max}", String(LIMITS.message.max))}
          </span>
          {!values.message.trim() && !aiManaged && (
            <button
              type="button"
              className="font-semibold text-cyan-300 hover:text-cyan-200"
              onClick={() => {
                update("message", labels.messageTemplate);
                document.getElementById("contact-message")?.focus();
              }}
            >
              {labels.messageTemplateButton}
            </button>
          )}
        </div>
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

      <div className="grid gap-4 rounded-[var(--radius-md)] border border-line-subtle bg-surface-page/60 p-4 sm:p-5">
        <div>
          <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-slate-300">
            <input
              id="contact-privacy_acknowledged"
              name="privacy_acknowledged"
              type="checkbox"
              className="checkbox mt-0.5"
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
              {labels.privacySuffix} <span className="field-required">*</span>
            </span>
          </label>
          {errors.privacy_acknowledged && (
            <p id="contact-privacy_acknowledged-error" className="field-error">
              {errors.privacy_acknowledged}
            </p>
          )}
        </div>
        <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-slate-400">
          <input
            id="contact-marketing_consent"
            name="marketing_consent"
            type="checkbox"
            className="checkbox mt-0.5"
            checked={values.marketing_consent}
            onChange={(e) => update("marketing_consent", e.target.checked)}
          />
          <span>{labels.marketing}</span>
        </label>
      </div>

      <div className="flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          size="lg"
          icon="arrowRight"
          loading={status === "submitting"}
          loadingLabel={labels.submitting}
          className="w-full sm:w-auto"
        >
          {aiManaged ? aiLabels.submit : labels.submit}
        </Button>
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <Icon name="lock" className="h-4 w-4 text-cyan-300" />
          {labels.secureNote}
        </p>
      </div>
    </form>
  );
}

/** Numbered divider that groups related fields (visual only; fields keep their own labels). */
function FormGroup({ index, label }: { index: number; label: string }) {
  return (
    <p className="-mb-1 flex items-center gap-3 text-[13px] font-semibold text-fg-muted" aria-hidden="true">
      <span className="font-mono text-brand">{String(index).padStart(2, "0")}</span>
      {label}
      <span className="h-px flex-1 bg-line-subtle" />
    </p>
  );
}
