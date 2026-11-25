/** Velora's `cn` (clsx + tailwind-merge): here a plain join of the truthy classes; later classes are appended. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
