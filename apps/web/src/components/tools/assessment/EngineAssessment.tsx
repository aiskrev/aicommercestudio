"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { ReportView } from "@/components/tools/assessment/ReportView";
import { ChoiceQuestion, ResultSummary, StepNav, StepProgress, ToolState } from "@/components/tools/ToolUi";
import { Alert, Badge, Button, ButtonLink, cx } from "@/components/ui/primitives";
import type { engineeringTool } from "@/content/bg/tool-engineering";
import type { Locale } from "@/i18n/config";
import { trackToolEvent } from "@/lib/analytics";
import {
  type AnswerValue,
  type AssessmentDefinitionView,
  type AssessmentKey,
  type AssessmentResultView,
  deleteSavedResult,
  fetchDefinition,
  fetchReportDocument,
  fetchReportPdf,
  type FindingKind,
  invalidNumbers,
  missingRequired,
  type QuestionDef,
  type ReportDocument,
  requestConsultation,
  scoreAssessment,
  toPayload,
} from "@/lib/assessment-api";
import type { DomainKey } from "@/lib/domains";
import { fetchFormToken } from "@/lib/public-api";
import type { ToolKey } from "@/lib/tools";

type Content = typeof engineeringTool;
type Draft = Record<string, AnswerValue | undefined>;

const KIND_ORDER: FindingKind[] = ["risk", "quick_win", "recommendation", "target_state", "pattern", "context"];
const EVIDENCE_ORDER = { context: 0, practice: 1, metric: 2 } as const;
const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, String(v)), template);

interface Props {
  assessment: AssessmentKey;
  tool: Extract<ToolKey, "cloud_maturity" | "devops_maturity" | "observability">;
  content: Content;
  locale: Locale;
  domainLinks: Partial<Record<DomainKey, { href: string; label: string }>>;
  contactHref: string;
  privacyHref: string;
  retentionDays: number;
}

/**
 * Engine-backed assessment (docs/ASSESSMENT_PLATFORM_ARCHITECTURE.md): the questions come from the
 * API, one area per step; the server scores the answers. The result is shown immediately — saving
 * (for the report and PDF) and a consultation are separate, optional actions.
 */
