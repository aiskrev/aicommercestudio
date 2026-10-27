import type { ReactNode } from "react";

import type { ContactField } from "@/lib/contact-validation";

/** Labelled form field with hint and error wiring (ids: contact-<field>, -hint, -error). */
export function Field({
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
      <label htmlFor={`contact-${id}`} className="field-label">
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
      {hint && !error && (
        <p id={`contact-${id}-hint`} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`contact-${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
