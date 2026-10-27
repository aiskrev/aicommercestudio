"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { type ComponentText, SolutionDiagram } from "@/components/tools/solution/SolutionDiagram";
import { PillGroup, SelectCard, fill } from "@/components/tools/team/TeamControls";
import { ToolActions } from "@/components/tools/ToolActions";
import { MethodologyNote, StepNav, StepProgress, ToolLeadCapture, ToolState } from "@/components/tools/ToolUi";
import { Alert, Button, cx } from "@/components/ui/primitives";
import type { agentLibrary } from "@/content/bg/agent-library";
import type { solutionTool } from "@/content/bg/tool-solution";
import type { teamTool } from "@/content/bg/tool-team";
import type { tools } from "@/content/bg/tools";
import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { type ToolEvent, trackToolEvent } from "@/lib/analytics";
import { type AgentKey, CHECKPOINTS, type Checkpoint, DEPLOYMENTS, type WorkflowKey } from "@/lib/ai-team";
import {
  CAPABILITIES,
  type Capability,
  type ComplexityFactor,
  type ComponentKey,
  EMPTY_SOLUTION,
  INTEGRATION_CATEGORIES,
  type IntegrationCategory,
  OBJECTIVES,
  SENSITIVITIES,
  SOLUTION_STEPS,
  SOLUTION_WORKFLOWS,
  type SolutionConfig,
  WORKFLOW_DEFAULTS,
  allowedApprovals,
  architecture,
  assessComplexity,
  decodeSolution,
  encodeSolution,
  integrationRequirements,
  minimumApproval,
  normaliseSolution,
  proposedAgents,
  redactionRequired,
  relatedServices,
  roadmap,
  securityConsiderations,
  stepIssues,
} from "@/lib/solution";
import { useStepFlow } from "@/lib/use-step-flow";

type Content = typeof solutionTool;
type Team = typeof teamTool;
type Library = typeof agentLibrary;
type Ui = (typeof tools)["ui"];
type ServiceLinks = Partial<Record<ServiceKey, { href: string; label: string }>>;

/** Five input steps, then the architecture review; the plan is the result. */
const STEPS = [...SOLUTION_STEPS, "review"] as const;

