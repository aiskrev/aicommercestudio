"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ToolActions } from "@/components/tools/ToolActions";
import { ChoiceQuestion, RecommendationList, ResultSummary, StepNav, StepProgress, ToolLeadCapture, ToolState } from "@/components/tools/ToolUi";
import { Alert, Button } from "@/components/ui/primitives";
import type { readinessTool } from "@/content/bg/tool-readiness";
import type { tools } from "@/content/bg/tools";
import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { trackToolEvent } from "@/lib/analytics";
import {
  type AnswerScore,
  READINESS_DIMENSIONS,
  READINESS_QUESTIONS,
  type ReadinessAnswers,
  type ReadinessResult,
  decodeAnswers,
  encodeAnswers,
  missingAnswers,
  scoreReadiness,
} from "@/lib/readiness";
import { useStepFlow } from "@/lib/use-step-flow";

type Content = typeof readinessTool;
type Ui = (typeof tools)["ui"];

/** Plain-text summary for download (no personal data: the answers are option labels). */
export function readinessSummaryText(result: ReadinessResult, content: Content, serviceLabels: Record<string, string>): string {
  const r = content.result;
  const lines = [
    r.summaryHeading,
    "",
    `${r.overallLabel}: ${result.overall}/100 — ${r.levels[result.level].title}`,
    r.levels[result.level].description,
    "",
    `${r.dimensionsTitle}:`,
    ...result.dimensions.map((d) => `- ${content.steps[d.dimension].title}: ${d.score}/100`),
    "",
    `${r.recommendationsTitle}:`,
    ...result.recommendations.map(
      (rec, i) => `${i + 1}. ${r.recommendations[rec.dimension].title} — ${r.recommendations[rec.dimension].text} (${r.serviceLabel}: ${serviceLabels[rec.service]})`,
    ),
    "",
    r.note,
  ];
  return lines.join("\n");
}

export function ReadinessAssessment({
  content,
  ui,
  services,
  contactHref,
  advisorHref,
  locale,
}: {
  content: Content;
  ui: Ui;
  /** Localized link and label for every service a recommendation can point to. */
  services: Partial<Record<ServiceKey, { href: string; label: string }>>;
  contactHref: string;
  advisorHref?: string;
  locale: Locale;
}) {
  // A shared result (?r=<code>) is read during render; the page wraps this tool in <Suspense>.
  const shared = decodeAnswers(useSearchParams().get("r"));
  const [answers, setAnswers] = useState<ReadinessAnswers>(() => shared ?? {});
  const [restored, setRestored] = useState(() => shared !== null);
  const formRef = useRef<HTMLFormElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const track = (name: Parameters<typeof trackToolEvent>[0]["name"], extra: Partial<Parameters<typeof trackToolEvent>[0]> = {}) =>
    trackToolEvent({ name, tool: "readiness", locale, ...extra });

  const flow = useStepFlow({
    steps: READINESS_DIMENSIONS.length,
    validate: (step) => missingAnswers(READINESS_DIMENSIONS[step], answers),
    onStart: () => track("tool_started"),
    onStepComplete: (step) => track("step_completed", { step: step + 1, totalSteps: READINESS_DIMENSIONS.length }),
    initialComplete: restored,
  });

  const result = useMemo(() => (flow.complete ? scoreReadiness(answers) : null), [flow.complete, answers]);

  useEffect(() => {
    track("tool_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    if (!result) return;
    track("tool_completed", { result: result.level });
    resultHeadingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per result
  }, [result]);

  const dimension = READINESS_DIMENSIONS[flow.step];
  const stepTitles = READINESS_DIMENSIONS.map((d) => content.steps[d].title);

  function answer(id: string, value: number) {
    flow.touch();
    setAnswers((current) => ({ ...current, [id]: value as AnswerScore }));
    flow.clearError(id);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const moved = flow.next();
    if (!moved) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("fieldset[aria-invalid] input")?.focus());
    } else {
      // Move focus to the new step's heading so it is announced (and scrolled into view).
      requestAnimationFrame(() => stepHeadingRef.current?.focus());
    }
  }

  function restart() {
    setAnswers({});
    setRestored(false);
    flow.restart();
    window.history.replaceState(null, "", window.location.pathname);
  }

  if (result) {
    const serviceLabels = Object.fromEntries(Object.entries(services).map(([key, s]) => [key, s?.label ?? key]));
    return (
      <div className="grid gap-12" data-testid="readiness-result">
        {restored && <ToolState kind="success" title={ui.linkRestored} />}
        <ResultSummary
          title={content.result.title}
          headingRef={resultHeadingRef}
          overall={result.overall}
          overallLabel={content.result.overallLabel}
          outOf={content.result.outOf}
          level={content.result.levels[result.level]}
          dimensionsTitle={content.result.dimensionsTitle}
          dimensions={result.dimensions.map((d) => ({ key: d.dimension, label: content.steps[d.dimension].title, score: d.score }))}
        />
        <RecommendationList
          title={content.result.recommendationsTitle}
          serviceLabel={content.result.serviceLabel}
          items={result.recommendations
            .filter((rec) => services[rec.service])
            .map((rec) => ({
              key: rec.dimension,
              title: content.result.recommendations[rec.dimension].title,
              text: content.result.recommendations[rec.dimension].text,
              service: services[rec.service]!,
            }))}
        />
        <p className="text-sm leading-relaxed text-fg-subtle">{content.result.note}</p>
        <ToolActions
          title={ui.actionsTitle}
          labels={ui}
          fileName="ai-readiness.txt"
          summaryText={() => readinessSummaryText(result, content, serviceLabels)}
          shareUrl={() => `${window.location.origin}${window.location.pathname}?r=${encodeAnswers(answers)}`}
          onExport={(format) => track("export_requested", { format })}
        />
        <ToolLeadCapture
          title={content.leadCapture.title}
          text={content.leadCapture.text}
          primary={{ href: contactHref, label: content.leadCapture.cta }}
          secondary={advisorHref ? { href: advisorHref, label: content.leadCapture.secondary } : undefined}
        />
        <div className="print:hidden">
          <Button variant="ghost" onClick={restart}>
            {ui.restart}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="tool-frame grid gap-8 p-6 sm:p-8" data-testid="readiness-form" aria-labelledby="readiness-step-title">
      <StepProgress steps={stepTitles} current={flow.step} label={ui.progress} stepOf={ui.stepOf} />
      <div>
        <h2 id="readiness-step-title" ref={stepHeadingRef} tabIndex={-1} className="t-h3-lg scroll-mt-28 outline-none">
          {content.steps[dimension].title}
        </h2>
        <p className="mt-1.5 text-fg-muted">{content.steps[dimension].description}</p>
      </div>
      {flow.errors.length > 0 && (
        <Alert tone="error" role="alert">
          {ui.errorSummary}
        </Alert>
      )}
      <div className="grid gap-8">
        {READINESS_QUESTIONS[dimension].map((id) => {
          const question = content.questions[id as keyof Content["questions"]];
          return (
            <ChoiceQuestion
              key={id}
              id={`readiness-${id}`}
              label={question.label}
              options={[...question.options]}
              value={answers[id]}
              error={flow.errors.includes(id) ? ui.required : undefined}
              onChange={(value) => answer(id, value)}
            />
          );
        })}
      </div>
      <p className="text-sm text-fg-subtle">{ui.privacy}</p>
      <StepNav isFirst={flow.isFirst} isLast={flow.isLast} labels={ui} onBack={flow.back} />
    </form>
  );
}
