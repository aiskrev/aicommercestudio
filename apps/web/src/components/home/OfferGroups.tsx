import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/Icon";

export interface OfferGroup {
  key: string;
  icon: IconName;
  title: string;
  /** The problem the group solves, in one sentence. */
  problem: string;
  domains: { key: string; name: string; href: string }[];
}

/**
 * The four capability groups of the homepage (AI, cloud and data, platforms and operations,
 * commerce). Each card states the problem it solves and links its domain hubs — the services
 * themselves stay one level deeper, so the homepage never becomes a list of every offering.
 */
export function OfferGroups({ groups }: { groups: OfferGroup[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2" data-testid="offer-groups">
      {groups.map((group) => (
        <li key={group.key} className="min-w-0">
          <article className="card group/card flex h-full flex-col p-6 transition-colors duration-200 hover:border-line-strong sm:p-7" data-group={group.key}>
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default bg-surface-2 text-brand transition-colors group-hover/card:border-brand/50">
                <Icon name={group.icon} className="h-5 w-5" />
              </span>
              <h3 className="t-h3-lg">{group.title}</h3>
            </div>
            <p className="mt-4 leading-relaxed text-fg-muted">{group.problem}</p>
            <ul className="mt-auto grid gap-1 pt-5">
              {group.domains.map((domain) => (
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
          </article>
        </li>
      ))}
    </ul>
  );
}
