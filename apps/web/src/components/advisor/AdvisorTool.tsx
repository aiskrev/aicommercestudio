"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { AdvisorResult } from "@/components/advisor/AdvisorResult";
import { ContactForm, type ServiceOption } from "@/components/contact/ContactForm";
import { Icon } from "@/components/ui/Icon";
import { Alert, Button, cx } from "@/components/ui/primitives";
import {
  BUSINESS_TYPES,
  MONTHLY_VOLUMES,
  TEAM_SIZES,
  TOOLS,
  type AdvisorContent,
} from "@/content/bg/advisor";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import {
  ADVISOR_LIMITS,
  type AdvisorErrors,
  type AdvisorField,
  type AdvisorResponse,
  type AdvisorStatus,
  type AdvisorValues,
  emptyAdvisorValues,
  fetchAdvisorStatus,
  requestAssessment,
  toAdvisorPayload,
  toggleTool,
  validateAdvisor,
} from "@/lib/advisor";
import { trackToolEvent } from "@/lib/analytics";
import { fetchFormToken } from "@/lib/public-api";

interface Props {
  content: AdvisorContent;
  contact: {
    labels: Dictionary["form"];
    messages: Dictionary["validation"];
    inquiry: Dictionary["inquiry"];
    aiLabels: Dictionary["aiManagedForm"];
    locale: Locale;
    services: ServiceOption[];
    privacyHref: string;
    nextSteps: string[];
  };
  retentionDays: number;
  locale: Locale;
}

const FIELD_ORDER: AdvisorField[] = ["business_type", "process_description", "monthly_volume", "team_size", "tools", "other_tools"];

