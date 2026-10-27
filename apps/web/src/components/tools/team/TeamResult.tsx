import Link from "next/link";
import type { Ref } from "react";

import { AGENT_ICONS } from "@/components/tools/team/AgentCard";
import { TeamArchitecture } from "@/components/tools/team/TeamArchitecture";
import { fill } from "@/components/tools/team/TeamControls";
import { MethodologyNote } from "@/components/tools/ToolUi";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { teamTool } from "@/content/bg/tool-team";
import type { ServiceKey } from "@/content/types";
import {
  type AgentConfig,
  type AgentKey,
  type ArchitectureEdge,
  type ArchitectureNode,
  type ComplexityFactor,
  type Complexity,
  DATA_SOURCES,
  type Integration,
  type PrerequisiteKey,
  type RiskKey,
  type RolloutPhase,
  type WorkflowKey,
  type WorkflowStep,
} from "@/lib/ai-team";

type Content = typeof teamTool;

export interface TeamResultData {
  agents: AgentKey[];
  configs: Record<AgentKey, AgentConfig>;
  integrations: Integration[];
  complexity: { band: Complexity; points: number; factors: ComplexityFactor[] };
  risks: RiskKey[];
  prerequisites: PrerequisiteKey[];
  workflows: { key: WorkflowKey; steps: WorkflowStep[] }[];
  rollout: RolloutPhase[];
  services: ServiceKey[];
  architecture: { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] };
}

const BAND_BADGE: Record<Complexity, string> = { low: "badge-success", medium: "badge-accent", high: "badge-warning" };

