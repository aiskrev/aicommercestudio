import { reveal } from "@/components/motion/reveal";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Container } from "@/components/ui/primitives";

/**
 * Concise capability strip: what we work with and can be checked on, no logos and no numbers. Shown as "system
 * checks" (docs/MOTION_SYSTEM.md): when the list scrolls into view a hairline runs across it and each group's check
 * mark ticks in sequence (140 ms apart, transform and opacity). Decorative only: there are no scores or results,
 * and without JavaScript, with reduced motion or when on screen at load every check is shown ticked at once.
 */
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
        <ul {...reveal()} className="sys-checks grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="system-checks">
          {groups.map((group, index) => (
            <li key={group.title} className="flex gap-3" style={{ ["--i" as string]: index }}>
              <span className="sys-mark">
                <Icon name={group.icon} className="h-5 w-5 text-brand" />
                <span className="sys-tick" aria-hidden="true">
                  <Icon name="check" className="h-2.5 w-2.5" />
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-nav font-semibold leading-snug text-fg">{group.title}</span>
                <span className="mt-0.5 block text-caption leading-snug text-fg-muted">{group.items.join(" · ")}</span>
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
