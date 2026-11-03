import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

export interface CapabilityArea {
  key: string;
  icon: IconName;
  title: string;
  problem: string;
  approach: string;
  capabilities: string[];
  outcome: string;
  domains: { key: string; name: string; href: string }[];
}

export interface CapabilityLabels {
  problem: string;
  approach: string;
  capabilities: string;
  outcome: string;
  domains: string;
}

function DomainLinks({ area, label }: { area: CapabilityArea; label: string }) {
  return (
    <nav aria-label={`${label}: ${area.title}`}>
      <ul className="grid gap-0.5">
        {area.domains.map((domain) => (
          <li key={domain.key}>
            <Link
              href={domain.href}
              className="group -mx-2 flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] px-2 font-semibold text-fg transition-colors duration-150 hover:bg-surface-2 hover:text-brand focus-visible:bg-surface-2"
            >
              <span className="min-w-0">{domain.name}</span>
              <Icon name="arrowRight" className="arrow-nudge h-4 w-4 shrink-0 text-fg-subtle group-hover:text-brand" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Capabilities({ items, label }: { items: string[]; label: string }) {
  return (
    <>
      <p className="t-label">{label}</p>
      <ul className="mt-2 grid border-t border-line-subtle">
        {items.map((capability) => (
          <li key={capability} className="flex items-start gap-2.5 border-b border-line-subtle py-2.5 text-body-sm text-fg-secondary">
            <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            {capability}
          </li>
        ))}
      </ul>
    </>
  );
}

function Heading({ area, large }: { area: CapabilityArea; large?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand">
        <Icon name={area.icon} className="h-5 w-5" />
      </span>
      <h3 className={large ? "t-h3-lg" : "t-h3"}>{area.title}</h3>
    </div>
  );
}

/**
 * Homepage capability narrative: three areas with unequal weight. The first is a full-width feature
 * panel (narrative on the left, capabilities and domains on the right); the other two sit side by
 * side below it. Each states the problem, the approach, its capabilities and the kind of result,
 * then links its domain hubs (all ten hubs are linked once).
 */
export function CapabilityAreas({ areas, labels }: { areas: CapabilityArea[]; labels: CapabilityLabels }) {
  const [feature, ...rest] = areas;
  return (
    <ul className="grid gap-5 lg:grid-cols-2" data-testid="capability-areas">
      {feature && (
        <li className="min-w-0 lg:col-span-2">
          <article className="feature-panel grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 lg:p-10" data-area={feature.key}>
            <div className="min-w-0">
              <Heading area={feature} large />
              <p className="mt-5 text-lead-sm font-medium leading-relaxed text-fg-secondary">
                <span className="sr-only">{labels.problem}: </span>
                {feature.problem}
              </p>
              <p className="mt-3 leading-relaxed text-fg-muted">
                <span className="sr-only">{labels.approach}: </span>
                {feature.approach}
              </p>
              <p className="mt-5 text-body-sm leading-relaxed text-fg-muted">
                <span className="font-semibold text-fg">{labels.outcome}: </span>
                {feature.outcome}
              </p>
            </div>
            <div className="grid min-w-0 content-start gap-6">
              <div>
                <Capabilities items={feature.capabilities} label={labels.capabilities} />
              </div>
              <DomainLinks area={feature} label={labels.domains} />
            </div>
          </article>
        </li>
      )}
      {rest.map((area) => (
        <li key={area.key} className="min-w-0">
          <article className={cx("card flex h-full flex-col p-6 sm:p-7")} data-area={area.key}>
            <Heading area={area} />
            <p className="mt-4 font-medium leading-relaxed text-fg-secondary">
              <span className="sr-only">{labels.problem}: </span>
              {area.problem}
            </p>
            <p className="mt-2 text-body-sm leading-relaxed text-fg-muted">
              <span className="sr-only">{labels.approach}: </span>
              {area.approach}
            </p>
            <div className="mt-5">
              <Capabilities items={area.capabilities} label={labels.capabilities} />
            </div>
            <p className="mt-5 text-body-sm leading-relaxed text-fg-muted">
              <span className="font-semibold text-fg">{labels.outcome}: </span>
              {area.outcome}
            </p>
            <div className="mt-auto pt-5">
              <DomainLinks area={area} label={labels.domains} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
