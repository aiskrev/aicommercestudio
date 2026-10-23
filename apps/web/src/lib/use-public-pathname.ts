"use client";

import { usePathname } from "next/navigation";

import { toPublicPath } from "@/i18n/config";

/** `usePathname()` expressed as the public URL (default-locale prefix removed). */
export function usePublicPathname(): string {
  return toPublicPath(usePathname());
}
