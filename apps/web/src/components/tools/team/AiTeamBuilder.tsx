"use client";

import { useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AgentCard } from "@/components/tools/team/AgentCard";
import { TeamArchitecture } from "@/components/tools/team/TeamArchitecture";
import { PillGroup, SelectCard, fill } from "@/components/tools/team/TeamControls";
import { TeamCosts } from "@/components/tools/team/TeamCosts";
import { TeamExport } from "@/components/tools/team/TeamExport";
import { TeamPlanDetails } from "@/components/tools/team/TeamPlanDetails";
import { TeamResult, type TeamResultData } from "@/components/tools/team/TeamResult";
import { ToolActions } from "@/components/tools/ToolActions";
import { ChoiceQuestion, StepNav, StepProgress, ToolLeadCapture, ToolState } from "@/components/tools/ToolUi";
import { Alert, Button, cx } from "@/components/ui/primitives";
import type { teamTool } from "@/content/bg/tool-team";
import type { tools } from "@/content/bg/tools";
import type { ServiceKey } from "@/content/types";
import type { Locale } from "@/i18n/config";
import { type ToolEvent, trackToolEvent } from "@/lib/analytics";
import {
  AGENTS,
  AGENT_KEYS,
  type AgentConfig,
  type AgentKey,
  type ArchitectureNode,
  type BusinessContext,
  CHALLENGES,
  COMPANY_SIZES,
  DEPARTMENTS,
  DEPLOYMENTS,
  type Department,
  INDUSTRIES,
  OPERATIONS,
  type RecommendationReason,
  type TeamConfig,
  VOLUMES,
  type Volume,
  addedAsDependency,
  agentConfigs,
  allowedCheckpoints,
  buildArchitecture,
  CHECKPOINTS,
  complexity,
  decodeTeam,
  defaultAgentConfig,
  encodeTeam,
  minimumCheckpoint,
  normaliseAgentConfig,
  prerequisites,
  recommendAgents,
  relatedServices,
  removeAgent,
  requiredBy,
  risks,
  rolloutPlan,
  selectedAgents,
  selectionIssues,
  suggestedWorkflows,
  teamIntegrations,
  teamSuggestions,
} from "@/lib/ai-team";
import { type ApiFailure, type Overrides, type TeamMeta, type TeamPlan, estimateTeam, fetchTeamMeta } from "@/lib/team-api";
import { useStepFlow } from "@/lib/use-step-flow";

type Content = typeof teamTool;
type Ui = (typeof tools)["ui"];
type ServiceLinks = Partial<Record<ServiceKey, { href: string; label: string }>>;

const STEPS = ["context", "departments", "agents", "team", "architecture"] as const;
const CONTEXT_FIELDS = ["industry", "size", "leadDepartment", "challenge", "volume"] as const;
const CUSTOM_NAME_MAX = 60;
const EMPTY: TeamConfig = { context: {}, departments: [], chosen: [], agents: {} };

