import { Icon, type IconName } from "@/components/ui/Icon";
import { Container } from "@/components/ui/primitives";

/** Concise capability strip under the hero: what we work with, no logos and no numbers. */
export function CredibilityStrip({
  label,
  groups,
}: {
  label: string;
  groups: { icon: IconName; title: string; items: string[] }[];
}) {
  return (
    <section aria-label={label} className="border-b border-line-subtle bg-surface-1">
      <Container className="grid gap-5 py-8 lg:grid-cols-[13rem_1fr] lg:gap-10">
        <p className="t-eyebrow self-start">{label}</p>
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
