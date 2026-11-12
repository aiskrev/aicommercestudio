"use client";

import { type FormEvent, useId, useRef, useState } from "react";

import { Alert, Button } from "@/components/ui/primitives";
import type { Locale } from "@/i18n/config";
import { demoTexts } from "@/i18n/demos";

interface Field {
  key: string;
  options: string[];
}
interface Step {
  key: string;
  status: string;
  code: string;
  items: string[];
}
interface Run {
  scenario: string;
  simulated: true;
  executed: false;
  steps: Step[];
  risk: "low" | "high" | "critical" | null;
  requires_approval: boolean;
  limitations: string[];
  service: string;
  configurator: boolean;
}

const STATUS_TONE: Record<string, string> = { ok: "badge-success", proposed: "badge-accent", flagged: "badge-warning", required: "badge-warning", blocked: "badge-warning" };

/**
 * One simulated scenario (docs/AI_DEMONSTRATIONS.md). The choices come with the page, the answer is a list of codes and
 * the page translates them. Nothing is stored: the answer lives in this component only. The note is plain data.
 */
export function DemoRunner({
  locale,
  scenario,
  fields,
  next,
}: {
  locale: Locale;
  scenario: string;
  fields: Field[];
  next: { serviceHref: string; packagesHref: string; contactHref: string; packages: boolean };
}) {
  const t = demoTexts[locale];
  const text = t.scenarios[scenario];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.key, field.options[0]])));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Run | null>(null);
  const live = useRef<HTMLDivElement>(null);
  const id = useId();

  async function run(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/public/demos/${scenario}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": locale },
        body: JSON.stringify({ inputs: values, ...(note.trim() ? { note: note.trim() } : {}) }),
        cache: "no-store",
      });
      if (response.status === 429) return setError(t.errors.rateLimited);
      if (response.status === 422 || response.status === 404) return setError(t.errors.invalid);
      if (!response.ok) return setError(t.errors.failed);
      setResult((await response.json()) as Run);
      // Move the reader to the result: it is read as a list, step by step.
      requestAnimationFrame(() => live.current?.focus());
    } catch {
      setError(t.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  const code = (value: string) => t.codes[value] ?? value.replaceAll("_", " ");

  return (
    <div className="grid gap-10" data-testid="demo-runner" data-scenario={scenario}>
      <form onSubmit={run} className="card grid gap-6 p-6" aria-describedby={`${id}-badge`}>
        <p id={`${id}-badge`} className="flex flex-wrap items-center gap-2 text-body-sm">
          <span className="badge badge-warning" data-testid="demo-badge">
            {t.badge}
          </span>
          <span className="text-fg-muted">{t.badgeLong}</span>
        </p>
        <fieldset className="grid gap-6 border-0 p-0">
          <legend className="t-h3 mb-1">{t.form.legend}</legend>
          {fields.map((field) => {
            const label = text.fields[field.key];
            return (
              <fieldset key={field.key} className="grid gap-2 border-0 p-0" data-field={field.key}>
                <legend className="t-label">{label?.label ?? field.key}</legend>
                <div className="flex flex-wrap gap-2">
                  {field.options.map((option) => {
                    const inputId = `${id}-${field.key}-${option}`;
                    return (
                      <label
                        key={option}
                        htmlFor={inputId}
                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-2 text-body-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10"
                      >
                        <input
                          id={inputId}
                          type="radio"
                          name={`${id}-${field.key}`}
                          value={option}
                          checked={values[field.key] === option}
                          onChange={() => setValues((current) => ({ ...current, [field.key]: option }))}
                        />
                        <span>{label?.options[option] ?? option}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </fieldset>
        <label className="grid max-w-2xl gap-1 text-body-sm">
          <span className="t-label">{t.form.note}</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={280} rows={2} aria-describedby={`${id}-note`} />
          <span id={`${id}-note`} className="text-fg-muted">
            {t.form.noteHint}
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={busy} loadingLabel={t.form.running}>
            {t.form.run}
          </Button>
          {result && (
            <Button type="button" variant="secondary" onClick={() => setResult(null)}>
              {t.form.reset}
            </Button>
          )}
        </div>
        {error && (
          <Alert tone="error" role="alert">
            {error}
          </Alert>
        )}
      </form>

      <section aria-labelledby={`${id}-flow`} className="grid gap-4">
        <h2 id={`${id}-flow`} className="t-h2">
          {result ? t.result.title : t.flowTitle}
        </h2>
        <div ref={live} tabIndex={-1} aria-live="polite" className="grid gap-4 outline-none" data-testid="demo-result">
          {!result && (
            <p className="text-fg-muted" data-testid="demo-empty">
              {t.empty}
            </p>
          )}
          {result && (
            <>
              <Alert tone="info" role="note">
                <span data-testid="demo-executed">{t.result.executed}</span>
              </Alert>
              <ol className="grid gap-4 lg:grid-cols-3" data-testid="demo-steps">
                {result.steps.map((step) => (
                  <li key={step.key} className="card relative grid content-start gap-3 p-5" data-step={step.key} data-status={step.status}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="t-h3">{t.steps[step.key].title}</h3>
                      <span className={`badge ${STATUS_TONE[step.status] ?? ""}`}>{t.statuses[step.status] ?? step.status}</span>
                    </div>
                    <p className="text-body-sm text-fg-muted">{t.steps[step.key].text}</p>
                    <p className="font-medium">{code(step.code)}</p>
                    {step.items.length > 0 && (
                      <ul className="grid list-disc gap-1 pl-5 text-body-sm text-fg-secondary">
                        {step.items.map((item) => (
                          <li key={item} data-code={item}>
                            {code(item)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
              {result.risk && (
                <p className="text-body-sm" data-testid="demo-risk">
                  <span className="t-label">{t.result.riskLabel}:</span> {t.result.risk[result.risk]} ·{" "}
                  {result.requires_approval ? t.result.approvalRequired : t.result.approvalNotRequired}
                </p>
              )}
              <div>
                <h3 className="t-h3">{t.result.limitationsTitle}</h3>
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-body-sm text-fg-muted">
                  {result.limitations.map((item) => (
                    <li key={item}>{code(item)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="t-h3">{t.result.nextTitle}</h3>
                <p className="mt-3 flex flex-wrap gap-3">
                  <a className="btn btn-secondary" href={next.serviceHref}>
                    {t.result.service}
                  </a>
                  {next.packages && (
                    <a className="btn btn-secondary" href={next.packagesHref}>
                      {t.result.packages}
                    </a>
                  )}
                  <a className="btn btn-primary" href={next.contactHref}>
                    {t.result.contact}
                  </a>
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
