"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { ToolActions } from "@/components/tools/ToolActions";
import {
  ChoiceQuestion,
  InsightList,
  MethodologyNote,
  PhasedRoadmap,
  RecommendationList,
  ResultSummary,
  StepNav,
  StepProgress,
  StrengthsGaps,
  ToolLeadCapture,
  ToolState,
} from "@/components/tools/ToolUi";
import { Alert, Button } from "@/components/ui/primitives";
import type { readinessTool } from "@/content/bg/tool-readiness";
import type { tools } from "@/content/bg/tools";
import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { type ToolEvent, trackToolEvent } from "@/lib/analytics";
import {
  ACTION_SERVICE,
  type AnswerScore,
  DIMENSION_WEIGHTS,
  READINESS_DIMENSIONS,
  READINESS_QUESTIONS,
  type ReadinessAnswers,
  type ReadinessQuestionId,
  type ReadinessResult,
  type RoadmapItem,
  decodeAnswers,
  encodeAnswers,
  missingAnswers,
  scoreReadiness,
} from "@/lib/readiness";
import { useStepFlow } from "@/lib/use-step-flow";

type Content = typeof readinessTool;
type Ui = (typeof tools)["ui"];
type ServiceLinks = Partial<Record<ServiceKey, { href: string; label: string }>>;

/** Text of a roadmap entry: a band milestone or one of the actions (blocker items). */
function roadmapText(item: RoadmapItem, content: Content): string {
  return item in content.result.roadmap
    ? content.result.roadmap[item as keyof Content["result"]["roadmap"]]
    : content.result.actions[item as keyof Content["result"]["actions"]].title;
}

