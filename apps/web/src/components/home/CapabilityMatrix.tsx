import { Icon, type IconName } from "@/components/ui/Icon";

export interface CapabilityGroup {
  icon: IconName;
  title: string;
  items: string[];
}

/** Hairline matrix of capability groups — capability-based proof instead of logos or numbers. */
export function CapabilityMatrix({ groups }: { groups: CapabilityGroup[] }) {
  return (
    <ul className="grid overflow-hidden rounded-[var(--radius-lg)] border border-ink/15 bg-ink/15 gap-px sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <li key={group.title} className="bg-surface-light p-6 sm:p-7">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-ink text-brand" aria-hidden="true">
            <Icon name={group.icon} className="h-5 w-5" />
          </span>
          <h3 className="t-h3 mt-4">{group.title}</h3>
          <ul className="mt-3 grid gap-1.5 text-[14.5px] text-ink-muted">
            {group.items.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-[2px] bg-brand-ink" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
