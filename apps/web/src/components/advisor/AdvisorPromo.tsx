import { Badge, ButtonLink, IconBadge, cx } from "@/components/ui/primitives";
import type { AdvisorContent } from "@/content/bg/advisor";

/** Compact entry point to the AI automation advisor, used on related pages. */
export function AdvisorPromo({ promo, href, className }: { promo: AdvisorContent["promo"]; href: string; className?: string }) {
  return (
    <div
      className={cx("card-accent flex flex-col gap-6 rounded-2xl p-6 sm:flex-row sm:items-center sm:p-8", className)}
      data-testid="advisor-promo"
    >
      <IconBadge name="sparkles" className="h-12 w-12" />
      <div className="min-w-0 flex-1">
        <Badge accent>{promo.eyebrow}</Badge>
        <p className="mt-3 text-xl font-semibold text-fg">{promo.title}</p>
        <p className="mt-2 max-w-2xl leading-relaxed text-fg-muted">{promo.lead}</p>
      </div>
      <ButtonLink href={href} icon="arrowRight" className="shrink-0">
        {promo.cta}
      </ButtonLink>
    </div>
  );
}
