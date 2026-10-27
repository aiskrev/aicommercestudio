import { Icon, type IconName } from "@/components/ui/Icon";

export interface UseCase {
  icon: IconName;
  area: string;
  title: string;
  ai: string;
  human: string;
}

/**
 * Use cases by business function as an editorial ledger on the light surface: function and use
 * case, what the AI does, where a person decides. A column header labels the cells from lg; below
 * that each row shows its own labels (they are the <dt>s, so screen readers always hear them).
 */
export function UseCaseLedger({ items, labels }: { items: UseCase[]; labels: { ai: string; human: string } }) {
  return (
    <div>
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-10 border-b border-ink/20 pb-3 lg:grid" aria-hidden="true">
        <span />
        <span className="t-label">{labels.ai}</span>
        <span className="t-label">{labels.human}</span>
      </div>
      <ul>
        {items.map((item) => (
          <li
            key={item.title}
            className="grid gap-4 border-b border-ink/15 py-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-10"
          >
            <div className="flex min-w-0 gap-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-brand" aria-hidden="true">
                <Icon name={item.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="t-label">{item.area}</p>
                <h3 className="mt-1 text-lg font-semibold leading-snug">{item.title}</h3>
              </div>
            </div>
            <dl className="contents">
              <div className="min-w-0 pl-14 lg:pl-0">
                <dt className="t-label flex items-center gap-2 lg:sr-only">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-ink" aria-hidden="true" />
                  {labels.ai}
                </dt>
                <dd className="mt-1 leading-relaxed text-ink-muted lg:mt-0">{item.ai}</dd>
              </div>
              <div className="min-w-0 pl-14 lg:pl-0">
                <dt className="t-label flex items-center gap-2 lg:sr-only">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                  {labels.human}
                </dt>
                <dd className="mt-1 leading-relaxed text-ink-muted lg:mt-0">{item.human}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
