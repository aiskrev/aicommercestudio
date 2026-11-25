import { cx } from "@/components/ui/primitives";

/** Velora's `cn` (clsx + tailwind-merge) on top of our `cx`; later classes are appended, not merged. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return cx(...classes);
}
