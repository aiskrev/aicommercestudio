import { fill } from "@/components/tools/team/TeamControls";
import { Icon } from "@/components/ui/Icon";
import type { teamTool } from "@/content/bg/tool-team";
import { AGENTS, type AgentConfig, type AgentKey } from "@/lib/ai-team";
import type { DataFlow, TeamPlan } from "@/lib/team-api";

type Content = typeof teamTool;

/** Human approval points (from the configuration), then data flows and security (from the API plan). */
export function TeamPlanDetails({
  content,
  plan,
  agents,
  configs,
}: {
  content: Content;
  plan: TeamPlan | null;
  agents: AgentKey[];
  configs: Record<AgentKey, AgentConfig>;
}) {
  const name = (agent: string) => content.agents[agent as AgentKey]?.name ?? agent;
  const integration = (key: string) => content.integrations[key as keyof Content["integrations"]] ?? key;
  // The approval supervisor routes the approvals; the approval points belong to the task agents.
  const gated = agents.filter(
    (a) => AGENTS[a].role === "task" && (configs[a].checkpoint === "before_external" || configs[a].checkpoint === "every_action"),
  );
  const flowText = (flow: DataFlow) => {
    const t = content.dataFlows;
    if (flow.via === "orchestration") return fill(t.actOrchestration, { integration: integration(flow.integration) });
    if (flow.via === "supervisor") return fill(t.actSupervisor, { integration: integration(flow.integration) });
    if (flow.kind === "read") return fill(t.read, { agent: name(flow.agent ?? ""), integration: integration(flow.integration) });
    if (flow.approval) {
      return fill(t.actApproved, {
        agent: name(flow.agent ?? ""),
        integration: integration(flow.integration),
        checkpoint: content.checkpoints[flow.approval as keyof Content["checkpoints"]].title,
      });
    }
    return fill(t.act, { agent: name(flow.agent ?? ""), integration: integration(flow.integration) });
  };

  return (
    <div className="grid gap-10">
      <section aria-labelledby="team-hitl-title">
        <h2 id="team-hitl-title" className="t-h3-lg">
          {content.hitlTitle}
        </h2>
        {gated.length > 0 ? (
          <ul className="mt-6 grid gap-3 md:grid-cols-2" data-testid="team-hitl">
            {gated.map((agent) => (
              <li key={agent} className="card flex gap-3 border-dashed border-warning/50 p-5">
                <Icon name="shield" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-warning" />
                <div>
                  <h3 className="font-semibold text-fg">{name(agent)}</h3>
                  <p className="mt-1 text-sm text-fg-muted">
                    <span className="text-warning">{content.checkpoints[configs[agent].checkpoint].title}.</span>{" "}
                    {content.checkpoints[configs[agent].checkpoint].text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-fg-muted">{content.hitlNone}</p>
        )}
      </section>

      {plan && (
        <>
          {plan.data_flows.length > 0 && (
            <section aria-labelledby="team-flows-title">
              <h2 id="team-flows-title" className="t-h3-lg">
                {content.dataFlows.title}
              </h2>
              <ul className="mt-6 grid gap-2 text-[15px] text-fg-secondary md:grid-cols-2" data-testid="team-data-flows">
                {plan.data_flows.map((flow, index) => (
                  <li key={`${flow.agent}-${flow.integration}-${flow.kind}-${index}`} className="flex items-start gap-2.5">
                    <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${flow.kind === "read" ? "bg-brand-2" : "bg-brand"}`} aria-hidden="true" />
                    {flowText(flow)}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="team-security-title">
            <h2 id="team-security-title" className="t-h3-lg">
              {content.security.title}
            </h2>
            <ul className="mt-6 grid gap-3 md:grid-cols-2" data-testid="team-security">
              {plan.security.map((key) => (
                <li key={key} className="card flex gap-3 p-5">
                  <Icon name="lock" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand" />
                  <div>
                    <h3 className="font-semibold text-fg">{content.security.items[key].title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-fg-muted">{content.security.items[key].text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
