"use client";

import { usePathname } from "next/navigation";

import { toPublicPath } from "@/i18n/config";

/** `usePathname()` expressed as the public URL (`/en/uslugi/x` after the proxy rewrite → `/en/services/x`). */
export function usePublicPathname(): string {
  return toPublicPath(usePathname());
}
