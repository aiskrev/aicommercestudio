import type { ReactNode, Ref } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Alert, Badge, CheckList, cx } from "@/components/ui/primitives";
import type { AdvisorContent } from "@/content/bg/advisor";
import type { AdvisorResponse, Level } from "@/lib/advisor";

const levelTone: Record<Level, string> = {
  low: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
  medium: "bg-amber-400/10 text-amber-200 ring-amber-400/30",
  high: "bg-rose-400/10 text-rose-200 ring-rose-400/30",
};

function Block({ id, icon, title, children }: { id: string; icon: IconName; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card p-6 sm:p-7">
      <h3 id={id} className="flex items-center gap-3 text-lg font-semibold text-white">
        <Icon name={icon} className="h-5 w-5 shrink-0 text-cyan-300" />
        {title}
      </h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", className)}>{children}</span>
  );
}

export function AdvisorResult({
  result,
  content,
  headingRef,
}: {
  result: AdvisorResponse;
  content: AdvisorContent;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { assessment: a } = result;
  const t = content.result;
  const l = content.labels;
  const demo = result.mode === "demo";
  const expires = result.expires_at ? new Date(result.expires_at).toLocaleDateString("bg-BG") : null;

  return (
    <div className="grid gap-6" data-testid="advisor-result" data-mode={result.mode}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 ref={headingRef} tabIndex={-1} className="t-h2 text-2xl outline-none sm:text-3xl">
          {demo ? t.demoTitle : t.title}
        </h2>
        <Badge accent={!demo} className={demo ? "border-amber-300/40 text-amber-200" : undefined}>
          {content.modeBadge[result.mode]}
        </Badge>
      </div>

      <Alert tone={demo ? "warning" : "info"} role="note" title={content.modeBadge[result.mode]}>
        <span data-testid="advisor-disclaimer">{result.disclaimer}</span>
      </Alert>

      {result.notices.length > 0 && (
        <Alert tone="info" role="note" title={t.notices}>
          <ul className="grid list-disc gap-1 pl-4">
            {result.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </Alert>
      )}

      <p className="text-sm text-slate-400">
        {result.stored && result.reference ? (
          <>
            {t.reference}: <strong className="font-mono text-white">{result.reference}</strong>
            {expires && (
              <>
                {" · "}
                {t.storedUntil} {expires}
              </>
            )}
          </>
        ) : (
          t.notStored
        )}
      </p>

      <Block id="advisor-summary" icon="clipboard" title={t.summary}>
        <p className="leading-relaxed text-slate-300">{a.problem_summary}</p>
      </Block>

      <Block id="advisor-opportunities" icon="sparkles" title={t.opportunities}>
        <ul className="grid gap-4 md:grid-cols-2">
          {a.opportunities.map((item) => (
            <li key={item.title} className="rounded-xl border border-white/[0.08] bg-ink-950/40 p-4">
              <p className="font-semibold text-white">{item.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Pill className="bg-cyan-400/10 text-cyan-200 ring-cyan-400/30">{l.approach[item.approach]}</Pill>
                <Pill className={levelTone[item.priority]}>{l.priority[item.priority]}</Pill>
              </div>
            </li>
          ))}
        </ul>
      </Block>

      <Block id="advisor-workflow" icon="workflow" title={t.workflow}>
        <ol className="grid gap-3">
          {a.proposed_workflow.map((step, index) => (
            <li key={`${index}-${step.title}`} className="flex gap-4">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-sm font-semibold text-cyan-200">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium text-white">
                  {step.title}
                  <Pill className="bg-white/5 text-slate-300 ring-white/15">{l.actor[step.actor]}</Pill>
                  {step.requires_human_approval && (
                    <Pill className="bg-amber-400/10 text-amber-200 ring-amber-400/30">{t.approvalRequired}</Pill>
                  )}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Block>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block id="advisor-integrations" icon="plug" title={t.integrations}>
          <ul className="grid gap-3">
            {a.integrations.map((item) => (
              <li key={item.system}>
                <p className="flex flex-wrap items-center gap-2 font-medium text-white">
                  {item.system}
                  <Pill className="bg-white/5 text-slate-300 ring-white/15">{l.access[item.access]}</Pill>
                </p>
                <p className="mt-1 text-sm text-slate-400">{item.purpose}</p>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="advisor-approvals" icon="shield" title={t.approvals}>
          <ul className="grid gap-3">
            {a.human_approvals.map((item) => (
              <li key={item.decision}>
                <p className="font-medium text-white">{item.decision}</p>
                <p className="mt-1 text-sm text-slate-400">{item.reason}</p>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block id="advisor-data" icon="lock" title={t.dataProtection}>
          <CheckList items={a.data_protection} />
        </Block>
        <Block id="advisor-risks" icon="alert" title={t.risks}>
          <ul className="grid gap-3">
            {a.risks.map((item) => (
              <li key={item.risk}>
                <p className="font-medium text-white">{item.risk}</p>
                <p className="mt-1 text-sm text-slate-400">
                  <span className="text-slate-300">{t.mitigation}:</span> {item.mitigation}
                </p>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      <Block id="advisor-complexity" icon="gauge" title={t.complexity}>
        <p className="flex flex-wrap items-center gap-3">
          <Pill className={cx("text-sm", levelTone[a.complexity.level])}>{l.complexity[a.complexity.level]}</Pill>
        </p>
        <p className="mt-3 leading-relaxed text-slate-300">{a.complexity.rationale}</p>
      </Block>

      <Block id="advisor-phases" icon="layers" title={t.phases}>
        <ol className="grid gap-4 md:grid-cols-2">
          {a.phases.map((phase, index) => (
            <li key={phase.name} className="rounded-xl border border-white/[0.08] bg-ink-950/40 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                {index + 1}. {phase.indicative_duration}
              </p>
              <p className="mt-2 font-semibold text-white">{phase.name}</p>
              <p className="mt-1 text-sm text-slate-400">{phase.description}</p>
              <p className="mt-3 text-xs font-medium text-slate-300">{t.deliverables}:</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-400">
                {phase.deliverables.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-slate-400">{t.phasesNote}</p>
      </Block>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block id="advisor-questions" icon="message" title={t.questions}>
          <ul className="grid list-disc gap-2 pl-5 text-slate-300">
            {a.clarification_questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </Block>
        <Block id="advisor-next" icon="target" title={t.nextSteps}>
          <ol className="grid list-decimal gap-2 pl-5 text-slate-300">
            {a.next_steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Block>
      </div>
    </div>
  );
}
