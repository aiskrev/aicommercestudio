import { cx } from "@/components/ui/primitives";
import type { DeliveryStatus } from "@/lib/domains";

const STATUS_BADGE: Record<DeliveryStatus, string> = {
  available: "badge-success",
  custom: "",
  planned: "badge-warning",
};

/** Delivery status chip; the label carries the meaning, the colour only repeats it. */
export function StatusChip({ status, label, className }: { status: DeliveryStatus; label: string; className?: string }) {
  return <span className={cx("badge badge-dot", STATUS_BADGE[status], className)}>{label}</span>;
}