export function AiTeamBuilder({
  content,
  ui,
  services,
  contactHref,
  advisorHref,
  privacyHref,
  locale,
  initialConfig,
  initialOverrides,
  initialNotice,
}: {
  content: Content;
  ui: Ui;
  services: ServiceLinks;
  contactHref: string;
  advisorHref?: string;
  privacyHref: string;
  locale: Locale;
  /** A configuration loaded from a saved link (?c=); takes precedence over a share code (?t=). */
  initialConfig?: TeamConfig | null;
  initialOverrides?: Overrides;
  initialNotice?: string;
}) {
  // A shared configuration (?t=<code>) is read during render; the page wraps this tool in <Suspense>.
  const code = useSearchParams().get("t");
  const shared = initialConfig ?? decodeTeam(code);
  const [config, setConfig] = useState<TeamConfig>(() => shared ?? EMPTY);
  const [restored, setRestored] = useState(() => shared !== null);
  const [overrides, setOverrides] = useState<Overrides>(() => initialOverrides ?? {});
  const [meta, setMeta] = useState<TeamMeta | null>(null);
  const [retry, setRetry] = useState(0);
  const [planState, setPlanState] = useState<{ key: string; plan?: TeamPlan; failure?: ApiFailure } | null>(null);
  const [lastPlan, setLastPlan] = useState<TeamPlan | null>(null);
  const [customName, setCustomName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const resultHeadingRef = useRef<HTMLHeadingElement>(null);
  const track = (name: ToolEvent["name"], extra: Partial<ToolEvent> = {}) => trackToolEvent({ name, tool: "team", locale, ...extra });

  const selected = useMemo(() => selectedAgents(config), [config]);
  const configs = useMemo(() => agentConfigs(config), [config]);

  const validate = (step: number): string[] => {
    switch (STEPS[step]) {
      case "context":
        return CONTEXT_FIELDS.filter((field) => !config.context[field]);
      case "departments": {
        const errors: string[] = [];
        if (config.departments.length === 0) errors.push("departments");
        if (config.departments.includes("custom") && (!customName.trim() || customName.trim().length > CUSTOM_NAME_MAX)) errors.push("customName");
        return errors;
      }
      case "agents":
        return selectionIssues(selected).length > 0 ? ["agents"] : [];
      case "team":
        return [!config.deployment && "deployment", !config.operations && "operations"].filter(Boolean) as string[];
      default:
        return [];
    }
  };

  const flow = useStepFlow({
    steps: STEPS.length,
    validate,
    onStart: () => track("tool_started"),
    onStepComplete: (step) => track("step_completed", { step: step + 1, totalSteps: STEPS.length }),
    initialComplete: restored,
  });

  const complexityNow = useMemo(() => complexity(config), [config]);
  const result: TeamResultData | null = useMemo(() => {
    if (!flow.complete) return null;
    return {
      agents: selected,
      configs,
      integrations: teamIntegrations(configs),
      complexity: complexityNow,
      risks: risks(config),
      prerequisites: prerequisites(config),
      workflows: suggestedWorkflows(config),
      rollout: rolloutPlan(config),
      services: relatedServices(config),
      architecture: buildArchitecture(config),
    };
  }, [flow.complete, selected, configs, complexityNow, config]);

  // The plan (security, data flows, costs) comes from the API once the result is shown.
  const planKey = JSON.stringify([flow.complete, config, overrides, locale, retry]);
  useEffect(() => {
    if (!flow.complete) return;
    let active = true;
    estimateTeam(config, locale, overrides).then((response) => {
      if (!active) return;
      setPlanState(response.ok ? { key: planKey, plan: response.data } : { key: planKey, failure: response });
      if (response.ok) setLastPlan(response.data);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- planKey covers config, overrides, locale and retries
  }, [planKey]);

  useEffect(() => {
    if (!flow.complete || meta) return;
    let active = true;
    fetchTeamMeta().then((value) => active && setMeta(value));
    return () => {
      active = false;
    };
  }, [flow.complete, meta]);

  useEffect(() => {
    track("tool_opened");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    if (!result) return;
    track("tool_completed", { result: result.complexity.band });
    resultHeadingRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per completed result
  }, [flow.complete]);

  // ------------------------------------------------------------------------------- updates

  function updateContext<K extends keyof BusinessContext>(field: K, value: BusinessContext[K]) {
    flow.touch();
    flow.clearError(field);
    setConfig((current) => {
      const context = { ...current.context, [field]: value };
      let departments = current.departments;
      if (field === "leadDepartment" && value) {
        // The lead department is always in scope; it replaces the previous lead.
        const rest = departments.filter((d) => d !== current.context.leadDepartment);
        departments = DEPARTMENTS.filter((d) => d === value || rest.includes(d));
      }
      return { ...current, context, departments };
    });
  }

  function toggleDepartment(department: Department, checked: boolean) {
    flow.clearError("departments");
    setConfig((current) => ({
      ...current,
      departments: DEPARTMENTS.filter((d) => (d === department ? checked : current.departments.includes(d))),
    }));
  }

  function toggleAgent(agent: AgentKey) {
    flow.touch();
    flow.clearError("agents");
    setConfig((current) => {
      const team = selectedAgents(current);
      if (team.includes(agent)) {
        if (removeAgent(team, agent) === team) return current;
        return { ...current, chosen: current.chosen.filter((a) => a !== agent) };
      }
      return { ...current, chosen: AGENT_KEYS.filter((a) => a === agent || current.chosen.includes(a)) };
    });
  }

  function updateAgent(agent: AgentKey, patch: Partial<AgentConfig>) {
    setConfig((current) => {
      const base = current.agents[agent] ?? defaultAgentConfig(agent, current.context);
      return { ...current, agents: { ...current.agents, [agent]: normaliseAgentConfig(agent, { ...base, ...patch }) } };
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (flow.next()) {
      requestAnimationFrame(() => stepHeadingRef.current?.focus());
    } else {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>("[aria-invalid='true'] input:not(:disabled), [aria-invalid='true']:is(input, select)")?.focus(),
      );
    }
  }

  function restart() {
    setConfig(EMPTY);
    setOverrides({});
    setPlanState(null);
    setLastPlan(null);
    setCustomName("");
    setRestored(false);
    flow.restart();
    window.history.replaceState(null, "", window.location.pathname);
  }

  // ------------------------------------------------------------------------------- labels

  const agentName = (agent: AgentKey) => content.agents[agent].name;
  const departmentName = (d: Department) => (d === "custom" && customName.trim() ? customName.trim() : content.departments.options[d].title);
  const reasonText = (reason: RecommendationReason) => {
    const t = content.agentsStep.reasons;
    if (reason.kind === "challenge") return fill(t.challenge, { challenge: content.context.challenge.options[reason.challenge] });
    if (reason.kind === "department") return fill(t.department, { department: departmentName(reason.department) });
    return t[reason.kind];
  };
  const volumeLabel = (v: Volume) => content.context.volume.options[v];

  const describe = useCallback(
    (node: ArchitectureNode): { label: string; sub?: string; text?: string } => {
      const a = content.architecture;
      switch (node.kind) {
        case "team":
          return { label: a.nodes.team };
        case "customers":
          return { label: a.nodes.customers };
        case "coordinator":
          return { label: a.nodes.coordinator, text: content.agents.workflow_coordinator.purpose };
        case "router":
          return { label: a.nodes.router, text: a.routerNote };
        case "supervisor":
          return { label: a.nodes.supervisor, text: content.agents.approval_supervisor.purpose };
        case "agent":
          return { label: content.agents[node.agent].name, text: content.agents[node.agent].short };
        case "approval":
          return {
            label: fill(a.nodes.approval, { agent: content.agents[node.agent].name }),
            sub: content.checkpoints[node.checkpoint].title,
            text: content.checkpoints[node.checkpoint].text,
          };
        default:
          return { label: content.integrations[node.integration] };
      }
    },
    [content],
  );

  // ------------------------------------------------------------------------------- results

  if (result) {
    const currentPlan = planState?.key === planKey ? planState.plan : undefined;
    const planStatus = planState?.key !== planKey ? "loading" : planState.plan ? "ready" : "error";
    return (
      <div className="grid gap-12">
        {restored && <ToolState kind="success" title={initialNotice ?? ui.linkRestored} />}
        <TeamResult
          content={content}
          data={result}
          headingRef={resultHeadingRef}
          serviceLinks={services}
          describe={describe}
          volumeLabel={volumeLabel}
          deploymentLabel={config.deployment ? content.teamStep.deployment.options[config.deployment].title : ""}
        />
        <TeamPlanDetails content={content} plan={currentPlan ?? null} agents={selected} configs={configs} />
        <TeamCosts
          content={content}
          locale={locale}
          estimate={lastPlan?.estimate ?? null}
          status={planStatus}
          failure={planState?.failure}
          meta={meta}
          overrides={overrides}
          integrationName={(key) => content.integrations[key as keyof Content["integrations"]] ?? key}
          complexityName={(key) => content.complexity[key]}
          onApply={setOverrides}
          onRetry={() => setRetry((n) => n + 1)}
        />
        <TeamExport
          content={content}
          config={config}
          overrides={overrides}
          locale={locale}
          meta={meta}
          privacyHref={privacyHref}
          onExport={(format) => track("export_requested", { format })}
        />
        <ToolActions
          title={ui.actionsTitle}
          labels={ui}
          shareUrl={() => `${window.location.origin}${window.location.pathname}?t=${encodeTeam(config)}`}
          onExport={(format) => track("export_requested", { format })}
        />
        <ToolLeadCapture
          title={content.leadCapture.title}
          text={content.leadCapture.text}
          primary={{ href: contactHref, label: content.leadCapture.cta }}
          secondary={advisorHref ? { href: advisorHref, label: content.leadCapture.secondary } : undefined}
        />
        <p className="text-sm leading-relaxed text-fg-subtle">{content.result.noteLocal}</p>
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
  const recommendations = recommendAgents(config.context, config.departments);
  const recommended = recommendations.map((r) => r.agent).filter((a) => AGENTS[a].role === "task");
  const suggestions = teamSuggestions(selected);
  const reasonsFor = (agent: AgentKey) =>
    [...recommendations, ...suggestions].filter((r) => r.agent === agent).flatMap((r) => r.reasons.map(reasonText));
  const dependencyOf = (agent: AgentKey) => requiredBy(selected, agent).map(agentName);
  const autoAdded = addedAsDependency(selected, config.chosen);
  const card = (agent: AgentKey) => (
    <AgentCard
      key={agent}
      agent={agent}
      content={content}
      selected={selected.includes(agent)}
      reasons={reasonsFor(agent)}
      requiredBy={dependencyOf(agent)}
      addedFor={autoAdded.includes(agent) ? dependencyOf(agent) : []}
      onToggle={toggleAgent}
    />
  );
  const issues = selectionIssues(selected);
  const architecture = step === "architecture" ? buildArchitecture(config) : null;

  return (
    // The architecture step uses the full width; the summary moves below it.
    <div className={cx("grid gap-8", step !== "architecture" && "lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start")}>
      <form
        ref={formRef}
        onSubmit={onSubmit}
        noValidate
        className="tool-frame grid min-w-0 gap-8 p-5 sm:p-8"
        data-testid="team-form"
        aria-labelledby="team-step-title"
      >
        <StepProgress
          steps={[...STEPS.map((s) => content.steps[s].title), content.stepResults]}
          current={flow.step}
          label={ui.progress}
          stepOf={ui.stepOf}
        />
        <div key={step} className="step-enter grid gap-8">
          <div>
            <h2 id="team-step-title" ref={stepHeadingRef} tabIndex={-1} className="t-h3-lg scroll-mt-28 outline-none">
              {content.steps[step].title}
            </h2>
            <p className="mt-1.5 text-fg-muted">{content.steps[step].description}</p>
          </div>
          {flow.errors.length > 0 && (
            <Alert tone="error" role="alert">
              {step === "agents" ? e.agents : e.summary}
            </Alert>
          )}

          {step === "context" && (
            <div className="grid gap-8">
              <PillGroup
                id="team-industry"
                legend={content.context.industry.label}
                options={INDUSTRIES.map((v) => ({ value: v, label: content.context.industry.options[v] }))}
                value={config.context.industry}
                onChange={(v) => updateContext("industry", v)}
                error={errors.has("industry") ? e.required : undefined}
              />
              <PillGroup
                id="team-size"
                legend={content.context.size.label}
                options={COMPANY_SIZES.map((v) => ({ value: v, label: content.context.size.options[v] }))}
                value={config.context.size}
                onChange={(v) => updateContext("size", v)}
                error={errors.has("size") ? e.required : undefined}
              />
              <PillGroup
                id="team-lead"
                legend={content.context.leadDepartment.label}
                options={DEPARTMENTS.map((v) => ({ value: v, label: content.departments.options[v].title }))}
                value={config.context.leadDepartment}
                onChange={(v) => updateContext("leadDepartment", v)}
                error={errors.has("leadDepartment") ? e.required : undefined}
              />
              <ChoiceQuestion
                id="team-challenge"
                label={content.context.challenge.label}
                options={CHALLENGES.map((c) => content.context.challenge.options[c])}
                value={config.context.challenge ? CHALLENGES.indexOf(config.context.challenge) : undefined}
                onChange={(index) => updateContext("challenge", CHALLENGES[index])}
                error={errors.has("challenge") ? e.choose : undefined}
              />
              <PillGroup
                id="team-volume"
                legend={content.context.volume.label}
                hint={content.context.volume.hint}
                options={VOLUMES.map((v) => ({ value: v, label: volumeLabel(v) }))}
                value={config.context.volume}
                onChange={(v) => updateContext("volume", v)}
                error={errors.has("volume") ? e.required : undefined}
              />
            </div>
          )}

          {step === "departments" && (
            <fieldset aria-describedby="team-departments-hint" aria-invalid={errors.has("departments") || undefined}>
              <legend className="field-label mb-1 text-base">{content.departments.label}</legend>
              <p id="team-departments-hint" className="mb-4 text-sm text-fg-muted">
                {content.departments.hint}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {DEPARTMENTS.map((department) => {
                  const isLead = config.context.leadDepartment === department;
                  return (
                    <SelectCard
                      key={department}
                      type="checkbox"
                      name="departments"
                      value={department}
                      checked={config.departments.includes(department)}
                      disabled={isLead}
                      onChange={(checked) => toggleDepartment(department, checked)}
                      title={content.departments.options[department].title}
                      text={content.departments.options[department].text}
                      badge={isLead ? <span className="badge badge-accent">{content.departments.lead}</span> : undefined}
                    />
                  );
                })}
              </div>
              {errors.has("departments") && <p className="field-error">{e.departments}</p>}
              {config.departments.includes("custom") && (
                <div className="mt-5 max-w-md">
                  <label htmlFor="team-custom-name" className="field-label">
                    {content.departments.customLabel}
                  </label>
                  <input
                    id="team-custom-name"
                    className="field"
                    maxLength={CUSTOM_NAME_MAX}
                    autoComplete="off"
                    value={customName}
                    aria-invalid={errors.has("customName") || undefined}
                    aria-describedby={errors.has("customName") ? "team-custom-name-error" : "team-custom-name-hint"}
                    onChange={(event) => {
                      setCustomName(event.target.value);
                      flow.clearError("customName");
                    }}
                  />
                  {errors.has("customName") ? (
                    <p id="team-custom-name-error" className="field-error">
                      {e.customName}
                    </p>
                  ) : (
                    <p id="team-custom-name-hint" className="field-hint">
                      {content.departments.customHint}
                    </p>
                  )}
                </div>
              )}
            </fieldset>
          )}

          {step === "agents" && (
            <div className="grid gap-10">
              {issues.length > 0 && selected.length > 0 && (
                <Alert tone="warning" role="status">
                  {issues
                    .map((issue) =>
                      issue.kind === "no_task_agent"
                        ? content.agentsStep.issues.no_task_agent
                        : fill(content.agentsStep.issues.coordinator_needs_agents, { have: issue.have, need: issue.need }),
                    )
                    .join(" ")}
                </Alert>
              )}
              {[
                { id: "recommended", title: content.agentsStep.recommendedTitle, agents: recommended },
                {
                  id: "other",
                  title: content.agentsStep.otherTitle,
                  agents: AGENT_KEYS.filter((a) => AGENTS[a].role === "task" && !recommended.includes(a)),
                },
                { id: "team", title: content.agentsStep.teamTitle, agents: AGENT_KEYS.filter((a) => AGENTS[a].role !== "task") },
              ]
                .filter((group) => group.agents.length > 0)
                .map((group) => (
                  <section key={group.id} aria-labelledby={`team-agents-${group.id}`}>
                    <h3 id={`team-agents-${group.id}`} className="t-label">
                      {group.title}
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2" data-testid={`agents-${group.id}`}>
                      {group.agents.map(card)}
                    </div>
                  </section>
                ))}
            </div>
          )}

          {step === "team" && (
            <div className="grid gap-8">
              {selected.map((agent) => (
                <AgentSettings
                  key={agent}
                  agent={agent}
                  content={content}
                  config={configs[agent]}
                  volumeLabel={volumeLabel}
                  onChange={(patch) => updateAgent(agent, patch)}
                />
              ))}
              <fieldset aria-invalid={errors.has("deployment") || undefined} id="team-deployment">
                <legend className="field-label mb-3 text-base">{content.teamStep.deployment.label}</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  {DEPLOYMENTS.map((value) => (
                    <SelectCard
                      key={value}
                      type="radio"
                      name="deployment"
                      value={value}
                      checked={config.deployment === value}
                      onChange={() => {
                        flow.clearError("deployment");
                        setConfig((c) => ({ ...c, deployment: value }));
                      }}
                      title={content.teamStep.deployment.options[value].title}
                      text={content.teamStep.deployment.options[value].text}
                    />
                  ))}
                </div>
                {errors.has("deployment") && <p className="field-error">{e.choose}</p>}
              </fieldset>
              <fieldset aria-invalid={errors.has("operations") || undefined} id="team-operations">
                <legend className="field-label mb-3 text-base">{content.teamStep.operations.label}</legend>
                <div className="grid gap-3 md:grid-cols-3">
                  {OPERATIONS.map((value) => (
                    <SelectCard
                      key={value}
                      type="radio"
                      name="operations"
                      value={value}
                      checked={config.operations === value}
                      onChange={() => {
                        flow.clearError("operations");
                        setConfig((c) => ({ ...c, operations: value }));
                      }}
                      title={content.teamStep.operations.options[value].title}
                      text={content.teamStep.operations.options[value].text}
                    />
                  ))}
                </div>
                {errors.has("operations") && <p className="field-error">{e.choose}</p>}
              </fieldset>
            </div>
          )}

          {step === "architecture" && architecture && (
            <TeamArchitecture content={content} nodes={architecture.nodes} edges={architecture.edges} describe={describe} />
          )}
        </div>
        <StepNav isFirst={flow.isFirst} isLast={flow.isLast} labels={ui} onBack={flow.back} />
      </form>

      <TeamSummary
        content={content}
        agents={selected}
        departments={config.departments.map(departmentName)}
        integrations={teamIntegrations(configs).length}
        approvals={selected.filter((a) => configs[a].checkpoint === "before_external" || configs[a].checkpoint === "every_action").length}
        complexityBand={selected.length > 0 ? complexityNow.band : null}
      />
    </div>
  );
}

function AgentSettings({
  agent,
  content,
  config,
  volumeLabel,
  onChange,
}: {
  agent: AgentKey;
  content: Content;
  config: AgentConfig;
  volumeLabel: (v: Volume) => string;
  onChange: (patch: Partial<AgentConfig>) => void;
}) {
  const def = AGENTS[agent];
  const t = content.teamStep;
  const allowed = allowedCheckpoints(agent);
  const minimum = minimumCheckpoint(agent);
  const available = [...def.integrations, ...def.optionalIntegrations];
  return (
    <section aria-labelledby={`settings-${agent}`} className="card grid gap-5 p-5 sm:p-6" data-testid={`settings-${agent}`}>
      <h3 id={`settings-${agent}`} className="t-h3">
        {content.agents[agent].name}
      </h3>
      <div className="grid gap-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div>
          <label htmlFor={`volume-${agent}`} className="field-label">
            {t.volume}
          </label>
          <select id={`volume-${agent}`} className="field" value={config.volume} onChange={(event) => onChange({ volume: event.target.value as Volume })}>
            {VOLUMES.map((v) => (
              <option key={v} value={v}>
                {volumeLabel(v)}
              </option>
            ))}
          </select>
        </div>
        {available.length > 0 && (
          <fieldset>
            <legend className="field-label">{t.integrations}</legend>
            <div className="flex flex-wrap gap-2">
              {available.map((integration) => {
                const required = def.integrations.includes(integration);
                const checked = config.integrations.includes(integration);
                return (
                  <label
                    key={integration}
                    className={cx(
                      "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                      checked ? "border-brand bg-brand/[0.1] text-fg" : "border-line-default text-fg-secondary",
                      required ? "cursor-not-allowed" : "cursor-pointer hover:border-line-strong",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={checked}
                      disabled={required}
                      onChange={(event) =>
                        onChange({
                          integrations: event.target.checked
                            ? [...config.integrations, integration]
                            : config.integrations.filter((i) => i !== integration),
                        })
                      }
                    />
                    {content.integrations[integration]}
                    {required && <span className="text-xs text-fg-subtle">({t.required})</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>
      <fieldset aria-describedby={`checkpoint-${agent}-note`}>
        <legend className="field-label">{t.checkpoint}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHECKPOINTS.map((checkpoint) => (
            <SelectCard
              key={checkpoint}
              type="radio"
              name={`checkpoint-${agent}`}
              value={checkpoint}
              checked={config.checkpoint === checkpoint}
              disabled={!allowed.includes(checkpoint)}
              onChange={() => onChange({ checkpoint })}
              title={content.checkpoints[checkpoint].title}
              text={content.checkpoints[checkpoint].text}
            />
          ))}
        </div>
        <p id={`checkpoint-${agent}-note`} className="field-hint">
          {content.checkpointReasons[minimum.reason]} ({content.checkpoints[minimum.checkpoint].title})
        </p>
      </fieldset>
    </section>
  );
}

function TeamSummary({
  content,
  agents,
  departments,
  integrations,
  approvals,
  complexityBand,
}: {
  content: Content;
  agents: AgentKey[];
  departments: string[];
  integrations: number;
  approvals: number;
  complexityBand: "low" | "medium" | "high" | null;
}) {
  const t = content.summary;
  return (
    <aside aria-labelledby="team-summary-title" className="panel grid gap-4 p-5 lg:sticky lg:top-28" data-testid="team-summary">
      <h2 id="team-summary-title" className="t-label">
        {t.title}
      </h2>
      {agents.length === 0 ? (
        <p className="text-sm text-fg-muted">{t.empty}</p>
      ) : (
        <ul className="grid gap-1.5 text-sm" aria-live="polite">
          {agents.map((agent) => (
            <li key={agent} className="flex items-start gap-2 text-fg">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
              {content.agents[agent].name}
            </li>
          ))}
        </ul>
      )}
      <dl className="spec-list text-sm">
        <div>
          <dt>{t.departments}</dt>
          <dd>{departments.length > 0 ? departments.join(", ") : "—"}</dd>
        </div>
        <div>
          <dt>{t.integrations}</dt>
          <dd>{integrations}</dd>
        </div>
        <div>
          <dt>{t.approvals}</dt>
          <dd>{approvals}</dd>
        </div>
        <div>
          <dt>{t.complexity}</dt>
          <dd data-testid="summary-complexity">{complexityBand ? content.complexity[complexityBand] : "—"}</dd>
        </div>
      </dl>
    </aside>
  );
}