/** The configured team as a plan: roles, workflows, integrations, complexity, risks and rollout. */
export function TeamResult({
  content,
  data,
  headingRef,
  serviceLinks,
  describe,
  volumeLabel,
  deploymentLabel,
}: {
  content: Content;
  data: TeamResultData;
  headingRef: Ref<HTMLHeadingElement>;
  serviceLinks: Partial<Record<ServiceKey, { href: string; label: string }>>;
  describe: (node: ArchitectureNode) => { label: string; sub?: string; text?: string };
  volumeLabel: (key: AgentConfig["volume"]) => string;
  deploymentLabel: string;
}) {
  const r = content.result;
  const name = (agent: AgentKey) => content.agents[agent].name;
  const usedBy = (integration: Integration) => data.agents.filter((a) => data.configs[a].integrations.includes(integration));
  const factorText = (factor: ComplexityFactor) => {
    switch (factor.kind) {
      case "agents":
      case "integrations":
        return fill(r.factors[factor.kind], { count: factor.count });
      case "volume":
        return fill(r.factors.volume, { volume: volumeLabel(factor.volume) });
      case "deployment":
        return fill(r.factors.deployment, { deployment: deploymentLabel });
      default:
        return r.factors[factor.kind];
    }
  };
  const stepLabel = (step: WorkflowStep, workflow: WorkflowKey) => {
    if (step.kind === "trigger") return r.workflows[workflow].trigger;
    if (step.kind === "outcome") return r.workflows[workflow].outcome;
    if (step.kind === "human") return fill(r.humanStep, { checkpoint: content.checkpoints[step.checkpoint].title });
    return name(step.agent);
  };

  return (
    <div className="grid gap-14" data-testid="team-result">
      <header className="grid gap-4">
        <h2 ref={headingRef} tabIndex={-1} className="t-h2 outline-none">
          {r.title}
        </h2>
        <p className="max-w-3xl leading-relaxed text-fg-muted">{r.lead}</p>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-fg-muted">{r.complexityLabel}:</span>
          <span className={cx("badge", BAND_BADGE[data.complexity.band])} data-testid="team-complexity">
            {content.complexity[data.complexity.band]}
          </span>
          <span className="text-fg-subtle">· {fill(content.agentsStep.selectedCount, { n: data.agents.length })}</span>
        </p>
      </header>

      <section aria-labelledby="team-roles-title">
        <h2 id="team-roles-title" className="t-h3-lg">
          {r.rolesTitle}
        </h2>
        <ul className="mt-6 grid gap-3 md:grid-cols-2" data-testid="team-roles">
          {data.agents.map((agent) => (
            <li key={agent} className="card p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default text-brand" aria-hidden="true">
                  <Icon name={AGENT_ICONS[agent]} className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <h3 className="t-h3">{name(agent)}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">{content.agents[agent].purpose}</p>
                </div>
              </div>
              <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-fg-subtle">{r.checkpointLabel}</dt>
                  <dd className="text-fg-secondary">{content.checkpoints[data.configs[agent].checkpoint].title}</dd>
                </div>
                <div>
                  <dt className="text-fg-subtle">{r.volumeLabel}</dt>
                  <dd className="text-fg-secondary">{volumeLabel(data.configs[agent].volume)}</dd>
                </div>
                {data.configs[agent].integrations.length > 0 && (
                  <div className="sm:col-span-2">
                    <dt className="text-fg-subtle">{content.teamStep.integrations}</dt>
                    <dd className="text-fg-secondary">{data.configs[agent].integrations.map((i) => content.integrations[i]).join(", ")}</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ul>
      </section>

      {data.workflows.length > 0 && (
        <section aria-labelledby="team-workflows-title">
          <h2 id="team-workflows-title" className="t-h3-lg">
            {r.workflowsTitle}
          </h2>
          <ul className="mt-6 grid gap-4" data-testid="team-workflows">
            {data.workflows.map((workflow) => (
              <li key={workflow.key} className="card p-5">
                <h3 className="t-h3">{r.workflows[workflow.key].title}</h3>
                <ol className="mt-4 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
                  {workflow.steps.map((step, index) => (
                    <li key={`${step.kind}-${index}`} className="flex items-center gap-2 md:contents">
                      {index > 0 && <Icon name="arrowRight" className="hidden h-4 w-4 shrink-0 text-fg-subtle md:block" aria-hidden="true" />}
                      <span
                        className={cx(
                          "inline-flex rounded-full border px-3 py-1.5 text-sm",
                          step.kind === "agent" && "border-brand/50 bg-brand/[0.07] text-fg",
                          step.kind === "human" && "border-dashed border-warning/60 text-warning",
                          (step.kind === "trigger" || step.kind === "outcome") && "border-line-default text-fg-secondary",
                        )}
                      >
                        {stepLabel(step, workflow.key)}
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="team-integrations-title">
        <h2 id="team-integrations-title" className="t-h3-lg">
          {r.integrationsTitle}
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {([
            ["data", r.dataSources, data.integrations.filter((i) => DATA_SOURCES.has(i))],
            ["systems", r.systems, data.integrations.filter((i) => !DATA_SOURCES.has(i))],
          ] as const).map(([key, title, list]) =>
            list.length > 0 ? (
              <div key={key} className="card p-5">
                <h3 className="t-h3">{title}</h3>
                <ul className="mt-3 grid gap-2.5 text-sm">
                  {list.map((integration) => (
                    <li key={integration}>
                      <span className="font-medium text-fg">{content.integrations[integration]}</span>
                      <span className="block text-fg-muted">{fill(r.usedBy, { agents: usedBy(integration).map(name).join(", ") })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      </section>

      <section aria-labelledby="team-architecture-result-title">
        <h2 id="team-architecture-result-title" className="t-h3-lg">
          {content.architecture.title}
        </h2>
        <div className="mt-6">
          <TeamArchitecture content={content} nodes={data.architecture.nodes} edges={data.architecture.edges} describe={describe} />
        </div>
      </section>

      <section aria-labelledby="team-complexity-title" className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <h2 id="team-complexity-title" className="t-h3-lg">
            {r.complexityTitle}
          </h2>
          <p className="mt-4 flex items-center gap-3">
            <span className={cx("badge text-base", BAND_BADGE[data.complexity.band])}>{content.complexity[data.complexity.band]}</span>
            <span className="font-mono text-sm text-fg-muted">{fill(r.pointsLabel, { points: data.complexity.points })}</span>
          </p>
          <p className="mt-3 text-sm text-fg-subtle">{r.bandsNote}</p>
        </div>
        <ul className="card grid gap-0 divide-y divide-line-subtle p-0" data-testid="team-complexity-factors">
          {data.complexity.factors.map((factor) => (
            <li key={factor.kind} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span className="text-fg-secondary">{factorText(factor)}</span>
              <span className="font-mono text-fg">+{factor.points}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="team-risks-title">
          <h2 id="team-risks-title" className="t-h3-lg">
            {r.risksTitle}
          </h2>
          <ul className="mt-6 grid gap-3" data-testid="team-risks">
            {data.risks.map((risk) => (
              <li key={risk} className="card flex gap-3 p-5">
                <Icon name="alert" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
                <div>
                  <h3 className="font-semibold text-fg">{r.risks[risk].title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-fg-muted">{r.risks[risk].text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="team-prereq-title">
          <h2 id="team-prereq-title" className="t-h3-lg">
            {r.prerequisitesTitle}
          </h2>
          <ul className="mt-6 grid gap-3" data-testid="team-prerequisites">
            {data.prerequisites.map((item) => (
              <li key={item} className="card flex gap-3 p-5">
                <Icon name="check" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-success" />
                <div>
                  <h3 className="font-semibold text-fg">{r.prerequisites[item].title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-fg-muted">{r.prerequisites[item].text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="team-rollout-title">
        <h2 id="team-rollout-title" className="t-h3-lg">
          {r.rolloutTitle}
        </h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3" data-testid="team-rollout">
          {data.rollout.map((phase, index) => (
            <li key={phase.key} className="min-w-0 border-t-2 border-brand/50 pt-4">
              <p className="t-index">
                {String(index + 1).padStart(2, "0")} · {r.phases[phase.key].title}
              </p>
              <p className="mt-2 text-[15px] leading-relaxed text-fg-secondary">{r.phases[phase.key].goal}</p>
              <ul className="mt-3 grid gap-1.5 text-sm">
                {phase.agents.map((agent) => (
                  <li key={agent} className="flex items-start gap-2 text-fg">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
                    {name(agent)}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-fg-muted">
                {fill(r.weeks, { min: phase.weeks[0], max: phase.weeks[1] })} ·{" "}
                {fill(r.phaseComplexity, { complexity: content.complexity[phase.complexity].toLowerCase() })}
              </p>
              <p className="mt-2 text-sm text-fg-subtle">{r.phases[phase.key].exit}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-fg-subtle" data-testid="team-effort-note">
          {r.effortNote}
        </p>
      </section>

      {data.services.some((s) => serviceLinks[s]) && (
        <section aria-labelledby="team-services-title">
          <h2 id="team-services-title" className="t-label">
            {r.servicesTitle}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {data.services
              .filter((s) => serviceLinks[s])
              .map((service) => (
                <li key={service}>
                  <Link href={serviceLinks[service]!.href} className="link">
                    {serviceLinks[service]!.label}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      <MethodologyNote title={r.methodologyTitle} paragraphs={[...r.methodology, r.disclaimer]} />
    </div>
  );
}

