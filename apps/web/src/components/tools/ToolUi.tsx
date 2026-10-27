import Link from "next/link";
import type { ReactNode, Ref } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Alert, Button, ButtonLink, cx, Skeleton } from "@/components/ui/primitives";

/* Shared building blocks for interactive tools: progress, questions, navigation, results,
   recommendations and states. Presentational only — tool logic lives in lib/. */

/** "Step 2 of 5" with the named steps; the current one is marked with aria-current="step". */
export function StepProgress({
  steps,
  current,
  label,
  stepOf,
}: {
  steps: string[];
  current: number;
  label: string;
  stepOf: string;
}) {
  const text = stepOf.replace("{current}", String(current + 1)).replace("{total}", String(steps.length));
  return (
    <nav aria-label={label}>
      <p className="t-label" aria-live="polite">
        {text}
      </p>
      <ol className="mt-3 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
        {steps.map((title, index) => (
          <li key={title} aria-current={index === current ? "step" : undefined} className="min-w-0">
            <span
              className={cx(
                "block h-1.5 rounded-full transition-colors",
                index < current ? "bg-brand" : index === current ? "bg-brand/70" : "bg-line-default",
              )}
              aria-hidden="true"
            />
            <span className={cx("mt-2 hidden truncate text-xs sm:block", index === current ? "text-fg" : "text-fg-subtle")}>{title}</span>
            <span className="sr-only">{title}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Single-choice question as a fieldset of option cards (native radios, keyboard operable). */
export function ChoiceQuestion({
  id,
  label,
  options,
  value,
  error,
  onChange,
  levelLabel,
}: {
  id: string;
  label: string;
  options: string[];
  value: number | undefined;
  error?: string;
  onChange: (value: number) => void;
  /** When set, options are shown as an ordered scale (one column) with their level number. */
  levelLabel?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="field-label mb-3 text-base">{label}</legend>
      <div className={cx("grid gap-2", !levelLabel && "sm:grid-cols-2")}>
        {options.map((option, index) => {
          const optionId = `${id}-${index}`;
          return (
            <label
              key={option}
              htmlFor={optionId}
              className={cx(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 text-[15px] leading-snug transition-colors",
                value === index
                  ? "border-brand bg-brand/[0.08] text-fg"
                  : "border-line-default bg-surface-page text-fg-secondary hover:border-line-strong",
                error && value === undefined && "border-danger/60",
              )}
            >
              <input
                id={optionId}
                type="radio"
                name={id}
                value={index}
                checked={value === index}
                onChange={() => onChange(index)}
                className="checkbox mt-0.5"
              />
              {levelLabel !== undefined && (
                <span className="mt-px shrink-0 font-mono text-xs text-fg-subtle">
                  <span className="sr-only">{levelLabel} </span>
                  {index}
                </span>
              )}
              <span className="min-w-0">{option}</span>
            </label>
          );
        })}
      </div>
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** Back / next (or finish) controls for a step. */
export function StepNav({
  isFirst,
  isLast,
  labels,
  onBack,
}: {
  isFirst: boolean;
  isLast: boolean;
  labels: { back: string; next: string; finish: string };
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-line-subtle pt-6 sm:flex-row sm:justify-between">
      {!isFirst ? (
        <Button variant="secondary" onClick={onBack}>
          {labels.back}
        </Button>
      ) : (
        <span aria-hidden="true" />
      )}
      <Button type="submit" icon="arrowRight">
        {isLast ? labels.finish : labels.next}
      </Button>
    </div>
  );
}

/** Overall score with level, plus a bar per dimension (each bar is a labelled <meter>). */
export function ResultSummary({
  title,
  headingRef,
  overall,
  overallLabel,
  outOf,
  level,
  levelLabel,
  dimensionsTitle,
  dimensions,
  thresholds = { low: 40, high: 70 },
}: {
  title: string;
  headingRef?: Ref<HTMLHeadingElement>;
  overall: number;
  overallLabel: string;
  outOf: string;
  level: { title: string; description: string };
  /** Visible label before the level badge, e.g. "Stage". */
  levelLabel?: string;
  dimensionsTitle: string;
  dimensions: { key: string; label: string; score: number; note?: string }[];
  /** <meter> low/high bounds: below `low` is poor, from `high` good. */
  thresholds?: { low: number; high: number };
}) {
  return (
    <section aria-labelledby="tool-result-title" className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
      <div className="min-w-0">
        <h2 id="tool-result-title" ref={headingRef} tabIndex={-1} className="t-h2 outline-none">
          {title}
        </h2>
        <p className="mt-6 flex items-baseline gap-3">
          <span className="font-display text-6xl font-bold tracking-[-0.03em] text-fg" data-testid="tool-score">
            {overall}
          </span>
          <span className="text-fg-muted">
            {outOf} · {overallLabel}
          </span>
        </p>
        <p className="mt-4 flex items-center gap-2">
          {levelLabel && <span className="text-sm text-fg-muted">{levelLabel}:</span>}
          <span className="badge badge-accent" data-testid="tool-level">
            {level.title}
          </span>
        </p>
        <p className="mt-4 leading-relaxed text-fg-secondary">{level.description}</p>
      </div>
      <div className="min-w-0">
        <h3 className="t-label">{dimensionsTitle}</h3>
        <dl className="mt-4 grid gap-4">
          {dimensions.map((d) => (
            <div key={d.key}>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-medium text-fg">
                  {d.label}
                  {d.note && <span className="ml-2 text-xs font-normal text-fg-subtle">{d.note}</span>}
                </dt>
                <dd className="font-mono text-sm text-fg-secondary">{d.score}</dd>
              </div>
              <meter
                min={0}
                max={100}
                low={thresholds.low}
                high={thresholds.high}
                optimum={100}
                value={d.score}
                aria-label={`${d.label}: ${d.score}/100`}
                className="tool-meter mt-2 block h-2 w-full"
              />
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Prioritised next steps, each pointing to a related service page. */
export function RecommendationList({
  title,
  serviceLabel,
  items,
}: {
  title: string;
  serviceLabel: string;
  items: { key: string; title: string; text: string; service: { href: string; label: string } }[];
}) {
  return (
    <section aria-labelledby="tool-recommendations-title">
      <h2 id="tool-recommendations-title" className="t-h3-lg">
        {title}
      </h2>
      <ol className="mt-6 grid gap-3">
        {items.map((item, index) => (
          <li key={item.key} className="card grid gap-3 p-5 sm:grid-cols-[2.5rem_minmax(0,1fr)] sm:p-6">
            <span className="t-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <h3 className="t-h3">{item.title}</h3>
              <p className="mt-1.5 leading-relaxed text-fg-muted">{item.text}</p>
              <p className="mt-3 text-sm">
                <span className="text-fg-subtle">{serviceLabel}: </span>
                <Link href={item.service.href} className="link">
                  {item.service.label}
                </Link>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Consultation hand-off after a result; the tool's answers are never attached automatically. */
export function ToolLeadCapture({
  title,
  text,
  primary,
  secondary,
}: {
  title: string;
  text: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <section aria-labelledby="tool-lead-title" className="tool-frame p-6 sm:p-8">
      <h2 id="tool-lead-title" className="t-h3-lg">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl leading-relaxed text-fg-muted">{text}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <ButtonLink href={primary.href} icon="arrowRight">
          {primary.label}
        </ButtonLink>
        {secondary && (
          <Link href={secondary.href} className="link">
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}

/** Consistent empty / loading / error / success states for tools. */
export function ToolState({
  kind,
  title,
  text,
  action,
}: {
  kind: "empty" | "loading" | "error" | "success";
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  if (kind === "loading") {
    return (
      <div role="status" aria-live="polite" className="grid gap-3">
        <span className="sr-only">{title}</span>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (kind === "error" || kind === "success") {
    return (
      <Alert tone={kind} title={title} role={kind === "error" ? "alert" : "status"}>
        {text}
        {action && <div className="mt-3">{action}</div>}
      </Alert>
    );
  }
  const icon: IconName = "info";
  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-line-strong p-8 text-center">
      <Icon name={icon} className="mx-auto h-6 w-6 text-fg-subtle" />
      <p className="mt-3 font-semibold text-fg">{title}</p>
      {text && <p className="mt-1 text-fg-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Two columns of labelled findings (e.g. strengths and gaps), each with an empty-state text. */
export function StrengthsGaps({
  columns,
}: {
  columns: { id: string; title: string; tone: "good" | "attention"; items: string[]; empty: string }[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {columns.map((column) => (
        <section key={column.id} aria-labelledby={column.id} className="card p-5 sm:p-6">
          <h2 id={column.id} className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            <Icon
              name={column.tone === "good" ? "check" : "alert"}
              className={cx("h-4.5 w-4.5", column.tone === "good" ? "text-success" : "text-warning")}
            />
            {column.title}
          </h2>
          {column.items.length > 0 ? (
            <ul className="mt-3 grid gap-1.5 text-fg-secondary">
              {column.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    className={cx("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", column.tone === "good" ? "bg-success" : "bg-warning")}
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-fg-muted">{column.empty}</p>
          )}
        </section>
      ))}
    </div>
  );
}

/** Titled list of short cards (e.g. suitable use cases). */
export function InsightList({ id, title, items }: { id: string; title: string; items: { key: string; title: string; text: string }[] }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="t-h3-lg">
        {title}
      </h2>
      <ul className="mt-6 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <li key={item.key} className="card p-5">
            <h3 className="t-h3">{item.title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-fg-muted">{item.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Phased plan (e.g. 30/60/90 days) as an ordered timeline of columns. */
export function PhasedRoadmap({
  id,
  title,
  phases,
}: {
  id: string;
  title: string;
  phases: { key: string; label: string; items: string[] }[];
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="t-h3-lg">
        {title}
      </h2>
      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {phases.map((phase, index) => (
          <li key={phase.key} className="min-w-0 border-t-2 border-brand/50 pt-4">
            <p className="t-index">
              {String(index + 1).padStart(2, "0")} · {phase.label}
            </p>
            <ul className="mt-3 grid gap-2 text-[15px] leading-relaxed text-fg-secondary">
              {phase.items.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Collapsible explanation of how a result is calculated (native <details>). */
export function MethodologyNote({ title, paragraphs }: { title: string; paragraphs: string[] }) {
  return (
    <details className="accordion group rounded-[var(--radius-lg)] border border-line-subtle bg-surface-1 px-5 py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-fg [&::-webkit-details-marker]:hidden">
        {title}
        <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-brand transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 grid gap-2.5 text-[15px] leading-relaxed text-fg-muted">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </details>
  );
}
