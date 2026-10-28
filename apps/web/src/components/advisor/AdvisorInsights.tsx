import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/primitives";
import type { AdvisorContent } from "@/content/bg/advisor";
import type { AdvisorInsights as Insights, Basis } from "@/lib/advisor";
import type { DomainKey } from "@/lib/domains";

/** Advisor V2 insights. Every item shows its basis, so the visitor can see why it is there. */
export function AdvisorInsights({
  insights,
  content,
  domainLinks = {},
}: {
  insights: Insights;
  content: AdvisorContent["v2"]["insights"];
  domainLinks?: Partial<Record<DomainKey, { href: string; label: string }>>;
}) {
  const t = content;
  const level = (value: keyof typeof t.levels) => t.levels[value];
  return (
    <section aria-labelledby="advisor-v2-title" className="grid gap-6" data-testid="advisor-insights">
      <div>
        <h2 id="advisor-v2-title" className="t-h2 text-2xl">
          {t.title}
        </h2>
        <p className="mt-2 max-w-3xl text-fg-muted">{t.note}</p>
      </div>

      <Card id="v2-opportunities" title={t.opportunities}>
        <ul className="grid gap-4">
          {insights.opportunities.map((o) => (
            <li key={o.title}>
              <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                {o.title}
                <Badge tone="accent">{t.categories[o.category]}</Badge>
                <Badge tone="outline">
                  {t.fit}: {level(o.fit)}
                </Badge>
              </p>
              <p className="mt-1 text-fg-secondary">{o.explanation}</p>
              <BasisList basis={o.basis} label={t.basis} />
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="v2-feasibility" title={`${t.feasibility}: ${level(insights.feasibility.level)}`}>
          <p className="text-fg-secondary">{insights.feasibility.explanation}</p>
          <ul className="mt-3 grid gap-3">
            {insights.feasibility.factors.map((f) => (
              <li key={f.text}>
                <Badge tone={f.effect === "supports" ? "success" : "warning"}>{f.effect === "supports" ? t.supports : t.limits}</Badge>
                <p className="mt-1 text-fg-secondary">{f.text}</p>
                <BasisList basis={f.basis} label={t.basis} />
              </li>
            ))}
          </ul>
        </Card>
        <Card id="v2-risk" title={`${t.risk}: ${level(insights.risk.level)}`}>
          {insights.risk.items.length === 0 ? (
            <p className="text-fg-muted">{t.noRisks}</p>
          ) : (
            <ul className="grid gap-3">
              {insights.risk.items.map((r) => (
                <li key={r.title}>
                  <p className="font-semibold text-fg">{r.title}</p>
                  <p className="mt-1 text-fg-secondary">{r.explanation}</p>
                  <BasisList basis={r.basis} label={t.basis} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card id="v2-checkpoints" title={t.checkpoints}>
          <ul className="grid gap-3">
            {insights.checkpoints.map((c) => (
              <li key={c.step}>
                <p className="font-semibold text-fg">{c.step}</p>
                <p className="mt-1 text-fg-secondary">{c.reason}</p>
                <BasisList basis={c.basis} label={t.basis} />
              </li>
            ))}
          </ul>
        </Card>
        <Card id="v2-prerequisites" title={t.prerequisites}>
          {(["integration", "security"] as const).map((area) => {
            const items = insights.prerequisites.filter((p) => p.area === area);
            if (!items.length) return null;
            return (
              <div key={area} className="mb-4 last:mb-0">
                <h4 className="t-label">{t[area]}</h4>
                <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-fg-secondary">
                  {items.map((p) => (
                    <li key={p.text}>{p.text}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </Card>
      </div>

      <Card id="v2-pilot" title={t.pilot}>
        <p className="text-fg-secondary">{insights.pilot.scope}</p>
        <p className="mt-2 text-sm text-fg-muted">
          {t.weeks.replace("{min}", String(insights.pilot.duration_weeks[0])).replace("{max}", String(insights.pilot.duration_weeks[1]))}
        </p>
        <h4 className="t-label mt-4">{t.criteria}</h4>
        <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-fg-secondary">
          {insights.pilot.success_criteria.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <h4 className="t-label mt-4">{t.human}</h4>
        <p className="mt-1 text-fg-secondary">{insights.pilot.human_in_the_loop}</p>
        <BasisList basis={insights.pilot.basis} label={t.basis} />
      </Card>

      {insights.roadmap && (
        <Card id="v2-roadmap" title={t.roadmap}>
          <ol className="grid gap-4 md:grid-cols-3">
            {insights.roadmap.map((phase) => (
              <li key={phase.horizon}>
                <p className="font-semibold text-fg">{phase.title}</p>
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm text-fg-secondary">
                  {phase.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {insights.domains.length > 0 && (
        <Card id="v2-domains" title={t.domains}>
          <ul className="grid gap-3">
            {insights.domains.map((d) => {
              const link = domainLinks[d.domain];
              return (
                <li key={d.domain}>
                  {link ? (
                    <Link href={link.href} className="link font-semibold">
                      {link.label}
                    </Link>
                  ) : (
                    <span className="font-semibold text-fg">{d.domain}</span>
                  )}
                  <p className="mt-1 text-fg-secondary">{d.reason}</p>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="text-sm text-fg-muted">{insights.provenance_note}</p>
    </section>
  );
}

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card p-6 sm:p-7" data-testid={id}>
      <h3 id={id} className="text-lg font-semibold text-fg">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BasisList({ basis, label }: { basis: Basis[]; label: string }) {
  if (!basis.length) return null;
  return (
    <p className="mt-1.5 text-xs text-fg-muted">
      {label}: {basis.map((b) => b.label).join(" · ")}
    </p>
  );
}
