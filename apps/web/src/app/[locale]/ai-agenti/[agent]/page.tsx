import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CtaBand } from "@/components/sections/CtaBand";
import { AGENT_ICONS } from "@/components/tools/team/AgentCard";
import { fill } from "@/components/tools/team/TeamControls";
import { Icon } from "@/components/ui/Icon";
import { Alert, ButtonLink, Container, Eyebrow, Section, cx } from "@/components/ui/primitives";
import { getContent } from "@/content";
import { isLocale, localizePath } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { AGENT_SLUGS, type RiskLevel, agentBySlug, libraryEntry } from "@/lib/agent-library";
import { AGENT_KEYS, WORKFLOWS } from "@/lib/ai-team";
import { resolveLocale } from "@/lib/params";
import { contactWithService, routes } from "@/lib/routes";
import { buildMetadata } from "@/lib/seo";
import { isToolAvailable, toolByKey, toolHrefs } from "@/lib/tools";

export const dynamicParams = false;

const RISK_BADGE: Record<RiskLevel, string> = { low: "badge-success", medium: "badge-accent", high: "badge-warning" };

export function generateStaticParams({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale) || !isToolAvailable(toolByKey("agents"))) return [];
  return AGENT_KEYS.map((key) => ({ agent: AGENT_SLUGS[key].bg }));
}

function resolveAgent(slug: string) {
  if (!isToolAvailable(toolByKey("agents"))) return null;
  return agentBySlug(slug);
}

export async function generateMetadata({ params }: PageProps<"/[locale]/ai-agenti/[agent]">) {
  const locale = await resolveLocale(params);
  const { agent: slug } = await params;
  const key = resolveAgent(slug);
  if (!key) return {};
  const { agentLibrary, teamTool } = getContent(locale);
  return buildMetadata({
    locale,
    title: `${teamTool.agents[key].name} — ${agentLibrary.title}`,
    description: teamTool.agents[key].purpose,
    path: routes.agent(slug),
  });
}

function Block({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("min-w-0 border-t border-line-subtle pt-5", className)}>
      <h2 className="t-label">{title}</h2>
      <div className="mt-3 text-[15px] leading-relaxed text-fg-secondary">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  );
}

