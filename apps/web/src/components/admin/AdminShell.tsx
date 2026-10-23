"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { LogoMark } from "@/components/layout/Logo";
import { Icon, type IconName } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import { adminFetch } from "@/lib/admin-api";
import { routes } from "@/lib/routes";

const NAV: { href: string; label: string; icon: IconName; exact?: boolean }[] = [
  { href: routes.admin, label: "Табло", icon: "dashboard", exact: true },
  { href: routes.adminLeads, label: "Запитвания", icon: "inbox" },
  { href: routes.adminAiActions, label: "AI одобрения", icon: "bot" },
  { href: routes.adminActivity, label: "Активност", icon: "activity" },
  { href: routes.adminAccount, label: "Акаунт и сесии", icon: "lock" },
];

export function AdminShell({ userName, children }: { userName: string; children: ReactNode }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await adminFetch("/api/admin/auth/logout", { method: "POST" });
    } finally {
      window.location.assign(routes.adminLogin);
    }
  }

  const active = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="border-b border-white/[0.06] bg-ink-900/80 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-5 lg:py-6">
          <Link href={routes.admin} className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-7" />
            <span className="text-sm font-semibold text-white">Администрация</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white lg:hidden"
          >
            <Icon name="logout" className="h-4 w-4" />
            Изход
          </button>
        </div>
        <nav aria-label="Администрация" className="overflow-x-auto px-2 pb-3 lg:px-3">
          <ul className="flex gap-1 lg:flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active(item) ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium",
                    active(item) ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-white",
                  )}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="hidden px-5 pb-6 lg:absolute lg:bottom-0 lg:block lg:w-64">
          <p className="truncate text-sm text-white">{userName}</p>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="mt-3 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
          >
            <Icon name="logout" className="h-4 w-4" />
            {loggingOut ? "Изход…" : "Изход"}
          </button>
          <Link href="/" className="mt-3 block text-xs text-slate-400 hover:text-slate-300">
            ← Към сайта
          </Link>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {children}
      </main>
    </div>
  );
}

export function AdminPageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-400">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