/** Plain-text summary for download (no personal data: only scores, levels and recommendations). */
export function readinessSummaryText(result: ReadinessResult, content: Content, services: ServiceLinks): string {
  const r = content.result;
  const dimension = (key: keyof Content["steps"]) => content.steps[key].title;
  const section = (title: string, lines: string[]) => (lines.length ? ["", `${title}:`, ...lines] : []);
  return [
    r.summaryHeading,
    "",
    `${r.overallLabel}: ${result.overall}/100 — ${r.bandLabel}: ${r.bands[result.band].title}`,
    r.bands[result.band].description,
    ...section(r.dimensionsTitle, result.dimensions.map((d) => `- ${dimension(d.dimension)}: ${d.score}/100`)),
    ...section(r.blockersTitle, result.blockers.map((b) => `- ${r.blockers[b].title}: ${r.blockers[b].text}`)),
    ...section(r.strengthsTitle, result.strengths.map((d) => `- ${dimension(d)}`)),
    ...section(r.gapsTitle, result.gaps.map((d) => `- ${dimension(d)}`)),
    ...section(
      r.actionsTitle,
      result.actions.map((a, i) => `${i + 1}. ${r.actions[a].title} — ${r.actions[a].text} (${r.serviceLabel}: ${services[ACTION_SERVICE[a]]?.label ?? ""})`),
    ),
    ...section(r.useCasesTitle, result.useCases.map((u) => `- ${r.useCases[u].title}: ${r.useCases[u].text}`)),
    ...section(
      r.roadmapTitle,
      (["d30", "d60", "d90"] as const).flatMap((phase) => [
        `${r.roadmapPhases[phase]}:`,
        ...result.roadmap[phase].map((item) => `  - ${roadmapText(item, content)}`),
      ]),
    ),
    "",
    r.methodology.disclaimer,
  ].join("\n");
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
  /** Localized link and label for every service an action can point to. */
  services: ServiceLinks;
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
  const track = (name: ToolEvent["name"], extra: Partial<ToolEvent> = {}) => trackToolEvent({ name, tool: "readiness", locale, ...extra });

  const flow = useStepFlow({
    steps: READINESS_DIMENSIONS.length,
    validate: (step) => missingAnswers(answers, READINESS_DIMENSIONS[step]),
    onStart: () => track("tool_started"),
    onStepComplete: (step) => track("step_completed", { step: step + 1, totalSteps: READINESS_DIMENSIONS.length }),
    initialComplete: restored,
  });

  const scored = useMemo(() => (flow.complete ? scoreReadiness(answers) : null), [flow.complete, answers]);
  const result = scored?.complete ? scored : null;

  useEffect(() => {
    track("tool_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    if (!result) return;
    track("tool_completed", { result: result.band });
    resultHeadingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per result
  }, [result]);

  const dimension = READINESS_DIMENSIONS[flow.step];
  const stepTitles = READINESS_DIMENSIONS.map((d) => content.steps[d].title);

  function answer(id: ReadinessQuestionId, value: number) {
    flow.touch();
    setAnswers((current) => ({ ...current, [id]: value as AnswerScore }));
    flow.clearError(id);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flow.next()) {
      // Move focus to the new step's heading so it is announced (and scrolled into view).
      requestAnimationFrame(() => stepHeadingRef.current?.focus());
    } else {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("fieldset[aria-invalid] input")?.focus());
    }
  }

  function restart() {
    setAnswers({});
    setRestored(false);
    flow.restart();
    window.history.replaceState(null, "", window.location.pathname);
  }

  if (result) {
    const r = content.result;
    const dimensionLabel = (key: keyof Content["steps"]) => content.steps[key].title;
    return (
      <div className="grid gap-12" data-testid="readiness-result">
        {restored && <ToolState kind="success" title={ui.linkRestored} />}
        <ResultSummary
          title={r.title}
          headingRef={resultHeadingRef}
          overall={result.overall}
          overallLabel={r.overallLabel}
          outOf={r.outOf}
          level={r.bands[result.band]}
          levelLabel={r.bandLabel}
          dimensionsTitle={r.dimensionsTitle}
          thresholds={{ low: 50, high: 75 }}
          dimensions={result.dimensions.map((d) => ({
            key: d.dimension,
            label: dimensionLabel(d.dimension),
            score: d.score,
            note: r.weightLabel.replace("{n}", String(DIMENSION_WEIGHTS[d.dimension])),
          }))}
        />

        {result.blockers.length > 0 && (
          <section aria-labelledby="readiness-blockers-title" data-testid="readiness-blockers">
            <Alert tone="warning">
              <h2 id="readiness-blockers-title" className="font-semibold">
                {r.blockersTitle}
              </h2>
              <ul className="mt-2 grid gap-1.5">
                {result.blockers.map((blocker) => (
                  <li key={blocker}>
                    <strong>{r.blockers[blocker].title}.</strong> {r.blockers[blocker].text}
                  </li>
                ))}
              </ul>
            </Alert>
          </section>
        )}

        <StrengthsGaps
          columns={[
            { id: "readiness-strengths", title: r.strengthsTitle, tone: "good", items: result.strengths.map(dimensionLabel), empty: r.noStrengths },
            { id: "readiness-gaps", title: r.gapsTitle, tone: "attention", items: result.gaps.map(dimensionLabel), empty: r.noGaps },
          ]}
        />

        <RecommendationList
          title={r.actionsTitle}
          serviceLabel={r.serviceLabel}
          items={result.actions
            .filter((action) => services[ACTION_SERVICE[action]])
            .map((action) => ({
              key: action,
              title: r.actions[action].title,
              text: r.actions[action].text,
              service: services[ACTION_SERVICE[action]]!,
            }))}
        />

        <InsightList
          id="readiness-use-cases"
          title={r.useCasesTitle}
          items={result.useCases.map((useCase) => ({ key: useCase, ...r.useCases[useCase] }))}
        />

        <PhasedRoadmap
          id="readiness-roadmap"
          title={r.roadmapTitle}
          phases={(["d30", "d60", "d90"] as const).map((phase) => ({
            key: phase,
            label: r.roadmapPhases[phase],
            items: result.roadmap[phase].map((item) => roadmapText(item, content)),
          }))}
        />

        <MethodologyNote
          title={r.methodologyTitle}
          paragraphs={[r.methodology.scale, r.methodology.weights, r.methodology.bands, r.methodology.blockers, r.methodology.disclaimer]}
        />

        <ToolActions
          title={ui.actionsTitle}
          labels={ui}
          fileName="ai-readiness.txt"
          summaryText={() => readinessSummaryText(result, content, services)}
          shareUrl={() => `${window.location.origin}${window.location.pathname}?r=${encodeAnswers(answers)}`}
          onExport={(format) => track("export_requested", { format })}
        />
        <ToolLeadCapture
          title={content.leadCapture.title}
          text={content.leadCapture.text}
          primary={{ href: contactHref, label: content.leadCapture.cta }}
          secondary={advisorHref ? { href: advisorHref, label: content.leadCapture.secondary } : undefined}
        />
        <p className="text-sm leading-relaxed text-fg-subtle">{r.note}</p>
        <div className="print:hidden">
          <Button variant="ghost" onClick={restart}>
            {ui.restart}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      noValidate
      className="tool-frame grid gap-8 p-5 sm:p-8"
      data-testid="readiness-form"
      aria-labelledby="readiness-step-title"
    >
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
        {READINESS_QUESTIONS[dimension].map((id) => (
          <ChoiceQuestion
            key={id}
            id={`readiness-${id}`}
            label={content.questions[id].label}
            options={[...content.questions[id].options]}
            value={answers[id]}
            error={flow.errors.includes(id) ? ui.required : undefined}
            onChange={(value) => answer(id, value)}
            levelLabel={content.levelLabel}
          />
        ))}
      </div>
      <p className="text-sm text-fg-subtle">{ui.privacy}</p>
      <StepNav isFirst={flow.isFirst} isLast={flow.isLast} labels={ui} onBack={flow.back} />
    </form>
  );
}
