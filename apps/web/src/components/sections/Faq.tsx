import { Icon } from "@/components/ui/Icon";
import type { FaqItem } from "@/content/types";

/**
 * Native <details> accordion: keyboard accessible and works without JavaScript.
 * Height animates in browsers that support ::details-content (see .accordion in globals.css).
 */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="accordion divide-y divide-line-subtle border-y border-line-subtle">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-[17px] font-semibold text-fg transition-colors hover:text-brand focus-visible:-outline-offset-2 [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-line-default text-brand transition-all duration-200 group-open:rotate-180 group-open:border-brand/50 group-open:bg-brand/10">
              <Icon name="chevronDown" className="h-4 w-4" />
            </span>
          </summary>
          <p className="max-w-3xl pb-6 pr-12 leading-relaxed text-fg-secondary">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
