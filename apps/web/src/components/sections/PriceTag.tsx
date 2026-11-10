import { cx } from "@/components/ui/primitives";
import type { Locale } from "@/i18n/config";
import { type PriceItem, priceText } from "@/lib/prices";

/** Indicative price of an offer: "from" amount and the typical range, in the market of the locale. */
export function PriceTag({ locale, price, testId, className }: { locale: Locale; price: PriceItem; testId?: string; className?: string }) {
  const text = priceText(locale, price);
  return (
    <div className={cx("grid gap-0.5", className)} data-testid={testId}>
      <p className="font-display text-lg font-semibold text-fg">{text.from}</p>
      <p className="text-body-sm text-fg-muted">{text.typical}</p>
    </div>
  );
}
