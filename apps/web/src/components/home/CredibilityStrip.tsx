import { Icon, type IconName } from "@/components/ui/Icon";
import { Container } from "@/components/ui/primitives";

/** Concise capability strip: what we work with and can be checked on, no logos and no numbers. */
export function CredibilityStrip({
  label,
  lead,
  groups,
}: {
  label: string;
  lead?: string;
  groups: { icon: IconName; title: string; items: string[] }[];
}) {
  return (
    <section aria-labelledby="credibility-title" className="border-y border-line-subtle bg-surface-1">
      <Container className="grid gap-5 py-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        <div className="min-w-0">
          <h2 id="credibility-title" className="t-h3">
            {label}
          </h2>
          {lead && <p className="mt-2 text-sm leading-relaxed text-fg-muted">{lead}</p>}
        </div>
        <ul className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <li key={group.title} className="flex gap-3">
              <Icon name={group.icon} className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-semibold leading-snug text-fg">{group.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">{group.items.join(" · ")}</span>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
