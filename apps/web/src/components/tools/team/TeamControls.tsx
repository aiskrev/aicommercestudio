import type { ReactNode } from "react";

import { cx } from "@/components/ui/primitives";

/* Selection controls for the AI team configurator. All are native inputs (radio / checkbox), so
   keyboard use, grouping and states come from the browser; the label carries the visual state. */

const focusRing = "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand";

/**
 * Single choice shown as pills (fieldset of radios; arrow keys move between options). Each radio is
 * transparent but covers its pill, so the whole pill is the hit area and the label carries the look.
 */
export function PillGroup<T extends string>({
  id,
  legend,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  id: string;
  legend: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  error?: string;
  hint?: string;
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset id={id} aria-describedby={describedBy} aria-invalid={error ? true : undefined}>
      <legend className="field-label mb-3 text-base">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              "relative inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-[15px] transition-colors",
              "has-[:checked]:border-brand has-[:checked]:bg-brand/[0.12] has-[:checked]:text-fg",
              "border-line-default bg-surface-page text-fg-secondary hover:border-line-strong",
              error && value === undefined && "border-danger/60",
              focusRing,
            )}
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="absolute inset-0 m-0 cursor-pointer appearance-none rounded-full opacity-0"
            />
            {option.label}
          </label>
        ))}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Card with a title and text, selected through a native checkbox or radio. */
export function SelectCard({
  type,
  name,
  value,
  checked,
  disabled,
  onChange,
  title,
  text,
  badge,
  describedBy,
}: {
  type: "checkbox" | "radio";
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  text?: string;
  badge?: ReactNode;
  describedBy?: string;
}) {
  return (
    <label
      className={cx(
        "flex min-h-11 gap-3 rounded-[var(--radius-md)] border p-4 transition-colors",
        disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-line-strong",
        checked ? "border-brand bg-brand/[0.08]" : "border-line-default bg-surface-page",
        focusRing,
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.checked)}
        className="checkbox mt-0.5"
      />
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-fg">
          {title}
          {badge}
        </span>
        {text && <span className="mt-1 block text-sm leading-relaxed text-fg-muted">{text}</span>}
      </span>
    </label>
  );
}

export function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}
