import { Icon } from "@/components/ui/Icon";
import { ButtonLink, IconBadge } from "@/components/ui/primitives";
import type { Service } from "@/content/types";

/** Contextual, non-intrusive call to action inside long-form content. */
export function InlineCta({
  service,
  title,
  lead,
  quoteHref,
  serviceHref,
  labels,
}: {
  service: Service;
  title: string;
  lead: string;
  quoteHref: string;
  serviceHref: string;
  labels: { quote: string; learnMore: string };
}) {
  return (
    <aside
      className="card-accent not-prose my-10 flex flex-col gap-5 rounded-2xl p-6 sm:flex-row sm:items-center"
      aria-label={title}
      data-testid="inline-cta"
    >
      <IconBadge name={service.icon} className="h-12 w-12" />
      <div className="flex-1">
        <p className="font-display text-lg font-semibold text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">{lead}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <ButtonLink href={quoteHref} size="sm" icon="arrowRight">
          {labels.quote}
        </ButtonLink>
        <a href={serviceHref} className="inline-flex items-center justify-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
          {labels.learnMore}
          <Icon name="chevronRight" className="h-3.5 w-3.5" />
        </a>
      </div>
    </aside>
  );
}