/** Options as a fieldset of selectable cards with one error message. */
function CardGroup({ id, legend, error, hint, children, columns = true }: { id: string; legend: string; error?: string; hint?: ReactNode; children: ReactNode; columns?: boolean }) {
  return (
    <fieldset id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="field-label mb-3 text-base">{legend}</legend>
      {hint}
      <div className={cx("grid gap-2", columns && "sm:grid-cols-2")}>{children}</div>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function SolutionBuilder({
  content,
  team,
  library,
  ui,
  services,
  contactHref,
  libraryHref,
  agentHrefs,
  locale,
}: {
  content: Content;
  team: Team;
  library: Library;
  ui: Ui;
  services: ServiceLinks;
  contactHref: string;
  libraryHref?: string;
  agentHrefs?: Partial<Record<AgentKey, string>>;
  locale: Locale;
}) {
  // A shared design (?s=<code>) or a workflow from the agent library (?w=<workflow>) is read during
  // render; the page wraps this tool in <Suspense>.
  const params = useSearchParams();
  const shared = decodeSolution(params.get("s"));
  const [config, setConfig] = useState<SolutionConfig>(() => {
    if (shared) return shared;
    const workflow = SOLUTION_WORKFLOWS.find((w) => w === params.get("w"));
    return workflow ? { ...EMPTY_SOLUTION, workflow, ...WORKFLOW_DEFAULTS[workflow] } : EMPTY_SOLUTION;
  });
  const [restored, setRestored] = useState(() => shared !== null);
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const track = (name: ToolEvent["name"], extra: Partial<ToolEvent> = {}) => trackToolEvent({ name, tool: "solution", locale, ...extra });

  const solution = useMemo(() => normaliseSolution(config), [config]);
  const flow = useStepFlow({
    steps: STEPS.length,
    validate: (step) => (STEPS[step] === "review" ? [] : stepIssues(solution, STEPS[step] as (typeof SOLUTION_STEPS)[number])),
    onStart: () => track("tool_started"),
    onStepComplete: (step) => track("step_completed", { step: step + 1, totalSteps: STEPS.length }),
    initialComplete: restored,
  });
  const complexity = useMemo(() => assessComplexity(solution), [solution]);

  useEffect(() => {
    track("tool_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    if (!flow.complete) return;
    track("tool_completed", { result: complexity.band });
    requestAnimationFrame(() => resultHeadingRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per completed result
  }, [flow.complete]);

  // ------------------------------------------------------------------------------- updates

  function update(patch: Partial<SolutionConfig>, cleared: string[] = []) {
    flow.touch();
    cleared.forEach(flow.clearError);
    setConfig((current) => ({ ...current, ...patch }));
  }

  function chooseWorkflow(workflow: WorkflowKey) {
    flow.touch();
    flow.clearError("workflow");
    // A new workflow replaces the suggested capabilities and integrations; the visitor can change them.
    setConfig((current) => (current.workflow === workflow ? current : { ...current, workflow, ...WORKFLOW_DEFAULTS[workflow] }));
  }

  const toggle = <T extends string>(list: readonly T[], values: T[], value: T, on: boolean) => list.filter((v) => (v === value ? on : values.includes(v)));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flow.next()) {
      requestAnimationFrame(() => stepHeadingRef.current?.focus());
    } else {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'] input:not(:disabled)")?.focus());
    }
  }

  function restart() {
    setConfig(EMPTY_SOLUTION);
    setRestored(false);
    flow.restart();
    window.history.replaceState(null, "", window.location.pathname);
  }

  // ------------------------------------------------------------------------------- labels

  const r = content.result;
  const agentName = (agent: AgentKey) => team.agents[agent].name;
  const categoryName = (category: IntegrationCategory) => library.categories[category].title;
  const checkpointName = (checkpoint: Checkpoint) => team.checkpoints[checkpoint].title;
  const describe = (key: ComponentKey): ComponentText => {
    const [kind, value] = key.split(":") as [string, string];
    if (kind === "agent") return { title: agentName(value as AgentKey), text: team.agents[value as AgentKey].purpose };
    if (kind === "tool") {
      const access = architecture(solution).find((c) => c.key === key)?.access ?? "read";
      return { title: categoryName(value as IntegrationCategory), text: library.categories[value as IntegrationCategory].text, meta: content.toolAccess[access] };
    }
    if (kind === "output") {
      const workflow = team.result.workflows[value as WorkflowKey];
      return { title: workflow.outcome, text: workflow.title };
    }
    if (key === "approval:gate" && solution.approval) {
      return { ...content.components[key], meta: checkpointName(solution.approval) };
    }
    return content.components[key as keyof Content["components"]];
  };
  const factorLabel = (factor: ComplexityFactor) => {
    switch (factor.kind) {
      case "capability":
        return fill(r.factors.capability, { name: content.capabilities[factor.capability].title });
      case "integration":
        return fill(r.factors.integration, { name: categoryName(factor.integration) });
      case "sensitivity":
        return fill(r.factors.sensitivity, { name: content.security.sensitivity.options[factor.sensitivity].title });
      case "approval":
        return r.factors.approval;
      case "deployment":
        return fill(r.factors.deployment, { name: team.teamStep.deployment.options[factor.deployment].title });
    }
  };
  const diagramLabels = {
    title: r.diagramTitle,
    note: r.diagramNote,
    layers: content.layers,
    notUsed: r.notUsed,
    hint: r.hint,
    detailsLabel: r.detailsLabel,
    monitoringNote: r.monitoringNote,
    listTitle: r.listTitle,
    table: r.table,
  };

  // ------------------------------------------------------------------------------- results

  if (flow.complete) {
    const agents = proposedAgents(solution);
    const requirements = integrationRequirements(solution);
    const security = securityConsiderations(solution);
    const phases = roadmap(solution);
    const serviceKeys = relatedServices(solution).filter((key) => services[key]);
    const objective = solution.objective ? content.objectives[solution.objective] : null;
    const summary = fill(r.summary, {
      objective: objective?.title ?? "",
      workflow: solution.workflow ? team.result.workflows[solution.workflow].title : "",
      agents: agents.length,
      integrations: solution.integrations.length,
      approval: solution.approval ? checkpointName(solution.approval) : "",
    });
    const weeks = (w: [number, number] | null) => (w ? fill(r.weeks, { min: w[0], max: w[1] }) : r.ongoing);
    const summaryText = () =>
      [
        content.summaryHeading,
        "",
        summary,
        objective ? `${r.kpiLabel}: ${objective.kpi}` : "",
        `${r.complexityTitle}: ${team.complexity[complexity.band]} (${fill(r.pointsLabel, { points: complexity.points })})`,
        "",
        `${r.responsibilitiesTitle}:`,
        ...architecture(solution).map((c) => `- ${content.layers[c.layer]}: ${describe(c.key).title}${describe(c.key).meta ? ` (${describe(c.key).meta})` : ""}`),
        "",
        `${r.integrationsTitle}:`,
        ...(requirements.length > 0
          ? requirements.map((q) => `- ${categoryName(q.category)}: ${content.toolAccess[q.access]}, ${r.auth[q.auth]}${q.gated ? `, ${r.gated}` : ""}`)
          : [`- ${r.noIntegrations}`]),
        "",
        `${r.securityTitle}:`,
        ...security.map((key) => `- ${team.security.items[key].title}`),
        "",
        `${r.roadmapTitle}:`,
        ...phases.map((p, i) => `${i + 1}. ${r.phases[p.key].title} — ${weeks(p.weeks)}`),
        "",
        r.disclaimer,
      ]
        .filter((line, i, all) => line !== "" || all[i - 1] !== "")
        .join("\n");

    return (
      <div className="grid gap-12 [&>*]:min-w-0" data-testid="solution-result">
        {restored && <ToolState kind="success" title={ui.linkRestored} />}
        <section aria-labelledby="solution-result-title" className="grid gap-6">
          <div>
            <h2 id="solution-result-title" ref={resultHeadingRef} tabIndex={-1} className="t-h2 outline-none">
              {r.title}
            </h2>
            <p className="mt-2 max-w-3xl leading-relaxed text-fg-muted">{r.lead}</p>
          </div>
          <Alert tone="info" role="note">
            {content.designNotice}
          </Alert>
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="card p-6">
              <h3 className="t-label">{r.summaryTitle}</h3>
              <p className="mt-3 leading-relaxed text-fg-secondary" data-testid="solution-summary">
                {summary}
              </p>
              {objective && (
                <p className="mt-4 text-sm">
                  <span className="text-fg-subtle">{r.kpiLabel}: </span>
                  <span className="text-fg">{objective.kpi}</span>
                </p>
              )}
            </div>
            <div className="card p-6">
              <h3 className="t-label">{r.complexityTitle}</h3>
              <p className="mt-3 flex items-baseline gap-3">
                <span className="font-display text-4xl font-bold tracking-[-0.03em] text-fg" data-testid="solution-complexity">
                  {team.complexity[complexity.band]}
                </span>
                <span className="text-sm text-fg-muted">{fill(r.pointsLabel, { points: complexity.points })}</span>
              </p>
              <p className="mt-2 text-xs text-fg-subtle">{r.complexityNote}</p>
            </div>
          </div>
        </section>

        <SolutionDiagram id="solution-result-diagram" components={architecture(solution)} describe={describe} labels={diagramLabels} />

        <section aria-labelledby="solution-responsibilities">
          <h2 id="solution-responsibilities" className="t-h3-lg">
            {r.responsibilitiesTitle}
          </h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {agents.map(({ agent, reason }) => (
              <li key={agent} className="card p-5" data-agent={agent}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="t-h3">{agentName(agent)}</h3>
                  <span className="badge">{content.agentReasons[reason]}</span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">{team.agents[agent].purpose}</p>
                <p className="mt-3 text-sm">
                  <span className="text-fg-subtle">{r.agentOversight}: </span>
                  <span className="text-fg-secondary">{team.agents[agent].oversight}</span>
                </p>
                {agentHrefs?.[agent] && (
                  <Link href={agentHrefs[agent]!} className="link mt-3 inline-block text-sm">
                    {r.openAgent}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="solution-integrations">
          <h2 id="solution-integrations" className="t-h3-lg">
            {r.integrationsTitle}
          </h2>
          {requirements.length > 0 ? (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[19rem] text-left text-sm" data-testid="solution-integrations">
                <thead className="text-fg-subtle">
                  <tr>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {r.integrationsTable.category}
                    </th>
                    <th scope="col" className="py-2 pr-4 font-medium">
                      {r.integrationsTable.access}
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      {r.integrationsTable.auth}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {requirements.map((q) => (
                    <tr key={q.category} className="border-t border-line-subtle align-top">
                      <th scope="row" className="py-2.5 pr-4 font-medium text-fg">
                        {categoryName(q.category)}
                      </th>
                      <td className="py-2.5 pr-4 text-fg-secondary">
                        {content.toolAccess[q.access]}
                        {q.gated && <span className="mt-0.5 block text-xs text-fg-subtle">{r.gated}</span>}
                      </td>
                      <td className="py-2.5 text-fg-secondary">{r.auth[q.auth]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-fg-muted">{r.noIntegrations}</p>
          )}
          <p className="mt-4 text-sm leading-relaxed text-fg-subtle">{r.sandbox}</p>
        </section>

        <section aria-labelledby="solution-security">
          <h2 id="solution-security" className="t-h3-lg">
            {r.securityTitle}
          </h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {security.map((key) => (
              <li key={key} className="rounded-[var(--radius-md)] border border-line-subtle p-4">
                <p className="font-semibold text-fg">{team.security.items[key].title}</p>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">{team.security.items[key].text}</p>
              </li>
            ))}
            {solution.residency && <li className="rounded-[var(--radius-md)] border border-line-subtle p-4 text-sm text-fg-secondary">{r.residencyNote}</li>}
            {solution.redaction && <li className="rounded-[var(--radius-md)] border border-line-subtle p-4 text-sm text-fg-secondary">{r.redactionNote}</li>}
          </ul>
        </section>

        <section aria-labelledby="solution-complexity-factors">
          <h2 id="solution-complexity-factors" className="t-h3-lg">
            {r.complexityTitle}
          </h2>
          <dl className="mt-6 grid gap-2 sm:max-w-xl">
            {complexity.factors.map((factor) => {
              const label = factorLabel(factor);
              return (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line-subtle pb-2 text-[15px]">
                  <dt className="text-fg-secondary">{label}</dt>
                  <dd className="font-mono text-sm text-fg">+{factor.points}</dd>
                </div>
              );
            })}
            <div className="flex items-baseline justify-between gap-4 pt-1 font-semibold">
              <dt className="text-fg">{team.complexity[complexity.band]}</dt>
              <dd className="font-mono text-sm text-fg">{fill(r.pointsLabel, { points: complexity.points })}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="solution-roadmap">
          <h2 id="solution-roadmap" className="t-h3-lg">
            {r.roadmapTitle}
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="solution-roadmap">
            {phases.map((phase, index) => (
              <li key={phase.key} className="min-w-0 border-t-2 border-brand/50 pt-4" data-phase={phase.key}>
                <p className="t-index">
                  {String(index + 1).padStart(2, "0")} · {r.phases[phase.key].title}
                </p>
                <p className="mt-1 text-sm text-fg-subtle">{weeks(phase.weeks)}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-fg-secondary">{r.phases[phase.key].text}</p>
                {phase.agents.length > 0 && (
                  <p className="mt-3 text-sm">
                    <span className="text-fg-subtle">{r.phaseAgents}: </span>
                    {phase.agents.map(agentName).join(", ")}
                  </p>
                )}
                {phase.integrations.length > 0 && (
                  <p className="mt-1 text-sm">
                    <span className="text-fg-subtle">{r.phaseIntegrations}: </span>
                    {phase.integrations.map(categoryName).join(", ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-fg-subtle">{r.effortNote}</p>
        </section>

        {serviceKeys.length > 0 && (
          <section aria-labelledby="solution-services">
            <h2 id="solution-services" className="t-h3-lg">
              {r.servicesTitle}
            </h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {serviceKeys.map((key) => (
                <li key={key}>
                  <Link href={services[key]!.href} className="badge hover:border-brand">
                    {services[key]!.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <MethodologyNote title={r.methodologyTitle} paragraphs={r.methodology} />
        <p className="text-sm leading-relaxed text-fg-subtle">{r.disclaimer}</p>
        <ToolActions
          title={ui.actionsTitle}
          labels={ui}
          summaryText={summaryText}
          fileName="ai-solution.txt"
          shareUrl={() => `${window.location.origin}${window.location.pathname}?s=${encodeSolution(solution)}`}
          onExport={(format) => track("export_requested", { format })}
        />
        <ToolLeadCapture
          title={content.leadCapture.title}
          text={content.leadCapture.text}
          primary={{ href: contactHref, label: content.leadCapture.cta }}
          secondary={libraryHref ? { href: libraryHref, label: content.leadCapture.secondary } : undefined}
        />
        <div className="print:hidden">
          <Button variant="ghost" onClick={restart}>
            {ui.restart}
          </Button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------------------- steps

  const step = STEPS[flow.step];
  const errors = new Set(flow.errors);
  const e = content.errors;
  const suggested = solution.workflow ? WORKFLOW_DEFAULTS[solution.workflow] : null;
  const suggestedBadge = <span className="badge badge-accent">{content.suggested}</span>;
  const minimum = minimumApproval(solution);
  const allowed = allowedApprovals(solution);
  const heading = step === "review" ? { title: content.reviewStep, description: content.reviewDescription } : content.steps[step];

  return (
    <div className="grid gap-6">
      <Alert tone="info" role="note">
        {content.designNotice}
      </Alert>
      <form ref={formRef} onSubmit={onSubmit} noValidate className="tool-frame grid min-w-0 gap-8 p-5 sm:p-8" data-testid="solution-form" aria-labelledby="solution-step-title">
        <StepProgress
          steps={[...SOLUTION_STEPS.map((s) => content.steps[s].title), content.reviewStep, content.roadmapStep]}
          current={flow.step}
          label={ui.progress}
          stepOf={ui.stepOf}
        />
        <div key={step} className="step-enter grid gap-8 [&>*]:min-w-0">
          <div>
            <h2 id="solution-step-title" ref={stepHeadingRef} tabIndex={-1} className="t-h3-lg scroll-mt-28 outline-none">
              {heading.title}
            </h2>
            <p className="mt-1.5 text-fg-muted">{heading.description}</p>
          </div>
          {flow.errors.length > 0 && (
            <Alert tone="error" role="alert">
              {e.summary}
            </Alert>
          )}

          {step === "objective" && (
            <CardGroup id="solution-objective" legend={content.steps.objective.title} error={errors.has("objective") ? e.objective : undefined}>
              {OBJECTIVES.map((objective) => (
                <SelectCard
                  key={objective}
                  type="radio"
                  name="solution-objective"
                  value={objective}
                  checked={solution.objective === objective}
                  onChange={() => update({ objective }, ["objective"])}
                  title={content.objectives[objective].title}
                  text={content.objectives[objective].text}
                />
              ))}
            </CardGroup>
          )}

          {step === "workflow" && (
            <CardGroup id="solution-workflow" legend={content.steps.workflow.title} error={errors.has("workflow") ? e.workflow : undefined}>
              {SOLUTION_WORKFLOWS.map((workflow) => (
                <SelectCard
                  key={workflow}
                  type="radio"
                  name="solution-workflow"
                  value={workflow}
                  checked={solution.workflow === workflow}
                  onChange={() => chooseWorkflow(workflow)}
                  title={team.result.workflows[workflow].title}
                  text={`${team.result.workflows[workflow].trigger} → ${team.result.workflows[workflow].outcome}`}
                />
              ))}
            </CardGroup>
          )}

          {step === "capabilities" && (
            <CardGroup id="solution-capabilities" legend={content.steps.capabilities.title} error={errors.has("capabilities") ? e.capabilities : undefined}>
              {CAPABILITIES.map((capability: Capability) => (
                <SelectCard
                  key={capability}
                  type="checkbox"
                  name="solution-capabilities"
                  value={capability}
                  checked={solution.capabilities.includes(capability)}
                  onChange={(on) => update({ capabilities: toggle(CAPABILITIES, solution.capabilities, capability, on) }, ["capabilities"])}
                  title={content.capabilities[capability].title}
                  text={content.capabilities[capability].text}
                  badge={suggested?.capabilities.includes(capability) ? suggestedBadge : undefined}
                />
              ))}
            </CardGroup>
          )}

          {step === "integrations" && (
            <CardGroup
              id="solution-integrations"
              legend={content.steps.integrations.title}
              hint={
                <Alert tone="warning" role="note" className="mb-4">
                  {content.integrationsNote}
                </Alert>
              }
            >
              {INTEGRATION_CATEGORIES.map((category) => (
                <SelectCard
                  key={category}
                  type="checkbox"
                  name="solution-integrations"
                  value={category}
                  checked={solution.integrations.includes(category)}
                  onChange={(on) => update({ integrations: toggle(INTEGRATION_CATEGORIES, solution.integrations, category, on) })}
                  title={library.categories[category].title}
                  text={library.categories[category].text}
                  badge={suggested?.integrations.includes(category) ? suggestedBadge : undefined}
                />
              ))}
            </CardGroup>
          )}
          {step === "integrations" && solution.integrations.length === 0 && <p className="-mt-4 text-sm text-fg-muted">{content.noIntegrations}</p>}

          {step === "security" && (
            <div className="grid gap-8">
              <CardGroup
                id="solution-sensitivity"
                legend={content.security.sensitivity.label}
                error={errors.has("sensitivity") ? e.sensitivity : undefined}
              >
                {SENSITIVITIES.map((sensitivity) => (
                  <SelectCard
                    key={sensitivity}
                    type="radio"
                    name="solution-sensitivity"
                    value={sensitivity}
                    checked={solution.sensitivity === sensitivity}
                    onChange={() => update({ sensitivity }, ["sensitivity"])}
                    title={content.security.sensitivity.options[sensitivity].title}
                    text={content.security.sensitivity.options[sensitivity].text}
                  />
                ))}
              </CardGroup>
              <CardGroup
                id="solution-approval"
                legend={content.security.approval.label}
                error={errors.has("approval") ? e.approval : undefined}
                hint={
                  <div id="solution-approval-minimum" className="mb-4 text-sm text-fg-muted">
                    <p className="font-medium text-fg-secondary">{fill(content.approvalMinimum, { checkpoint: checkpointName(minimum.checkpoint) })}</p>
                    <ul className="mt-1.5 grid gap-1">
                      {[...new Set(minimum.reasons)].map((reason) => (
                        <li key={reason}>{content.security.approvalReasons[reason]}</li>
                      ))}
                    </ul>
                  </div>
                }
              >
                {CHECKPOINTS.map((checkpoint) => {
                  const disabled = !allowed.includes(checkpoint);
                  return (
                    <SelectCard
                      key={checkpoint}
                      type="radio"
                      name="solution-approval"
                      value={checkpoint}
                      checked={solution.approval === checkpoint}
                      disabled={disabled}
                      describedBy="solution-approval-minimum"
                      onChange={() => update({ approval: checkpoint }, ["approval"])}
                      title={team.checkpoints[checkpoint].title}
                      text={team.checkpoints[checkpoint].text}
                      badge={disabled ? <span className="badge">{content.approvalBelow}</span> : undefined}
                    />
                  );
                })}
              </CardGroup>
              <PillGroup
                id="solution-deployment"
                legend={content.security.deployment.label}
                options={DEPLOYMENTS.map((d) => ({ value: d, label: team.teamStep.deployment.options[d].title }))}
                value={solution.deployment}
                onChange={(deployment) => update({ deployment }, ["deployment"])}
                error={errors.has("deployment") ? e.deployment : undefined}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <SelectCard
                  type="checkbox"
                  name="solution-residency"
                  value="residency"
                  checked={solution.residency}
                  onChange={(residency) => update({ residency })}
                  title={content.security.residency.label}
                  text={content.security.residency.hint}
                />
                <SelectCard
                  type="checkbox"
                  name="solution-redaction"
                  value="redaction"
                  checked={solution.redaction}
                  disabled={redactionRequired(solution)}
                  onChange={(redaction) => update({ redaction })}
                  title={content.security.redaction.label}
                  text={content.security.redaction.hint}
                  badge={redactionRequired(solution) ? <span className="badge badge-accent">{content.security.redaction.forced}</span> : undefined}
                />
              </div>
            </div>
          )}

          {step === "review" && <SolutionDiagram id="solution-review-diagram" components={architecture(solution)} describe={describe} labels={diagramLabels} titleHidden />}
        </div>
        <StepNav isFirst={flow.isFirst} isLast={flow.isLast} labels={{ ...ui, finish: content.generate }} onBack={flow.back} />
      </form>
      <p className="text-sm text-fg-subtle">{ui.privacy}</p>
    </div>
  );
}
