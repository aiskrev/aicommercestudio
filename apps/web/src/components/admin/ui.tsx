import type { ReactNode } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { buttonClass, cx } from "@/components/ui/primitives";
import { statusLabels, statusTone } from "@/lib/admin-labels";
import type { LeadStatus } from "@/lib/admin-types";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span className={cx("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1", statusTone[status])}>
      {statusLabels[status] ?? status}
    </span>
  );
}

export function Pill({ children, tone }: { children: ReactNode; tone: string }) {
  return <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1", tone)}>{children}</span>;
}

export function Panel({ title, children, actions, className }: { title?: string; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-2xl border border-white/[0.08] bg-ink-900/70", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function LoadingState({ label = "Зареждане…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-sm text-slate-400" data-testid="loading">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-xl border border-rose-400/30 bg-rose-400/[0.07] p-5 text-sm text-rose-100">
      <p className="flex gap-2">
        <Icon name="alert" className="h-5 w-5 shrink-0 text-rose-300" />
        {message}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={buttonClass("secondary")}>
          Опитай отново
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, description, action }: { icon?: IconName; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid="empty-state">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04] text-slate-400">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="font-semibold text-white">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate-400">{description}</p>}
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: number | string; hint?: string; icon: IconName }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-ink-900/70 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{label}</p>
        <Icon name={icon} className="h-5 w-5 text-cyan-300" />
      </div>
      <p className="mt-3 font-display text-3xl font-semibold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
