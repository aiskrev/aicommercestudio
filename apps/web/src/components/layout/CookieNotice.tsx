"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

import { buttonClass } from "@/components/ui/primitives";

/** Remembers that the visitor closed the notice (listed in the cookie information, 12 months). */
export const COOKIE_NOTICE_COOKIE = "acs_cookie_notice";
const MAX_AGE = 60 * 60 * 24 * 365;

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const dismissed = () => document.cookie.split("; ").some((part) => part.startsWith(`${COOKIE_NOTICE_COOKIE}=`));

/**
 * Cookie notice (docs/SECURITY.md → GDPR; the cookie information page). The site sets only strictly
 * necessary cookies and the language preference, so the notice is informational: one action closes
 * it, nothing is optional. It is rendered on the client only, so every page stays static; it is a
 * labelled region (not a modal) that never traps focus.
 */
export function CookieNotice({
  labels,
  href,
}: {
  labels: { label: string; text: string; more: string; accept: string };
  href: string;
}) {
  // Server snapshot: hidden, so static HTML never contains the notice and nothing flashes for
  // visitors who already closed it.
  const hidden = useSyncExternalStore(subscribe, dismissed, () => true);
  if (hidden) return null;

  function accept() {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_NOTICE_COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`;
    for (const listener of listeners) listener();
  }

  return (
    <section
      aria-label={labels.label}
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-[var(--radius-lg)] border border-line-default bg-surface-1 p-3.5 shadow-[var(--shadow-panel)] sm:inset-x-4 sm:bottom-4 sm:p-5"
      data-testid="cookie-notice"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <p className="text-body-sm leading-relaxed text-fg-secondary">
          {labels.text}{" "}
          <Link href={href} className="link">
            {labels.more}
          </Link>
        </p>
        <button type="button" className={buttonClass("primary")} onClick={accept}>
          {labels.accept}
        </button>
      </div>
    </section>
  );
}
