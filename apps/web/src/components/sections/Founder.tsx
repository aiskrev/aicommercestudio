import Image from "next/image";

import { cx } from "@/components/ui/primitives";
import portrait from "@/assets/founder/aleksandar-iskrev.webp";

/** The approved founder portrait (1216 × 1293), served through next/image in modern formats. */
export const FOUNDER_PORTRAIT = portrait;

export function FounderPortrait({
  alt,
  sizes,
  priority = false,
  className,
}: {
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("relative overflow-hidden rounded-[var(--radius-lg)] border border-line-subtle bg-surface-2", className)}>
      <Image
        src={portrait}
        alt={alt}
        sizes={sizes}
        priority={priority}
        placeholder="blur"
        className="h-full w-full object-cover object-top"
      />
    </div>
  );
}