/** One agent of the library: every catalogue attribute plus illustrative example workflows. */
export default async function AgentPage({ params }: PageProps<"/[locale]/ai-agenti/[agent]">) {
  const locale = await resolveLocale(params);
  const { agent: slug } = await params;
  const key = resolveAgent(slug);
  if (!key) notFound();

  const { agentLibrary: t, teamTool } = getContent(locale);
  const dict = getDictionary(locale);
  const href = (path: string) => localizePath(locale, path);
  const hrefs = toolHrefs(locale);
  const entry = libraryEntry(key);
  const agent = teamTool.agents[key];
  const d = t.detail;
  const agentHref = (other: typeof key) => href(routes.agent(AGENT_SLUGS[other].bg));
  const builderHref = hrefs.solution && entry.workflows.length > 0 ? `${hrefs.solution}?w=${entry.workflows[0]}` : hrefs.solution;

  return (
    <>
      <Breadcrumbs
        items={[
          { name: dict.common.home, path: href(routes.home) },
          { name: dict.nav.tools, path: href(routes.tools) },
          { name: t.title, path: href(routes.agentLibrary) },
          { name: agent.name, path: href(routes.agent(slug)) },
        ]}
      />
      <div className="relative overflow-hidden border-b border-line-subtle">
        <div className="grid-backdrop pointer-events-none absolute inset-0" aria-hidden="true" />
        <Container className="relative pb-14 pt-12 sm:pb-16 sm:pt-16">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <div className="mt-5 flex items-start gap-4">
            <span className="mt-1 hidden h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default text-brand sm:inline-flex" aria-hidden="true">
              <Icon name={AGENT_ICONS[key]} className="h-6 w-6" />
            </span>
            <h1 className="t-h1 max-w-4xl">{agent.name}</h1>
          </div>
          <p className="t-lead mt-6 max-w-3xl">{agent.purpose}</p>
          <ul className="mt-6 flex flex-wrap gap-2">
            <li className={cx("badge", RISK_BADGE[entry.risk])}>
              {d.risk}: {t.risk[entry.risk]}
            </li>
            <li className="badge">
              {d.complexity}: {teamTool.complexity[entry.complexity]}
            </li>
            <li className="badge">{t.roles[entry.role]}</li>
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {builderHref && (
              <ButtonLink href={builderHref} icon="arrowRight">
                {d.useInBuilder}
              </ButtonLink>
            )}
            {hrefs.team && (
              <Link href={hrefs.team} className="link">
                {d.useInTeam}
              </Link>
            )}
          </div>
        </Container>
      </div>

      <Section size="wide">
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
          <Block title={d.departments}>
            <ul className="grid gap-2">
              {entry.departments.map((department) => (
                <li key={department}>
                  <span className="font-medium text-fg">{teamTool.departments.options[department].title}</span>
                  <span className="text-fg-muted"> — {teamTool.departments.options[department].text}</span>
                </li>
              ))}
            </ul>
          </Block>
          <Block title={d.approval}>
            <p className="font-medium text-fg">{fill(d.approvalMinimum, { checkpoint: teamTool.checkpoints[entry.approval].title })}</p>
            <p className="mt-1 text-fg-muted">{teamTool.checkpoints[entry.approval].text}</p>
            <p className="mt-3">{agent.oversight}</p>
          </Block>
          <Block title={d.inputs}>
            <Bullets items={agent.inputs} />
          </Block>
          <Block title={d.outputs}>
            <Bullets items={agent.outputs} />
          </Block>
          <Block title={d.dataSources}>
            {entry.dataSources.length > 0 ? <Bullets items={entry.dataSources.map((i) => teamTool.integrations[i])} /> : <p>{d.noDataSources}</p>}
          </Block>
          <Block title={d.integrations}>
            <ul className="grid gap-2">
              {entry.categories.map((category) => (
                <li key={category}>
                  <span className="font-medium text-fg">{t.categories[category].title}</span>
                  {entry.requiredCategories.includes(category) && <span className="badge ml-2 align-middle">{d.requiredMark}</span>}
                  <span className="block text-sm text-fg-muted">{t.categories[category].text}</span>
                </li>
              ))}
            </ul>
            {entry.systems.length > 0 && <p className="mt-3 text-sm text-fg-subtle">{entry.systems.map((i) => teamTool.integrations[i]).join(" · ")}</p>}
          </Block>
          <Block title={d.risk}>
            <p className="font-medium text-fg">{t.risk[entry.risk]}</p>
            <p className="mt-1">{t.riskText[entry.risk]}</p>
            <p className="mt-3 text-sm">
              <span className="text-fg-subtle">{d.sensitivity}: </span>
              {agent.sensitivityNote}
            </p>
          </Block>
          <Block title={d.complexity}>
            <p className="font-medium text-fg">{teamTool.complexity[entry.complexity]}</p>
            <p className="mt-3 text-sm">
              <span className="text-fg-subtle">{d.dependencies}: </span>
              {entry.requires.length > 0
                ? entry.requires.map((other, index) => (
                    <span key={other}>
                      {index > 0 && ", "}
                      <Link href={agentHref(other)} className="link">
                        {teamTool.agents[other].name}
                      </Link>
                    </span>
                  ))
                : d.noDependencies}
            </p>
          </Block>
        </div>
      </Section>

      <Section size="wide" labelledBy="agent-workflows-title">
        <h2 id="agent-workflows-title" className="t-h2">
          {d.workflows}
        </h2>
        <Alert tone="info" role="note" className="mt-4 max-w-3xl">
          {d.workflowsNote}
        </Alert>
        {entry.role !== "task" && <p className="mt-6 text-fg-muted">{d.anyWorkflow}</p>}
        <ul className="mt-6 grid gap-4 md:grid-cols-2" data-testid="agent-workflows">
          {entry.workflows.map((workflowKey) => {
            const workflow = teamTool.result.workflows[workflowKey];
            const chain = WORKFLOWS.find((w) => w.key === workflowKey)!.chain;
            return (
              <li key={workflowKey} className="card p-5">
                <h3 className="t-h3">{workflow.title}</h3>
                <ol className="mt-4 grid gap-2 text-sm">
                  <li className="text-fg-muted">{workflow.trigger}</li>
                  {chain.map((step) => (
                    <li key={step} className={cx("flex items-center gap-2", step === key ? "font-semibold text-fg" : "text-fg-secondary")}>
                      <Icon name="chevronRight" className="h-3.5 w-3.5 shrink-0 text-brand" />
                      {step === key ? teamTool.agents[step].name : <Link href={agentHref(step)} className="hover:text-fg">{teamTool.agents[step].name}</Link>}
                    </li>
                  ))}
                  <li className="flex items-center gap-2 text-fg-muted">
                    <Icon name="check" className="h-3.5 w-3.5 shrink-0 text-brand" />
                    {workflow.outcome}
                  </li>
                </ol>
                {hrefs.solution && (
                  <Link href={`${hrefs.solution}?w=${workflowKey}`} className="link mt-4 inline-block text-sm">
                    {d.useInBuilder}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-8">
          <Link href={href(routes.agentLibrary)} className="link">
            ← {d.backToLibrary}
          </Link>
        </p>
      </Section>

      <CtaBand
        title={t.ctaTitle}
        lead={t.ctaText}
        primary={{ href: href(contactWithService("ai_agents")), label: t.ctaButton }}
        secondary={builderHref ? { href: builderHref, label: d.useInBuilder } : undefined}
      />
    </>
  );
}
