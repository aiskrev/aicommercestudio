"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";

export interface AccountLinkItem {
  href: string;
  label: string;
}

export interface AccountLinksData {
  signIn: AccountLinkItem;
  register: AccountLinkItem;
}

let cached: boolean | undefined;
let pending: Promise<boolean> | undefined;

/** Reads the runtime flag once per page load (the public pages are prerendered and cannot read it). */
export function loadAccountsEnabled(): Promise<boolean> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (typeof fetch !== "function") return Promise.resolve(false);
  pending ??= fetch("/api/account-flag", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : { enabled: false }))
    .then((data: { enabled?: unknown }) => (cached = data.enabled === true))
    .catch(() => {
      pending = undefined; // try again on the next mount
      return false;
    });
  return pending;
}

/** Test helper: forget the answer between tests. */
export function resetAccountsEnabledCache() {
  cached = undefined;
  pending = undefined;
}

function useAccountsEnabled(): boolean {
  const [enabled, setEnabled] = useState(cached ?? false);
  useEffect(() => {
    let active = true;
    void loadAccountsEnabled().then((value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}

/**
 * Sign-in and sign-up entry points. Rendered only when customer accounts are switched on, so with the flag
 * off nothing changes anywhere on the site. `header`: desktop bar (one icon link to sign-in; sign-up is on that
 * page); `sheet`: the mobile menu; `footer`: list items for the company column.
 */
export function AccountLinks({ links, variant }: { links: AccountLinksData; variant: "header" | "sheet" | "footer" }) {
  const enabled = useAccountsEnabled();
  if (!enabled) return null;

  if (variant === "header") {
    // One compact control instead of a text link plus a button: the Bulgarian bar has no spare width at 1024 and
    // 1440 px (BLOCKER-ACC-HEADER-01). Sign-up stays one step away: the sign-in page offers it, and so do the
    // mobile menu and the footer.
    return (
      <Link
        href={links.signIn.href}
        aria-label={links.signIn.label}
        title={links.signIn.label}
        data-testid="header-account"
        className="hidden h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-line-default text-fg-secondary transition-colors hover:border-line-strong hover:text-fg lg:inline-flex"
      >
        <Icon name="users" className="h-5 w-5" />
      </Link>
    );
  }

  if (variant === "sheet") {
    return (
      <div className="grid gap-3">
        <Link href={links.register.href} className={cx(buttonClass("secondary", "lg"), "w-full")}>
          {links.register.label}
        </Link>
        <Link href={links.signIn.href} className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-fg-secondary hover:text-fg">
          {links.signIn.label}
        </Link>
      </div>
    );
  }

  return (
    <>
      {[links.register, links.signIn].map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="text-body-sm text-fg-secondary transition-colors hover:text-brand">
            {link.label}
          </Link>
        </li>
      ))}
    </>
  );
}