export function EngineAssessment({ assessment, tool, content, locale, domainLinks, contactHref, privacyHref, retentionDays }: Props) {
  const t = content.wizard;
  const [definition, setDefinition] = useState<AssessmentDefinitionView | null | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessmentResultView | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const started = useRef(false);

  useEffect(() => {
    let active = true;
    fetchDefinition(assessment, locale).then((loaded) => active && setDefinition(loaded));
    return () => {
      active = false;
    };
  }, [assessment, locale]);

  useEffect(() => {
    if (result) headingRef.current?.focus();
  }, [result]);

  if (definition === undefined) return <ToolState kind="loading" title={t.loading} />;
  if (definition === null) return <ToolState kind="error" title={t.loadError} />;

  const steps = definition.dimensions;
  const questionsFor = (dimension: string) =>
    definition.questions
      .filter((q) => q.dimension === dimension)
      .sort((a, b) => EVIDENCE_ORDER[a.evidence] - EVIDENCE_ORDER[b.evidence]);
  const current = questionsFor(steps[step].key);
  const isLast = step === steps.length - 1;

  function update(key: string, value: AnswerValue | undefined) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (!started.current) {
      started.current = true;
      trackToolEvent({ name: "tool_started", tool, locale });
    }
  }

  function check(questions: QuestionDef[]): boolean {
    const found: Record<string, string> = {};
    for (const key of missingRequired(questions, draft)) found[key] = t.required;
    for (const key of invalidNumbers(questions, draft)) {
      const q = questions.find((item) => item.key === key)!;
      found[key] = fill(t.numberHint, { min: q.min ?? 0, max: q.max ?? 0 });
    }
    setErrors(found);
    if (Object.keys(found).length) {
      setFormError(t.errorSummary);
      const first = Object.keys(found)[0];
      // Focus the first option of a choice question (announced with its group), else the field itself.
      requestAnimationFrame(() => (document.getElementById(`engine-q-${first}-options-0`) ?? document.getElementById(`engine-q-${first}`))?.focus());
      return false;
    }
    setFormError(null);
    return true;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!check(current)) return;
    if (!isLast) {
      trackToolEvent({ name: "step_completed", tool, locale, step: step + 1 });
      setStep(step + 1);
      requestAnimationFrame(() => stepHeadingRef.current?.focus());
      return;
    }
    setSubmitting(true);
    const response = await scoreAssessment(assessment, definition!.version, toPayload(definition!.questions, draft), locale);
    setSubmitting(false);
    if (response.ok) {
      setResult(response.data);
      trackToolEvent({ name: "tool_completed", tool, locale, result: response.data.band.key });
      return;
    }
    if (response.kind === "invalid" && response.errors?.length) {
      const serverErrors: Record<string, string> = {};
      for (const e of response.errors) serverErrors[e.field.replace(/^answers\./, "")] = t.required;
      setErrors(serverErrors);
    }
    setFormError(response.kind === "outdated" ? t.outdated : response.kind === "rate_limited" ? t.rateLimited : t.failed);
  }

  if (result) {
    return (
      <EngineResult
        result={result}
        content={content}
        locale={locale}
        headingRef={headingRef}
        domainLinks={domainLinks}
        contactHref={contactHref}
        privacyHref={privacyHref}
        retentionDays={retentionDays}
        answers={toPayload(definition.questions, draft)}
        assessment={assessment}
        tool={tool}
        version={definition.version}
        onRestart={() => {
          setResult(null);
          setDraft({});
          setStep(0);
          started.current = false;
          requestAnimationFrame(() => stepHeadingRef.current?.focus());
        }}
      />
    );
  }

  const dimension = steps[step];
  return (
    <form onSubmit={onSubmit} noValidate className="tool-frame grid gap-8 p-6 sm:p-8" data-testid="engine-form" aria-busy={submitting || undefined}>
      <StepProgress
        steps={steps.map((d) => d.title)}
        current={step}
        label={t.progress}
        stepOf={t.step.replace("{n}", "{current}")}
      />
      <div>
        <h2 ref={stepHeadingRef} tabIndex={-1} className="t-h2 outline-none">
          {dimension.title}
        </h2>
        <p className="mt-2 max-w-2xl text-fg-muted">{dimension.description}</p>
      </div>
      {formError && (
        <Alert tone="error" role="alert">
          {formError}
        </Alert>
      )}
      {current.some((q) => q.evidence === "metric") && (
        <Alert tone="info" role="note">
          {t.metricsNote}
        </Alert>
      )}
      <div className="grid gap-8">
        {current.map((q) => (
          <QuestionField key={q.key} question={q} value={draft[q.key]} error={errors[q.key]} labels={t} onChange={(value) => update(q.key, value)} />
        ))}
      </div>
      <div aria-live="polite" className="sr-only">
        {submitting ? t.submitting : ""}
      </div>
      <StepNav
        isFirst={step === 0}
        isLast={isLast}
        labels={{ back: t.back, next: t.next, finish: submitting ? t.submitting : t.finish }}
        onBack={() => {
          setFormError(null);
          setErrors({});
          setStep(step - 1);
          requestAnimationFrame(() => stepHeadingRef.current?.focus());
        }}
      />
    </form>
  );
}