export function AdvisorTool({ content, contact, retentionDays, locale }: Props) {
  const f = content.form;
  const [values, setValues] = useState<AdvisorValues>(emptyAdvisorValues);
  const [errors, setErrors] = useState<AdvisorErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AdvisorResponse | null>(null);
  const [status, setStatus] = useState<AdvisorStatus | null>(null);
  const [consulting, setConsulting] = useState(false);
  const [token, setToken] = useState("");
  const summaryRef = useRef<HTMLDivElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const consultRef = useRef<HTMLDivElement>(null);
  const days = status?.retention_days ?? retentionDays;

  useEffect(() => {
    trackToolEvent({ name: "tool_opened", tool: "advisor", locale });
  }, [locale]);

  useEffect(() => {
    let active = true;
    fetchFormToken().then((value) => active && setToken(value));
    fetchAdvisorStatus(locale).then((value) => active && setStatus(value));
    return () => {
      active = false;
    };
  }, [locale]);

  useEffect(() => {
    if (result) resultHeadingRef.current?.focus();
  }, [result]);

  useEffect(() => {
    if (consulting) consultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [consulting]);

  function update<K extends AdvisorField>(field: K, value: AdvisorValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function validateOnBlur(field: AdvisorField) {
    const value = values[field];
    if (typeof value === "string" && !value.trim()) return;
    setErrors((current) => ({ ...current, [field]: validateAdvisor(values, content.validation)[field] }));
  }

  function showErrors(next: AdvisorErrors, message: string) {
    setErrors(next);
    setFormError(message);
    requestAnimationFrame(() => {
      const first = FIELD_ORDER.find((field) => next[field]);
      if (first) document.getElementById(`advisor-${first}`)?.focus();
      else summaryRef.current?.focus();
    });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const clientErrors = validateAdvisor(values, content.validation);
    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors, f.errorSummary);
      return;
    }

    setSubmitting(true);
    trackToolEvent({ name: "tool_started", tool: "advisor", locale });
    const response = await requestAssessment(toAdvisorPayload(values, token, locale), locale);
    setSubmitting(false);
    fetchFormToken().then(setToken);

    if (response.ok) {
      setResult(response.data);
      trackToolEvent({ name: "tool_completed", tool: "advisor", locale });
      return;
    }
    if (response.kind === "validation") showErrors(response.fieldErrors, response.message || f.errorSummary);
    else if (response.kind === "rate_limited") showErrors({}, content.errors.rateLimited);
    else if (response.kind === "network") showErrors({}, content.errors.network);
    else if (response.kind === "timeout") showErrors({}, response.message || content.errors.timeout);
    else showErrors({}, response.message || content.errors.generic);
  }

  function startOver() {
    setResult(null);
    setConsulting(false);
    setErrors({});
    setFormError(null);
    requestAnimationFrame(() => document.getElementById("advisor-process_description")?.focus());
  }

  if (result) {
    const ref = result.reference ?? "";
    return (
      <div className="grid gap-8">
        <AdvisorResult result={result} content={content} headingRef={resultHeadingRef} locale={locale} />

        <div className="flex flex-wrap gap-3 print:hidden">
          {!consulting && (
            <Button size="lg" icon="arrowRight" onClick={() => setConsulting(true)}>
              {content.result.consultButton}
            </Button>
          )}
          <Button variant="secondary" onClick={startOver}>
            {content.result.newAssessment}
          </Button>
          <Button variant="ghost" onClick={() => window.print()}>
            {content.result.print}
          </Button>
        </div>

        {consulting && (
          <div ref={consultRef} className="grid scroll-mt-28 gap-4 print:hidden" data-testid="advisor-consultation">
            <div>
              <h2 className="t-h2 text-2xl">{content.result.consultTitle}</h2>
              <p className="mt-2 max-w-2xl text-slate-400">{content.result.consultLead}</p>
            </div>
            {!result.stored && (
              <Alert tone="info" role="note">
                {content.result.consultUnsaved}
              </Alert>
            )}
            <ContactForm
              {...contact}
              initialService="automation"
              initialMessage={result.stored ? content.result.consultMessage.replace("{ref}", ref) : ""}
              advisorAssessmentId={result.assessment_id ?? undefined}
              advisorNote={content.result.consultNote.replace("{ref}", ref)}
            />
          </div>
        )}
      </div>
    );
  }

  const describedBy = (field: AdvisorField, ...hints: string[]) =>
    [...hints, errors[field] ? `advisor-${field}-error` : null].filter(Boolean).join(" ") || undefined;
  const descriptionLength = values.process_description.trim().length;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="tool-frame grid gap-7 p-6 sm:p-8"
      aria-label={f.title}
      aria-busy={submitting || undefined}
      data-testid="advisor-form"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-h3 text-xl">{f.title}</h2>
        <p className="text-xs text-slate-400">{f.requiredNote}</p>
      </div>

      {status?.mode === "demo" && (
        <Alert tone="warning" role="note" title={content.modeBadge.demo}>
          <span data-testid="advisor-demo-notice">{status.disclaimer}</span>
        </Alert>
      )}

      <div ref={summaryRef} tabIndex={-1} aria-live="assertive" className="outline-none empty:hidden">
        {formError && (
          <Alert tone="error" role="alert">
            {formError}
          </Alert>
        )}
      </div>

      <Field id="business_type" label={f.businessType} required={f.required} error={errors.business_type}>
        <Select
          id="business_type"
          value={values.business_type}
          placeholder={f.businessTypePlaceholder}
          options={BUSINESS_TYPES.map((v) => [v, content.options.businessTypes[v]])}
          invalid={Boolean(errors.business_type)}
          describedBy={describedBy("business_type")}
          onChange={(v) => update("business_type", v as AdvisorValues["business_type"])}
        />
      </Field>

      <Field
        id="process_description"
        label={f.description}
        required={f.required}
        error={errors.process_description}
        hint={f.descriptionHint}
      >
        <textarea
          id="advisor-process_description"
          name="process_description"
          rows={7}
          className="field resize-y"
          maxLength={ADVISOR_LIMITS.descriptionMax}
          value={values.process_description}
          aria-invalid={Boolean(errors.process_description)}
          aria-describedby={describedBy(
            "process_description",
            "advisor-process_description-hint",
            "advisor-pii-warning",
            "advisor-description-counter",
          )}
          onChange={(e) => update("process_description", e.target.value)}
          onBlur={() => validateOnBlur("process_description")}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span id="advisor-description-counter">
            {f.descriptionCounter
              .replace("{n}", String(descriptionLength))
              .replace("{max}", String(ADVISOR_LIMITS.descriptionMax))}
          </span>
          {!values.process_description.trim() && (
            <button
              type="button"
              className="link"
              onClick={() => {
                update("process_description", f.example);
                document.getElementById("advisor-process_description")?.focus();
              }}
            >
              {f.descriptionExample}
            </button>
          )}
        </div>
        <p id="advisor-pii-warning" className="mt-2 flex items-start gap-2 text-xs text-amber-200/90">
          <Icon name="lock" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {f.personalDataWarning}
        </p>
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="monthly_volume" label={f.volume} required={f.required} error={errors.monthly_volume} hint={f.volumeHint}>
          <Select
            id="monthly_volume"
            value={values.monthly_volume}
            placeholder={f.volumePlaceholder}
            options={MONTHLY_VOLUMES.map((v) => [v, content.options.volumes[v]])}
            invalid={Boolean(errors.monthly_volume)}
            describedBy={describedBy("monthly_volume", "advisor-monthly_volume-hint")}
            onChange={(v) => update("monthly_volume", v as AdvisorValues["monthly_volume"])}
          />
        </Field>
        <Field id="team_size" label={f.team} required={f.required} error={errors.team_size}>
          <Select
            id="team_size"
            value={values.team_size}
            placeholder={f.teamPlaceholder}
            options={TEAM_SIZES.map((v) => [v, content.options.teams[v]])}
            invalid={Boolean(errors.team_size)}
            describedBy={describedBy("team_size")}
            onChange={(v) => update("team_size", v as AdvisorValues["team_size"])}
          />
        </Field>
      </div>

      <fieldset
        id="advisor-tools"
        tabIndex={-1}
        className="outline-none"
        aria-describedby={describedBy("tools", "advisor-tools-hint")}
        aria-invalid={Boolean(errors.tools) || undefined}
      >
        <legend className="field-label mb-0">
          {f.tools} <span className="field-required" aria-hidden="true">*</span>
          <span className="sr-only"> ({f.required})</span>
        </legend>
        <p id="advisor-tools-hint" className="field-hint mt-1">
          {f.toolsHint}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => {
            const checked = values.tools.includes(tool);
            return (
              <label
                key={tool}
                className={cx(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                  checked ? "border-cyan-400/60 bg-cyan-400/[0.07] text-white" : "border-white/[0.12] text-slate-300 hover:border-white/25",
                )}
              >
                <input
                  type="checkbox"
                  name="tools"
                  value={tool}
                  className="checkbox"
                  checked={checked}
                  onChange={() => update("tools", toggleTool(values.tools, tool))}
                />
                {content.options.tools[tool]}
              </label>
            );
          })}
        </div>
        {errors.tools && (
          <p id="advisor-tools-error" className="field-error">
            {errors.tools}
          </p>
        )}
      </fieldset>

      <Field id="other_tools" label={`${f.otherTools}`} error={errors.other_tools} hint={f.otherToolsHint}>
        <input
          id="advisor-other_tools"
          name="other_tools"
          className="field"
          maxLength={ADVISOR_LIMITS.otherToolsMax}
          value={values.other_tools}
          aria-invalid={Boolean(errors.other_tools)}
          aria-describedby={describedBy("other_tools", "advisor-other_tools-hint")}
          onChange={(e) => update("other_tools", e.target.value)}
          onBlur={() => validateOnBlur("other_tools")}
        />
      </Field>

      <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-slate-300">
        <input
          id="advisor-save_assessment"
          type="checkbox"
          className="checkbox mt-0.5"
          checked={values.save_assessment}
          onChange={(e) => update("save_assessment", e.target.checked)}
        />
        <span>{f.save.replace("{days}", String(days))}</span>
      </label>

      <div className="flex flex-col gap-4 border-t border-white/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="submit"
          size="lg"
          icon="sparkles"
          loading={submitting}
          loadingLabel={f.submitting}
          className="w-full sm:w-auto"
        >
          {f.submit}
        </Button>
        <p className="flex items-center gap-2 text-xs text-slate-400" role="status" aria-live="polite">
          {submitting ? f.submitting : null}
        </p>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: AdvisorField;
  label: string;
  required?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={`advisor-${id}`} className="field-label">
        {label}
        {required && (
          <>
            {" "}
            <span className="field-required" aria-hidden="true">*</span>
            <span className="sr-only"> ({required})</span>
          </>
        )}
      </label>
      {hint && (
        <p id={`advisor-${id}-hint`} className="field-hint -mt-1 mb-2">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`advisor-${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function Select({
  id,
  value,
  placeholder,
  options,
  invalid,
  describedBy,
  onChange,
}: {
  id: AdvisorField;
  value: string;
  placeholder: string;
  options: [string, string][];
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <select
        id={`advisor-${id}`}
        name={id}
        className="field appearance-none"
        value={value}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      />
    </div>
  );
}
