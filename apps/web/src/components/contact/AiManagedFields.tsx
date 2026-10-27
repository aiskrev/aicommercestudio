"use client";

import { Field } from "@/components/contact/FormField";
import { Icon } from "@/components/ui/Icon";
import { Alert, cx } from "@/components/ui/primitives";
import type { Dictionary } from "@/i18n";
import {
  AI_OPTIONS,
  type ContactErrors,
  type ContactField,
  type ContactValues,
  LIMITS,
  toggleOption,
} from "@/lib/contact-validation";

/**
 * AI Managed Services section of the inquiry form. Collects only descriptive information about the
 * AI system — never credentials, keys, customer records or documents (see the warning).
 */
export function AiManagedFields({
  values,
  errors,
  labels,
  requiredLabel,
  optionalLabel,
  update,
  validateOnBlur,
  describedBy,
}: {
  values: ContactValues;
  errors: ContactErrors;
  labels: Dictionary["aiManagedForm"];
  requiredLabel: string;
  optionalLabel: string;
  update: <K extends ContactField>(field: K, value: ContactValues[K]) => void;
  validateOnBlur: (field: ContactField) => void;
  describedBy: (field: ContactField, hint?: string) => string | undefined;
}) {
  return (
    <div className="grid gap-6 rounded-2xl border border-brand-strong/20 bg-brand-strong/[0.03] p-4 sm:p-5" data-testid="ai-managed-fields">
      <div>
        <h3 className="text-base font-semibold text-fg">{labels.title}</h3>
        <p className="mt-1 text-sm text-fg-muted">{labels.intro}</p>
      </div>
      <Alert tone="warning" role="note">
        <span data-testid="secrets-warning">{labels.secretsWarning}</span>
      </Alert>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field id="ai_sector" label={labels.sector} required requiredLabel={requiredLabel} error={errors.ai_sector}>
          <Select
            id="ai_sector"
            value={values.ai_sector}
            placeholder={labels.sectorPlaceholder}
            options={AI_OPTIONS.sector.map((key) => [key, labels.sectors[key]])}
            invalid={Boolean(errors.ai_sector)}
            describedBy={describedBy("ai_sector")}
            onChange={(value) => update("ai_sector", value)}
          />
        </Field>
        <Field id="ai_agents_count" label={labels.agentsCount} required requiredLabel={requiredLabel} error={errors.ai_agents_count}>
          <Select
            id="ai_agents_count"
            value={values.ai_agents_count}
            placeholder={labels.agentsCountPlaceholder}
            options={AI_OPTIONS.agentsCount.map((key) => [key, labels.agentsCountOptions[key]])}
            invalid={Boolean(errors.ai_agents_count)}
            describedBy={describedBy("ai_agents_count")}
            onChange={(value) => update("ai_agents_count", value)}
          />
        </Field>
      </div>

      <CheckboxGroup
        id="ai_system_types"
        legend={labels.systemTypes}
        hint={labels.systemTypesHint}
        requiredLabel={requiredLabel}
        options={AI_OPTIONS.systemTypes.map((key) => [key, labels.systemTypeOptions[key]])}
        selected={values.ai_system_types}
        error={errors.ai_system_types}
        onToggle={(option) => update("ai_system_types", toggleOption(values.ai_system_types, option))}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Field
          id="ai_provider"
          label={`${labels.aiProvider} (${optionalLabel})`}
          error={errors.ai_provider}
          hint={labels.aiProviderHint}
        >
          <input
            id="contact-ai_provider"
            name="ai_provider"
            className="field"
            autoComplete="off"
            maxLength={LIMITS.aiProvider.max}
            value={values.ai_provider}
            aria-invalid={Boolean(errors.ai_provider)}
            aria-describedby={describedBy("ai_provider", errors.ai_provider ? undefined : "contact-ai_provider-hint")}
            onChange={(e) => update("ai_provider", e.target.value)}
            onBlur={() => validateOnBlur("ai_provider")}
          />
        </Field>
        <Field id="ai_hosting" label={`${labels.hosting} (${optionalLabel})`} error={errors.ai_hosting}>
          <Select
            id="ai_hosting"
            value={values.ai_hosting}
            placeholder={labels.hostingPlaceholder}
            options={AI_OPTIONS.hosting.map((key) => [key, labels.hostingOptions[key]])}
            invalid={Boolean(errors.ai_hosting)}
            describedBy={describedBy("ai_hosting")}
            onChange={(value) => update("ai_hosting", value)}
          />
        </Field>
      </div>

      <CheckboxGroup
        id="ai_support_interests"
        legend={labels.supportInterests}
        hint={labels.supportInterestsHint}
        requiredLabel={requiredLabel}
        options={AI_OPTIONS.supportInterests.map((key) => [key, labels.supportInterestOptions[key]])}
        selected={values.ai_support_interests}
        error={errors.ai_support_interests}
        onToggle={(option) => update("ai_support_interests", toggleOption(values.ai_support_interests, option))}
      />

      <fieldset>
        <legend className="field-label">
          {labels.communicationLanguage}
          <span className="field-required" aria-hidden="true">
            {" "}
            *
          </span>
          <span className="sr-only"> ({requiredLabel})</span>
        </legend>
        <div className="flex flex-wrap gap-3">
          {AI_OPTIONS.communicationLanguages.map((language) => (
            <label
              key={language}
              lang={language}
              className={cx(
                "flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm",
                values.ai_communication_language === language
                  ? "border-brand-strong/60 bg-brand-strong/[0.07] text-fg"
                  : "border-line-default text-fg-secondary hover:border-line-strong",
              )}
            >
              <input
                type="radio"
                name="ai_communication_language"
                value={language}
                className="checkbox"
                checked={values.ai_communication_language === language}
                onChange={() => update("ai_communication_language", language)}
              />
              {labels.communicationLanguages[language]}
            </label>
          ))}
        </div>
        {errors.ai_communication_language && (
          <p className="field-error">{errors.ai_communication_language}</p>
        )}
      </fieldset>

      <Field id="ai_additional_notes" label={`${labels.additionalNotes} (${optionalLabel})`} error={errors.ai_additional_notes}>
        <textarea
          id="contact-ai_additional_notes"
          name="ai_additional_notes"
          rows={3}
          className="field resize-y"
          maxLength={LIMITS.aiNotes.max}
          value={values.ai_additional_notes}
          aria-invalid={Boolean(errors.ai_additional_notes)}
          aria-describedby={describedBy("ai_additional_notes")}
          onChange={(e) => update("ai_additional_notes", e.target.value)}
          onBlur={() => validateOnBlur("ai_additional_notes")}
        />
      </Field>
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
  id: ContactField;
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
        id={`contact-${id}`}
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
      <Icon name="chevronDown" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}

function CheckboxGroup({
  id,
  legend,
  hint,
  requiredLabel,
  options,
  selected,
  error,
  onToggle,
}: {
  id: ContactField;
  legend: string;
  hint: string;
  requiredLabel: string;
  options: [string, string][];
  selected: string[];
  error?: string;
  onToggle: (option: string) => void;
}) {
  return (
    <fieldset
      id={`contact-${id}`}
      tabIndex={-1}
      className="outline-none"
      aria-describedby={[`contact-${id}-hint`, error ? `contact-${id}-error` : null].filter(Boolean).join(" ")}
      aria-invalid={Boolean(error) || undefined}
    >
      <legend className="field-label mb-0">
        {legend}
        <span className="field-required" aria-hidden="true">
          {" "}
          *
        </span>
        <span className="sr-only"> ({requiredLabel})</span>
      </legend>
      <p id={`contact-${id}-hint`} className="field-hint mt-1">
        {hint}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map(([value, label]) => {
          const checked = selected.includes(value);
          return (
            <label
              key={value}
              className={cx(
                "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors",
                checked ? "border-brand-strong/60 bg-brand-strong/[0.07] text-fg" : "border-line-default text-fg-secondary hover:border-line-strong",
              )}
            >
              <input type="checkbox" name={id} value={value} className="checkbox" checked={checked} onChange={() => onToggle(value)} />
              {label}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`contact-${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}
