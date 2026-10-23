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
        <p id={`contact-${id}-hint`} className="mt-2 text-xs text-slate-400">
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
