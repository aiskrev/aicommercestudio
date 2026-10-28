"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { BarList, Matrix } from "@/components/tools/charts/Charts";
import { ROI_PROCESS_KEY } from "@/components/tools/roi/RoiCalculator";
import { fill } from "@/components/tools/team/TeamControls";
import { ToolActions } from "@/components/tools/ToolActions";
import { ChoiceQuestion, MethodologyNote, StepNav, StepProgress, ToolLeadCapture } from "@/components/tools/ToolUi";
import { Icon } from "@/components/ui/Icon";
import { Alert, Button, cx } from "@/components/ui/primitives";
import type { finderTool } from "@/content/bg/tool-finder";
import type { tools } from "@/content/bg/tools";
import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";
import type { AgentKey, Department } from "@/lib/ai-team";
import { type ExportFormat, type ToolEvent, trackToolEvent } from "@/lib/analytics";
import {
  CRITERIA,
  CRITERION_DIRECTION,
  type Category,
  type Level,
  MAX_PROCESSES,
  type Opportunity,
  PROCESS_AREAS,
  type ProcessInput,
  missingCriteria,
  rankOpportunities,
  type Risk,
  suggestPilot,
} from "@/lib/finder";
import { useStepFlow } from "@/lib/use-step-flow";

type Content = typeof finderTool;
type Ui = (typeof tools)["ui"];
type ServiceLinks = Partial<Record<ServiceKey, { href: string; label: string }>>;

const NAME_MIN = 2;
const NAME_MAX = 80;
const CATEGORY_BADGE: Record<Category, string> = { quick_win: "badge-success", strategic: "badge-accent", consider: "", not_ready: "badge-warning" };
const RISK_BADGE: Record<Risk, string> = { low: "badge-success", medium: "", high: "badge-warning" };
const newProcess = (): ProcessInput => ({ name: "", area: "operations", ratings: {} });

export function finderSummaryText(content: Content, ranked: Opportunity[], areaName: (d: Department) => string, agentName: (a: AgentKey) => string): string {
  const r = content.result;
  const lines = [content.summaryHeading, ""];
  for (const o of ranked) {
    lines.push(
      `${o.rank}. ${o.name} (${areaName(o.area)}) — ${r.suitability} ${o.suitability}/100 · ${content.categories[o.category].title}`,
      `   ${r.subscores.fit.label} ${o.fit} · ${r.subscores.value.label} ${o.value} · ${r.subscores.effort.label} ${o.effort}`,
      `   ${r.riskLabel}: ${r.risks[o.risk]}`,
      `   ${r.patternLabel}: ${content.patterns[o.pattern].title}${o.approvalRequired ? ` (${r.approval})` : ""}`,
      `   ${r.agentsLabel}: ${o.agents.length ? o.agents.map(agentName).join(", ") : o.pattern === "fix_first" ? r.agentsLater : r.noAgents}`,
      `   ${r.blockersLabel}: ${o.blockers.length ? o.blockers.map((b) => content.blockers[b]).join(" ") : r.noBlockers}`,
      `   ${r.stepsLabel}: ${o.nextSteps.map((s) => content.nextSteps[s]).join(" ")}`,
      "",
    );
  }
  lines.push(content.disclaimer);
  return lines.join("\n");
}

