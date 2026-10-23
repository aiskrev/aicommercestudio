"use client";

import type { ReactNode } from "react";

import { useAdminI18n } from "@/components/admin/AdminI18n";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Alert, Button, cx, Skeleton } from "@/components/ui/primitives";
import { fmt } from "@/i18n/admin";
import { statusTone } from "@/lib/admin-labels";
import type { LeadStatus } from "@/lib/admin-types";

export function StatusBadge({ status }: { status: LeadStatus }) {
  const { labels } = useAdminI18n();
  return (
    <span className={cx("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1", statusTone[status])}>
      {labels.status[status] ?? status}
    </span>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", tone)}>{children}</span>;
}

export function Panel({
  title,
  children,
  actions,
  className,
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("card overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Generic loading placeholder: skeleton rows plus an accessible status message. */
export function LoadingState({ label, rows = 4 }: { label?: string; rows?: number }) {
  const { t } = useAdminI18n();
  return (
    <div role="status" aria-live="polite" className="grid gap-3 py-2" data-testid="loading">
      <span className="sr-only">{label ?? t.common.loading}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2">
            <Skeleton className={cx("h-3.5", index % 2 ? "w-2/3" : "w-1/2")} />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  const { t } = useAdminI18n();
  return (
    <div role="status" aria-live="polite" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="loading">
      <span className="sr-only">{t.common.loadingStats}</span>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="card p-5">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="mt-4 h-8 w-16" />
          <Skeleton className="mt-3 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  requestId,
}: {
  message: string;
  onRetry?: () => void;
  requestId?: string | null;
}) {
  const { t } = useAdminI18n();
  return (
    <Alert tone="error" role="alert" title={t.common.loadError}>
      <p>{message}</p>
      {requestId && <p className="mt-1 font-mono text-xs opacity-80">{fmt(t.common.supportCode, { id: requestId })}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry} className="mt-3">
          {t.common.retry}
        </Button>
      )}
    </Alert>
  );
}

export function EmptyState({
  icon = "inbox",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="empty-state">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-gradient-to-br from-cyan-400/10 to-violet-500/10 text-cyan-200">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-1 font-semibold text-white">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-400">{description}</p>}
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: number | string; hint?: string; icon: IconName }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
