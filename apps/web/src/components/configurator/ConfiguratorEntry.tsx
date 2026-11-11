"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";

let cached: boolean | undefined;
let pending: Promise<boolean> | undefined;

/** Reads the runtime flag once per page load (the pages that show the link are prerendered). */
export function loadConfiguratorEnabled(): Promise<boolean> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (typeof fetch !== "function") return Promise.resolve(false);
  pending ??= fetch("/api/configurator-flag", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : { enabled: false }))
    .then((data: { enabled?: unknown }) => (cached = data.enabled === true))
    .catch(() => {
      pending = undefined; // try again on the next mount
      return false;
    });
  return pending;
}

/** Test helper: forget the answer between tests. */
export function resetConfiguratorEnabledCache() {
  cached = undefined;
  pending = undefined;
}

/**
 * "Configure a project" entry point. Rendered only when the configurator is switched on, so with the flag off
 * nothing changes on any page.
 */
export function ConfiguratorEntry({ href, label, variant = "primary", className }: { href: string; label: string; variant?: "primary" | "secondary"; className?: string }) {
  const [enabled, setEnabled] = useState(cached ?? false);
  useEffect(() => {
    let active = true;
    void loadConfiguratorEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);
  if (!enabled) return null;
  return (
    <Link href={href} className={cx(buttonClass(variant), className)} data-testid="configurator-entry">
      <span className="btn-label">{label}</span>
      <Icon name="arrowRight" className="btn-icon h-4 w-4" />
    </Link>
  );
}