function QuestionField({
  question: q,
  value,
  error,
  labels,
  onChange,
}: {
  question: QuestionDef;
  value: AnswerValue | undefined;
  error?: string;
  labels: Content["wizard"];
  onChange: (value: AnswerValue | undefined) => void;
}) {
  const id = `engine-q-${q.key}`;
  const label = q.required ? q.text : `${q.text} (${labels.optional})`;
  const help = q.evidence === "context" ? [q.help, labels.contextNote].filter(Boolean).join(" ") : q.help;

  if (q.type === "single_choice" || q.type === "boolean" || q.type === "scale") {
    const options =
      q.type === "single_choice"
        ? (q.options ?? []).map((o) => ({ key: o.key as AnswerValue, label: o.label }))
        : q.type === "boolean"
          ? [
              { key: true as AnswerValue, label: labels.yes },
              { key: false as AnswerValue, label: labels.no },
            ]
          : Array.from({ length: (q.max ?? 0) - (q.min ?? 0) + 1 }, (_, i) => ({ key: (q.min ?? 0) + i as AnswerValue, label: String((q.min ?? 0) + i) }));
    const index = options.findIndex((o) => o.key === value);
    return (
      <div data-question={q.key} data-evidence={q.evidence}>
        <ChoiceQuestion
          id={`${id}-options`}
          label={label}
          options={options.map((o) => o.label)}
          value={index < 0 ? undefined : index}
          error={error}
          onChange={(i) => onChange(options[i].key)}
        />
        {help && <p className="field-hint mt-2">{help}</p>}
        {!q.required && value !== undefined && (
          <button type="button" className="link mt-2 text-sm" onClick={() => onChange(undefined)}>
            {labels.clear}
          </button>
        )}
      </div>
    );
  }

  if (q.type === "multi_choice") {
    const selected = Array.isArray(value) ? value : [];
    const errorId = `${id}-error`;
    return (
      <fieldset
        data-question={q.key}
        data-evidence={q.evidence}
        aria-describedby={[help ? `${id}-help` : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
      >
        <legend className="field-label mb-1 text-base">
          <span id={id} tabIndex={-1}>
            {label}
          </span>
        </legend>
        <p id={`${id}-help`} className="field-hint mb-3">
          {[labels.selectAll, help].filter(Boolean).join(" ")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.options ?? []).map((o) => {
            const checked = selected.includes(o.key);
            return (
              <label
                key={o.key}
                className={cx(
                  "flex min-h-11 cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border px-3.5 py-3 text-[15px] leading-snug",
                  checked ? "border-brand bg-brand/[0.08] text-fg" : "border-line-default bg-surface-page text-fg-secondary",
                )}
              >
                <input
                  type="checkbox"
                  className="checkbox mt-0.5"
                  checked={checked}
                  onChange={() => onChange(checked ? selected.filter((k) => k !== o.key) : [...selected, o.key])}
                />
                <span>{o.label}</span>
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

  // number
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  return (
    <div data-question={q.key} data-evidence={q.evidence} className="grid gap-2">
      <label htmlFor={id} className="field-label text-base">
        {label}
      </label>
      {help && (
        <p id={hintId} className="field-hint">
          {help}
        </p>
      )}
      <div className="flex max-w-xs items-center gap-3">
        <input
          id={id}
          type="text"
          inputMode={q.integer ? "numeric" : "decimal"}
          autoComplete="off"
          className="field"
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          aria-invalid={error ? true : undefined}
          aria-describedby={[help ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {q.unit && <span className="text-sm text-fg-muted">{q.unit}</span>}
      </div>
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

function EngineResult({
  result,
  content,
  locale,
  headingRef,
  domainLinks,
  contactHref,
  privacyHref,
  retentionDays,
  answers,
  assessment,
  tool,
  version,
  onRestart,
}: {
  result: AssessmentResultView;
  content: Content;
  locale: Locale;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  domainLinks: Props["domainLinks"];
  contactHref: string;
  privacyHref: string;
  retentionDays: number;
  answers: Record<string, AnswerValue>;
  assessment: AssessmentKey;
  tool: Props["tool"];
  version: string;
  onRestart: () => void;
}) {
  const r = content.result;
  const rep = content.report;
  const [saved, setSaved] = useState<{ token: string; reference: string; expires: string } | null>(null);
  const [busy, setBusy] = useState<"save" | "pdf" | "view" | null>(null);
  const [report, setReport] = useState<ReportDocument | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const titles = Object.fromEntries(result.recommendations.map((f) => [f.key, f.title]));
  const metrics = result.inputs.filter((i) => i.evidence === "metric");
  const evidence = (result.extras.metrics_evidence as keyof typeof r.metrics.evidence | undefined) ?? undefined;
  const services = result.domains.map((d) => domainLinks[d]).filter(Boolean) as { href: string; label: string }[];

  async function save() {
    setBusy("save");
    const response = await scoreAssessment(assessment, version, answers, locale, true);
    setBusy(null);
    if (response.ok && response.data.saved?.token) {
      const s = response.data.saved;
      setSaved({ token: s.token!, reference: s.reference, expires: new Date(s.expires_at).toLocaleDateString(locale === "bg" ? "bg-BG" : "en-GB") });
      setNotice(null);
    } else setNotice({ tone: "error", text: rep.failed });
  }

  async function toggleReport() {
    if (report) {
      setReport(null);
      return;
    }
    if (!saved) return;
    setBusy("view");
    const response = await fetchReportDocument(saved.token, locale);
    setBusy(null);
    if (response.ok) setReport(response.data);
    else setNotice({ tone: "error", text: rep.failed });
  }

  async function downloadPdf() {
    if (!saved) return;
    setBusy("pdf");
    const response = await fetchReportPdf(saved.token, locale);
    setBusy(null);
    if (!response.ok) {
      setNotice({ tone: "error", text: rep.failed });
      return;
    }
    const url = URL.createObjectURL(response.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = locale === "bg" ? "doklad-ocenka.pdf" : "assessment-report.pdf";
    link.click();
    URL.revokeObjectURL(url);
    trackToolEvent({ name: "export_requested", tool, locale, format: "pdf" });
  }

  async function remove() {
    if (!saved) return;
    await deleteSavedResult(saved.token, locale);
    setSaved(null);
    setReport(null);
    setNotice({ tone: "success", text: rep.deleted });
  }

  return (
    <div className="grid gap-10" data-testid="engine-result">
      <div className="tool-frame p-6 sm:p-8">
        <ResultSummary
          title={r.title}
          headingRef={headingRef}
          overall={result.overall}
          overallLabel={r.overall}
          outOf={r.outOf}
          level={result.band}
          levelLabel={r.level}
          dimensionsTitle={r.byArea}
          dimensions={result.dimensions.map((d) => ({ key: d.key, label: d.title, score: d.score, note: d.level.title }))}
        />
        <p className="mt-6 text-sm text-fg-muted">{r.selfReported}</p>
      </div>

      {metrics.length > 0 || evidence ? (
        <section aria-labelledby="engine-metrics-title" className="grid gap-3" data-testid="engine-metrics">
          <h2 id="engine-metrics-title" className="t-h3-lg">
            {r.metrics.title}
          </h2>
          <p className="text-fg-muted">{r.metrics.note}</p>
          {evidence && (
            <p>
              <Badge tone={evidence === "measured" ? "success" : "warning"}>{r.metrics.evidence[evidence]}</Badge>
            </p>
          )}
          {metrics.length > 0 && (
            <dl className="grid gap-2 sm:grid-cols-2">
              {metrics.map((m) => (
                <div key={m.question} className="rounded-[var(--radius-md)] border border-line-subtle p-3">
                  <dt className="text-sm text-fg-muted">{m.text}</dt>
                  <dd className="font-medium text-fg">{m.answer}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ) : null}

      {KIND_ORDER.map((kind) => {
        const items = result.recommendations.filter((f) => f.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} aria-labelledby={`engine-kind-${kind}`} className="grid gap-4" data-testid={`engine-findings-${kind}`}>
            <h2 id={`engine-kind-${kind}`} className="t-h3-lg">
              {r.kinds[kind]}
            </h2>
            <ul className="grid gap-3">
              {items.map((f) => (
                <li key={f.key} className="rounded-[var(--radius-md)] border border-line-subtle p-4" data-finding={f.key}>
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                    {f.title}
                    {f.horizon && <Badge tone="outline">{fill(r.horizon, { days: f.horizon })}</Badge>}
                  </p>
                  <p className="mt-1 leading-relaxed text-fg-secondary">{f.description}</p>
                  {f.because.length > 0 && (
                    <div className="mt-2 text-sm text-fg-muted">
                      <span className="font-medium">{r.because}:</span>
                      <ul className="mt-1 list-disc pl-5">
                        {f.because.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {result.recommendations.length === 0 && <p className="text-fg-muted">{r.noFindings}</p>}

      {result.roadmap.length > 0 && (
        <section aria-labelledby="engine-roadmap-title" className="grid gap-4" data-testid="engine-roadmap">
          <h2 id="engine-roadmap-title" className="t-h3-lg">
            {assessment === "devops_delivery" ? r.backlog : r.roadmap}
          </h2>
          <p className="text-sm text-fg-muted">{r.roadmapNote}</p>
          <ol className="grid gap-4 md:grid-cols-3">
            {result.roadmap.map((step) => (
              <li key={step.horizon} className="rounded-[var(--radius-md)] border border-line-subtle p-4">
                <p className="t-label">{fill(r.horizon, { days: step.horizon })}</p>
                <ol className="mt-2 grid list-decimal gap-1 pl-5 text-fg-secondary">
                  {step.items.map((key) => (
                    <li key={key}>{titles[key]}</li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </section>
      )}

      {services.length > 0 && (
        <section aria-labelledby="engine-services-title" className="grid gap-3" data-testid="engine-services">
          <h2 id="engine-services-title" className="t-h3-lg">
            {r.services}
          </h2>
          <p className="text-fg-muted">{r.servicesNote}</p>
          <ul className="flex flex-wrap gap-3">
            {services.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="link">
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Alert tone="info" role="note">
        {result.disclaimer}
      </Alert>

      <section aria-labelledby="engine-report-title" className="tool-frame grid gap-4 p-6 sm:p-8 print:hidden" data-testid="engine-report">
        <h2 id="engine-report-title" className="t-h3-lg">
          {rep.title}
        </h2>
        <p className="max-w-2xl text-fg-muted">{fill(rep.text, { days: retentionDays })}</p>
        {notice && (
          <Alert tone={notice.tone} role={notice.tone === "error" ? "alert" : "status"}>
            {notice.text}
          </Alert>
        )}
        {saved ? (
          <>
            <p role="status" data-testid="engine-saved">
              {fill(rep.saved, { date: saved.expires, ref: saved.reference })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={toggleReport} loading={busy === "view"} loadingLabel={rep.view} aria-expanded={Boolean(report)}>
                {report ? rep.hide : rep.view}
              </Button>
              <Button variant="secondary" onClick={downloadPdf} loading={busy === "pdf"} loadingLabel={rep.pdfLoading}>
                {rep.pdf}
              </Button>
              <Button variant="ghost" onClick={remove}>
                {rep.delete}
              </Button>
            </div>
          </>
        ) : (
          <div>
            <Button onClick={save} loading={busy === "save"} loadingLabel={rep.creating}>
              {rep.create}
            </Button>
          </div>
        )}
      </section>

      {report && <ReportView document={report} label={rep.viewLabel} />}

      <Consultation
        content={content.consultation}
        token={saved?.token ?? null}
        locale={locale}
        contactHref={contactHref}
        privacyHref={privacyHref}
      />

      <div className="flex flex-wrap gap-3 print:hidden">
        <Button variant="secondary" onClick={onRestart}>
          {r.startOver}
        </Button>
        <Button variant="ghost" onClick={() => window.print()}>
          {r.print}
        </Button>
      </div>
    </div>
  );
}

function Consultation({
  content: c,
  token,
  locale,
  contactHref,
  privacyHref,
}: {
  content: Content["consultation"];
  token: string | null;
  locale: Locale;
  contactHref: string;
  privacyHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ name: "", email: "", company: "", message: "", privacy: false, marketing: false, website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [formToken, setFormToken] = useState("");

  useEffect(() => {
    if (open && !formToken) fetchFormToken().then(setFormToken);
  }, [open, formToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const found: Record<string, string> = {};
    if (values.name.trim().length < 2) found.name = c.required;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) found.email = c.invalidEmail;
    if (values.company.trim().length < 2) found.company = c.required;
    if (!values.privacy) found.privacy = c.privacyRequired;
    setErrors(found);
    if (Object.keys(found).length) return;
    setSending(true);
    const response = await requestConsultation(
      token,
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
      locale,
    );
    setSending(false);
    fetchFormToken().then(setFormToken);
    if (response.ok) setStatus({ tone: "success", text: fill(c.sent, { ref: response.reference }) });
    else setStatus({ tone: "error", text: response.kind === "conflict" ? c.exists : response.kind === "rate_limited" ? c.rateLimited : c.failed });
  }

  const field = (key: "name" | "email" | "company", label: string, type = "text", autoComplete?: string) => (
    <div className="grid gap-1.5">
      <label htmlFor={`consult-${key}`} className="field-label">
        {label} <span className="field-required" aria-hidden="true">*</span>
      </label>
      <input
        id={`consult-${key}`}
        type={type}
        autoComplete={autoComplete}
        className="field"
        value={values[key]}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={errors[key] ? `consult-${key}-error` : undefined}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
      {errors[key] && (
        <p id={`consult-${key}-error`} className="field-error">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <section aria-labelledby="engine-consult-title" className="tool-frame grid gap-4 p-6 sm:p-8 print:hidden" data-testid="engine-consultation">
      <h2 id="engine-consult-title" className="t-h3-lg">
        {c.title}
      </h2>
      <p className="max-w-2xl text-fg-muted">{c.text}</p>
      {!token ? (
        <div className="grid gap-3">
          <p className="text-sm text-fg-muted">{c.needsSave}</p>
          <div>
            <ButtonLink href={contactHref} variant="secondary" icon="arrowRight">
              {c.contact}
            </ButtonLink>
          </div>
        </div>
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
        <form onSubmit={submit} noValidate className="grid gap-4" data-testid="engine-consultation-form">
          {status && (
            <Alert tone="error" role="alert">
              {status.text}
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("name", c.name, "text", "name")}
            {field("email", c.email, "email", "email")}
            {field("company", c.company, "text", "organization")}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="consult-message" className="field-label">
              {c.message}
            </label>
            <textarea
              id="consult-message"
              className="field min-h-24"
              maxLength={1000}
              value={values.message}
              onChange={(e) => setValues((v) => ({ ...v, message: e.target.value }))}
            />
          </div>
          <div className="hidden" aria-hidden="true">
            <label htmlFor="consult-website">Website</label>
            <input id="consult-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-fg-secondary">
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={values.privacy}
                aria-invalid={errors.privacy ? true : undefined}
                aria-describedby={errors.privacy ? "consult-privacy-error" : undefined}
                onChange={(e) => setValues((v) => ({ ...v, privacy: e.target.checked }))}
                data-testid="consult-privacy"
              />
              <span>
                {c.privacy}{" "}
                <Link href={privacyHref} className="link">
                  {c.privacyLink}
                </Link>
              </span>
            </label>
            {errors.privacy && (
              <p id="consult-privacy-error" className="field-error">
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
