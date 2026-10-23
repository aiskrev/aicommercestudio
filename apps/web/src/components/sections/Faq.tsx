import { Icon } from "@/components/ui/Icon";
import type { FaqItem } from "@/content/types";

/**
 * Native <details> accordion: keyboard accessible and works without JavaScript.
 * Height animates in browsers that support ::details-content (see .accordion in globals.css).
 */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="accordion card divide-y divide-white/[0.07] overflow-hidden">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left font-medium text-white transition-colors hover:bg-white/[0.025] focus-visible:-outline-offset-2 sm:px-6 [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-cyan-300 transition-all duration-200 group-open:rotate-180 group-open:border-cyan-400/40 group-open:bg-cyan-400/10">
              <Icon name="chevronDown" className="h-4 w-4" />
            </span>
          </summary>
          <p className="px-5 pb-6 leading-relaxed text-slate-300 sm:px-6">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
