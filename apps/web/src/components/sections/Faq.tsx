import { Icon } from "@/components/ui/Icon";
import type { FaqItem } from "@/content/types";

/** Native <details> accordion: accessible, keyboard friendly and works without JavaScript. */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-white/[0.07] rounded-2xl border border-white/10 bg-white/[0.02]">
      {items.map((item) => (
        <details key={item.question} className="group px-5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium text-white [&::-webkit-details-marker]:hidden">
            <span>{item.question}</span>
            <Icon
              name="chevronDown"
              className="h-5 w-5 shrink-0 text-cyan-300 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <p className="pb-5 leading-relaxed text-slate-400">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}