export function OpportunityFinder({
  content,
  ui,
  locale,
  areaNames,
  agentNames,
  contactHref,
  roiHref,
  teamHref,
  advisorHref,
  services = {},
  workshops = [],
}: {
  content: Content;
  ui: Ui;
  locale: Locale;
  areaNames: Record<Department, string>;
  agentNames: Record<AgentKey, string>;
  contactHref: string;
  roiHref?: string;
  teamHref?: string;
  advisorHref?: string;
  /** Localized link and label per service a process can point to. */
  services?: ServiceLinks;
  /** Domain hubs that list the published workshops and consultant-led assessments. */
  workshops?: { href: string; label: string }[];
}) {
  const [processes, setProcesses] = useState<ProcessInput[]>(() => [newProcess()]);
  const formRef = useRef<HTMLFormElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);
  const router = useRouter();
  const track = (name: ToolEvent["name"], extra: Partial<ToolEvent> = {}) => trackToolEvent({ name, tool: "finder", locale, ...extra });
  const steps = 1 + processes.length;

  const flow = useStepFlow({
    steps,
    validate: (step) => {
      if (step === 0) {
        return processes.flatMap((p, i) => (p.name.trim().length < NAME_MIN || p.name.trim().length > NAME_MAX ? [`name-${i}`] : []));
      }
      return missingCriteria(processes[step - 1].ratings).map((c) => `${step - 1}-${c}`);
    },
    onStart: () => track("tool_started"),
    onStepComplete: (step) => track("step_completed", { step: step + 1, totalSteps: steps }),
  });

  const ranked = useMemo(() => (flow.complete ? rankOpportunities(processes) : []), [flow.complete, processes]);

  useEffect(() => {
    track("tool_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    if (!flow.complete || ranked.length === 0) return;
    track("tool_completed", { result: ranked[0].category });
    resultRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per completed result
  }, [flow.complete]);

  function setProcess(index: number, patch: Partial<ProcessInput>) {
    flow.touch();
    setProcesses((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function rate(index: number, criterion: (typeof CRITERIA)[number], level: number) {
    flow.clearError(`${index}-${criterion}`);
    setProcesses((current) => current.map((p, i) => (i === index ? { ...p, ratings: { ...p.ratings, [criterion]: level as Level } } : p)));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flow.next()) requestAnimationFrame(() => headingRef.current?.focus());
    else requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'] input, input[aria-invalid='true']")?.focus());
  }

  function restart() {
    setProcesses([newProcess()]);
    flow.restart();
  }

  function openRoi(name: string) {
    if (!roiHref) return;
    try {
      window.sessionStorage.setItem(ROI_PROCESS_KEY, name);
    } catch {
      // Without storage the calculator simply starts without the description.
    }
    router.push(roiHref);
  }

  if (flow.complete) {
    return (
      <FinderResult
        content={content}
        ui={ui}
        ranked={ranked}
        areaNames={areaNames}
        agentNames={agentNames}
        headingRef={resultRef}
        contactHref={contactHref}
        teamHref={teamHref}
        advisorHref={advisorHref}
        services={services}
        workshops={workshops}
        onRoi={roiHref ? openRoi : undefined}
        onRestart={restart}
        onExport={(format) => track("export_requested", { format })}
      />
    );
  }

  const errors = new Set(flow.errors);
  const stepTitles = [content.steps.processes, ...processes.map((p, i) => p.name.trim() || fill(content.processes.nameLabel, { n: i + 1 }))];
  const current = flow.step - 1;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="tool-frame grid gap-8 p-5 sm:p-8" data-testid="finder-form" aria-labelledby="finder-step-title">
      <StepProgress steps={[...stepTitles, content.steps.results]} current={flow.step} label={ui.progress} stepOf={ui.stepOf} />
      <div key={flow.step} className="step-enter grid gap-8">
        <div>
          <h2 id="finder-step-title" ref={headingRef} tabIndex={-1} className="t-h3-lg scroll-mt-28 outline-none">
            {flow.step === 0 ? content.processes.title : fill(content.rate.title, { name: processes[current].name.trim() })}
          </h2>
          <p className="mt-1.5 text-fg-muted">{flow.step === 0 ? content.processes.text : content.rate.text}</p>
        </div>
        {flow.errors.length > 0 && (
          <Alert tone="error" role="alert">
            {content.errors.summary}
          </Alert>
        )}

        {flow.step === 0 ? (
          <div className="grid gap-4">
            {processes.map((process, index) => {
              const nameId = `finder-name-${index}`;
              const invalid = errors.has(`name-${index}`);
              return (
                <div key={index} className="card grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-start" data-testid={`finder-process-${index}`}>
                  <div>
                    <label htmlFor={nameId} className="field-label">
                      {fill(content.processes.nameLabel, { n: index + 1 })}
                    </label>
                    <input
                      id={nameId}
                      className="field"
                      maxLength={NAME_MAX}
                      value={process.name}
                      placeholder={content.processes.namePlaceholder}
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? `${nameId}-error` : undefined}
                      onChange={(event) => {
                        setProcess(index, { name: event.target.value });
                        flow.clearError(`name-${index}`);
                      }}
                    />
                    {invalid && (
                      <p id={`${nameId}-error`} className="field-error">
                        {content.errors.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label htmlFor={`finder-area-${index}`} className="field-label">
                      {content.processes.areaLabel}
                    </label>
                    <select
                      id={`finder-area-${index}`}
                      className="field"
                      value={process.area}
                      onChange={(event) => setProcess(index, { area: event.target.value as Department })}
                    >
                      {PROCESS_AREAS.map((area) => (
                        <option key={area} value={area}>
                          {areaNames[area]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {processes.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="sm:mt-7"
                      aria-label={fill(content.processes.remove, { n: index + 1 })}
                      onClick={() => setProcesses((current) => current.filter((_, i) => i !== index))}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
            {processes.length < MAX_PROCESSES ? (
              <div>
                <Button variant="secondary" icon="arrowRight" onClick={() => setProcesses((current) => [...current, newProcess()])}>
                  {content.processes.add}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-fg-muted">{fill(content.processes.max, { n: MAX_PROCESSES })}</p>
            )}
          </div>
        ) : (
          <div className="grid gap-8">
            <p className="text-sm text-fg-subtle" aria-live="polite">
              {fill(content.rate.progress, { done: CRITERIA.length - missingCriteria(processes[current].ratings).length, total: CRITERIA.length })}
            </p>
            {CRITERIA.map((criterion) => {
              const c = content.criteria[criterion];
              return (
                <div key={criterion} className="grid gap-1">
                  <p className="text-xs text-fg-subtle">
                    {c.label} · {content.directionHint[CRITERION_DIRECTION[criterion]]}
                  </p>
                  <ChoiceQuestion
                    id={`finder-${current}-${criterion}`}
                    label={c.question}
                    options={[...c.levels]}
                    value={processes[current].ratings[criterion]}
                    error={errors.has(`${current}-${criterion}`) ? content.errors.rating : undefined}
                    onChange={(level) => rate(current, criterion, level)}
                    levelLabel={c.label}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      <StepNav isFirst={flow.isFirst} isLast={flow.isLast} labels={ui} onBack={flow.back} />
    </form>
  );
}

function FinderResult({
  content,
  ui,
  ranked,
  areaNames,
  agentNames,
  headingRef,
  contactHref,
  teamHref,
  advisorHref,
  services,
  workshops,
  onRoi,
  onRestart,
  onExport,
}: {
  content: Content;
  ui: Ui;
  ranked: Opportunity[];
  areaNames: Record<Department, string>;
  agentNames: Record<AgentKey, string>;
  headingRef: React.Ref<HTMLHeadingElement>;
  contactHref: string;
  teamHref?: string;
  advisorHref?: string;
  services: ServiceLinks;
  workshops: { href: string; label: string }[];
  onRoi?: (name: string) => void;
  onRestart: () => void;
  onExport: (format: ExportFormat) => void;
}) {
  const r = content.result;
  const c = content.charts;
  const pilot = suggestPilot(ranked);
  const pilotProcess = pilot ? ranked.find((o) => o.index === pilot.index) : undefined;
  return (
    <div className="grid gap-12" data-testid="finder-result">
      <header className="grid gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="t-h2 outline-none">
          {r.title}
        </h2>
        <p className="max-w-3xl leading-relaxed text-fg-muted">{r.lead}</p>
        <p className="max-w-3xl text-sm leading-relaxed text-fg-subtle" data-testid="finder-suitability-note">
          {r.suitabilityNote}
        </p>
      </header>

      <section aria-labelledby="finder-pilot-title" className="panel grid gap-2 p-5 sm:p-6" data-testid="finder-pilot">
        <h3 id="finder-pilot-title" className="t-h3">
          {content.pilot.title}
        </h3>
        {pilot && pilotProcess ? (
          <>
            <p className="leading-relaxed text-fg-secondary">
              {fill(content.pilot.text, { name: pilotProcess.name, pattern: content.patterns[pilot.pattern].title })}
            </p>
            {pilot.approvalRequired && <p className="text-sm font-medium text-warning">{content.pilot.approval}</p>}
            <p className="text-sm text-fg-muted">{fill(content.pilot.weeks, { min: pilot.weeks[0], max: pilot.weeks[1] })}</p>
          </>
        ) : (
          <p className="text-fg-muted">{content.pilot.none}</p>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="finder-ranking-title" className="card grid content-start gap-4 p-5">
          <h3 id="finder-ranking-title" className="t-label">
            {c.rankingTitle}
          </h3>
          <BarList
            label={c.rankingTitle}
            testId="finder-ranking"
            items={ranked.map((o) => ({ key: String(o.index), label: `${o.rank}. ${o.name}`, value: o.suitability }))}
          />
        </section>
        <section aria-labelledby="finder-matrix-title" className="card grid content-start gap-3 p-5">
          <h3 id="finder-matrix-title" className="t-label">
            {c.matrixTitle}
          </h3>
          <Matrix
            label={c.matrixTitle}
            xLabel={c.matrixX}
            yLabel={c.matrixY}
            quadrants={{ topLeft: c.quadrants.quickWins, topRight: c.quadrants.bigBets, bottomLeft: c.quadrants.fillIns, bottomRight: c.quadrants.avoid }}
            points={ranked.map((o) => ({
              key: String(o.index),
              rank: o.rank,
              name: o.name,
              x: o.effort,
              y: o.value,
              detail: `${r.subscores.value.label} ${o.value} · ${r.subscores.effort.label} ${o.effort} · ${content.categories[o.category].title}`,
            }))}
          />
          <p className="text-xs text-fg-subtle">{c.matrixNote}</p>
        </section>
      </div>

      <ol className="grid gap-6" data-testid="finder-opportunities">
        {ranked.map((o) => (
          <li key={o.index} className={cx("card grid gap-5 p-5 sm:p-6", o.rank === 1 && "card-accent")} data-category={o.category}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="t-index">
                  {fill(r.rank, { n: o.rank })} · {areaNames[o.area]}
                </p>
                <h3 className="t-h3-lg mt-1 break-words">{o.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={cx("badge", CATEGORY_BADGE[o.category])}>{content.categories[o.category].title}</span>
                  <span className={cx("badge badge-dot", RISK_BADGE[o.risk])} data-testid="finder-risk" data-risk={o.risk}>
                    {r.riskLabel}: {r.risks[o.risk]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-fg-muted">{content.categories[o.category].text}</p>
              </div>
              <p className="text-right">
                <span className="block font-display text-4xl font-bold text-fg" data-testid="finder-score">
                  {o.suitability}
                </span>
                <span className="text-xs text-fg-muted">
                  {r.suitability} · {r.outOf}
                </span>
              </p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-3">
              {(["fit", "value", "effort"] as const).map((key) => (
                <div key={key}>
                  <dt className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium text-fg">{r.subscores[key].label}</span>
                    <span className="font-mono text-fg-secondary">{o[key]}</span>
                  </dt>
                  <dd>
                    <meter min={0} max={100} low={40} high={60} optimum={key === "effort" ? 0 : 100} value={o[key]} className="tool-meter mt-1.5 block h-2 w-full" aria-label={`${r.subscores[key].label}: ${o[key]}/100`} />
                    <span className="mt-1 block text-xs text-fg-subtle">{r.subscores[key].text}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-fg-subtle">
              {fill(r.contribution, {
                fit: Math.round(o.contributions.fit),
                value: Math.round(o.contributions.value),
                ease: Math.round(o.contributions.ease),
              })}
            </p>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h4 className="t-label">{r.patternLabel}</h4>
                <p className="mt-1.5 font-semibold text-fg">
                  {content.patterns[o.pattern].title}
                  {o.approvalRequired && <span className="ml-2 badge badge-warning">{r.approval}</span>}
                </p>
                <p className="mt-1 text-sm text-fg-muted">{content.patterns[o.pattern].text}</p>
                {o.approvalRequired && <p className="mt-2 text-sm font-medium text-warning">{r.approvalMandatory}</p>}
                {o.risk === "high" && <p className="mt-1 text-sm text-fg-muted">{r.riskOverride}</p>}
                <h4 className="t-label mt-4">{r.agentsLabel}</h4>
                <p className="mt-1.5 text-sm text-fg-secondary">{o.agents.length > 0 ? o.agents.map((a) => agentNames[a]).join(", ") : o.pattern === "fix_first" ? r.agentsLater : r.noAgents}</p>
                {o.services.some((key) => services[key]) && (
                  <>
                    <h4 className="t-label mt-4">{r.servicesLabel}</h4>
                    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="finder-services">
                      {o.services
                        .filter((key) => services[key])
                        .map((key) => (
                          <li key={key}>
                            <Link href={services[key]!.href} className="link inline-flex min-h-8 items-center">
                              {services[key]!.label}
                            </Link>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </div>
              <div>
                <h4 className="t-label">{r.blockersLabel}</h4>
                {o.blockers.length > 0 ? (
                  <ul className="mt-1.5 grid gap-1 text-sm text-fg-secondary">
                    {o.blockers.map((b) => (
                      <li key={b} className="flex gap-2">
                        <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                        {content.blockers[b]}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-fg-muted">{r.noBlockers}</p>
                )}
                <h4 className="t-label mt-4">{r.stepsLabel}</h4>
                <ol className="mt-1.5 grid gap-1 text-sm text-fg-secondary">
                  {o.nextSteps.map((step, i) => (
                    <li key={step} className="flex gap-2">
                      <span className="font-mono text-brand">{i + 1}.</span>
                      {content.nextSteps[step]}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <details className="group border-t border-line-subtle pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-fg-secondary [&::-webkit-details-marker]:hidden">
                {r.breakdownLabel}
                <Icon name="chevronDown" className="h-4 w-4 text-brand transition-transform group-open:rotate-180" />
              </summary>
              <div className="mt-3">
                <BarList label={`${r.breakdownLabel}: ${o.name}`} items={CRITERIA.map((criterion) => ({ key: criterion, label: content.criteria[criterion].label, value: o.breakdown[criterion] }))} />
              </div>
            </details>

            <div className="flex flex-wrap gap-x-6 gap-y-2 print:hidden">
              {onRoi && (
                <button type="button" className="link text-sm" onClick={() => onRoi(o.name)}>
                  {r.roiLink}
                </button>
              )}
              {teamHref && o.agents.length > 0 && (
                <Link href={teamHref} className="link text-sm">
                  {r.teamLink}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {workshops.length > 0 && (
        <section aria-labelledby="finder-workshops-title" className="panel p-5 sm:p-6" data-testid="finder-workshops">
          <h3 id="finder-workshops-title" className="t-h3">
            {content.workshops.title}
          </h3>
          <p className="mt-2 text-fg-muted">{content.workshops.text}</p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {workshops.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="link inline-flex min-h-11 items-center font-semibold">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <MethodologyNote title={content.methodologyTitle} paragraphs={[...content.methodology, content.disclaimer]} />
      <ToolActions
        title={ui.actionsTitle}
        labels={ui}
        fileName="automation-opportunities.txt"
        summaryText={() => finderSummaryText(content, ranked, (d) => areaNames[d], (a) => agentNames[a])}
        onExport={onExport}
      />
      <ToolLeadCapture
        title={content.leadCapture.title}
        text={content.leadCapture.text}
        primary={{ href: contactHref, label: content.leadCapture.cta }}
        secondary={advisorHref ? { href: advisorHref, label: content.leadCapture.secondary } : undefined}
      />
      <div className="print:hidden">
        <Button variant="ghost" onClick={onRestart}>
          {ui.restart}
        </Button>
      </div>
    </div>
  );
}
