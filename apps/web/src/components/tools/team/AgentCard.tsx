import { fill } from "@/components/tools/team/TeamControls";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { teamTool } from "@/content/bg/tool-team";
import { AGENTS, type AgentKey, minimumCheckpoint } from "@/lib/ai-team";

type Content = typeof teamTool;

export const AGENT_ICONS: Record<AgentKey, IconName> = {
  lead_qualification: "target",
  sales_research: "search",
  customer_support: "message",
  content_operations: "pen",
  document_processing: "fileText",
  knowledge_assistant: "layers",
  scheduling: "clock",
  reporting_insights: "chart",
  workflow_coordinator: "workflow",
  approval_supervisor: "shield",
};

const COMPLEXITY_BADGE = { low: "badge-success", medium: "badge-accent", high: "badge-warning" } as const;

/**
 * One configurable agent role. Selection is a native checkbox named after the agent; when other
 * selected agents depend on it, the checkbox is disabled and the reason is shown next to it.
 */
export function AgentCard({
  agent,
  content,
  selected,
  reasons,
  requiredBy,
  addedFor,
  onToggle,
}: {
  agent: AgentKey;
  content: Content;
  selected: boolean;
  /** Why it is recommended (already localized). */
  reasons: string[];
  /** Names of selected agents that need this one (locks it). */
  requiredBy: string[];
  /** Names of agents this one was added for automatically. */
  addedFor: string[];
  onToggle: (agent: AgentKey) => void;
}) {
  const def = AGENTS[agent];
  const text = content.agents[agent];
  const t = content.agentsStep;
  const locked = selected && requiredBy.length > 0;
  const noteId = `agent-${agent}-note`;
  const names = (keys: AgentKey[]) => keys.map((k) => content.agents[k].name).join(", ");
  const minimum = minimumCheckpoint(agent).checkpoint;

  return (
    <article
      data-agent={agent}
      data-selected={selected}
      className={cx(
        "card card-interactive flex min-w-0 flex-col p-5",
        selected && "border-brand/70 bg-brand/[0.06] shadow-[0_0_0_1px_var(--color-brand)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cx(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border transition-colors",
            selected ? "border-brand bg-brand text-surface-page" : "border-line-default bg-surface-page text-brand",
          )}
          aria-hidden="true"
        >
          <Icon name={selected ? "check" : AGENT_ICONS[agent]} className="h-5 w-5" />
        </span>
        <span className={cx("badge", COMPLEXITY_BADGE[def.complexity])}>
          {t.complexity}: {content.complexity[def.complexity]}
        </span>
      </div>

      <h3 className="t-h3 mt-4">{text.name}</h3>
      <p className="mt-1 text-[15px] leading-relaxed text-fg-muted">{text.short}</p>

      {reasons.length > 0 && (
        <ul className="mt-3 grid gap-1 text-sm text-brand-soft">
          {reasons.map((reason) => (
            <li key={reason} className="flex items-start gap-2">
              <Icon name="sparkles" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {reason}
            </li>
          ))}
        </ul>
      )}

      <details className="group mt-4 border-t border-line-subtle pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-fg-secondary [&::-webkit-details-marker]:hidden">
          {t.details}
          <Icon name="chevronDown" className="h-4 w-4 text-brand transition-transform group-open:rotate-180" />
        </summary>
        <dl className="spec-list mt-3 text-sm">
          <div>
            <dt>{t.purpose}</dt>
            <dd>{text.purpose}</dd>
          </div>
          <div>
            <dt>{t.inputs}</dt>
            <dd>{text.inputs.join(" · ")}</dd>
          </div>
          <div>
            <dt>{t.outputs}</dt>
            <dd>{text.outputs.join(" · ")}</dd>
          </div>
          <div>
            <dt>{t.integrations}</dt>
            <dd>
              {def.integrations.length > 0 ? def.integrations.map((i) => content.integrations[i]).join(", ") : t.noDependencies}
              {def.optionalIntegrations.length > 0 && (
                <span className="block text-fg-muted">
                  {t.optionalIntegrations}: {def.optionalIntegrations.map((i) => content.integrations[i]).join(", ")}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>{t.oversight}</dt>
            <dd>
              {text.oversight}
              <span className="block text-fg-muted">{content.checkpoints[minimum].title}</span>
            </dd>
          </div>
          <div>
            <dt>{t.sensitivity}</dt>
            <dd>
              {content.sensitivity[def.sensitivity]} — {text.sensitivityNote}
            </dd>
          </div>
          <div>
            <dt>{t.dependencies}</dt>
            <dd>
              {def.requires.length > 0 ? names(def.requires) : t.noDependencies}
              {def.pairsWith.length > 0 && (
                <span className="block text-fg-muted">
                  {t.worksWith}: {names(def.pairsWith)}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </details>

      <div className="mt-auto pt-4">
        <label
          className={cx(
            "flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-semibold transition-colors",
            "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
            locked ? "cursor-not-allowed" : "cursor-pointer",
            selected ? "border-brand bg-brand/[0.12] text-fg" : "border-line-default text-fg-secondary hover:border-brand/60 hover:text-fg",
          )}
        >
          <input
            type="checkbox"
            className="checkbox"
            checked={selected}
            disabled={locked}
            aria-label={text.name}
            aria-describedby={locked || addedFor.length > 0 ? noteId : undefined}
            onChange={() => onToggle(agent)}
          />
          <span aria-hidden="true" className="flex-1">
            {selected ? t.inTeam : t.add}
          </span>
          <Icon name={selected ? "check" : "arrowRight"} className="h-4 w-4 text-brand" />
        </label>
        {(locked || addedFor.length > 0) && (
          <p id={noteId} className="mt-2 text-xs leading-relaxed text-fg-muted">
            {locked ? fill(t.requiredBy, { agents: requiredBy.join(", ") }) : fill(t.addedFor, { agents: addedFor.join(", ") })}
          </p>
        )}
      </div>
    </article>
  );
}
