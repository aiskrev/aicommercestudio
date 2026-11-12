import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";
import type { ShowcaseItem, ShowcaseKey } from "@/content/v5-types";

const URLS: Record<ShowcaseKey, string> = {
  corporate: "company-example.eu",
  interactive: "company-example.eu/estimate",
  store: "shop-example.eu/new",
  saas: "app-example.eu/requests",
};

/**
 * Large product mock-up of the showcase (Future Commerce). HTML/CSS only, readable sample text from the content
 * file, decorative (`aria-hidden`): the surrounding figure carries the "Demonstration · sample data" caption.
 */
export function ShowcaseMock({ item, className }: { item: ShowcaseItem; className?: string }) {
  return (
    <div className={cx("ui-frame", className)} aria-hidden="true" data-mock={item.key}>
      <div className="ui-bar">
        <span className="ui-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="ui-url">{URLS[item.key]}</span>
      </div>
      <div className="ui-screen fc-mock p-4 sm:p-6">{SCREENS[item.key](item.mock)}</div>
    </div>
  );
}

type Mock = ShowcaseItem["mock"];

const SCREENS: Record<ShowcaseKey, (mock: Mock) => ReactNode> = {
  corporate: (mock) => (
    <div className="grid gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="fc-mock-title text-sm">{mock.brand}</span>
        <span className="hidden gap-4 sm:flex">
          {mock.items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] sm:items-center">
        <div className="grid gap-2">
          <span className="fc-mock-title text-xl leading-tight sm:text-2xl">{mock.title}</span>
          <span>{mock.subtitle}</span>
          <span className="mt-1 flex gap-2">
            <span className="fc-mock-btn">{mock.action}</span>
          </span>
        </div>
        <span className="ui-block hidden aspect-[4/3] w-full sm:block" style={{ background: "linear-gradient(140deg, color-mix(in oklab, var(--color-brand-fill) 45%, transparent), color-mix(in oklab, var(--color-brand-2) 25%, transparent))" }} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {mock.meta.map((label) => (
          <span key={label} className="fc-mock-card grid gap-1.5">
            <Icon name="check" className="h-3.5 w-3.5 text-brand" />
            <span className="font-semibold text-fg">{label}</span>
            <span className="ui-line w-4/5" />
          </span>
        ))}
      </div>
    </div>
  ),
  interactive: (mock) => (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <div className="grid content-start gap-3">
        <span className="flex items-center justify-between">
          <span className="fc-mock-title text-sm">{mock.brand}</span>
          <span>{mock.subtitle}</span>
        </span>
        <span className="flex gap-1.5">
          <span className="ui-block ui-accent h-1.5 flex-1" />
          <span className="ui-block ui-accent h-1.5 flex-1" />
          <span className="ui-block h-1.5 flex-1" />
        </span>
        {mock.items.map((label, index) => (
          <span key={label} className="grid gap-1">
            <span className="font-medium text-fg-secondary">{label}</span>
            <span className={cx("flex h-8 items-center justify-between rounded-[var(--radius-sm)] border bg-surface-1 px-2.5", index === 1 ? "border-brand" : "border-line-default")}>
              <span className="ui-line w-1/3" />
              <Icon name="chevronDown" className="h-3 w-3 text-fg-muted" />
            </span>
          </span>
        ))}
      </div>
      <div className="fc-mock-card grid content-start gap-2 border-brand/40">
        <span className="text-fg-muted">{mock.meta[0]}</span>
        <span className="fc-mock-title text-2xl">{mock.title}</span>
        <span className="grid grid-cols-6 items-end gap-1 pt-2" style={{ height: "4.5rem" }}>
          {[40, 62, 48, 80, 58, 70].map((height, index) => (
            <span key={index} className={cx("fc-mock-bar", index === 3 && "is-cyan")} style={{ height: `${height}%` }} />
          ))}
        </span>
        <span className="fc-mock-btn mt-2 justify-center">{mock.action}</span>
        <span className="text-center text-fg-muted">{mock.meta[1]}</span>
      </div>
    </div>
  ),
  store: (mock) => (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="fc-mock-title text-sm">{mock.brand}</span>
        <span className="ui-chip">
          <Icon name="cart" className="h-3 w-3 text-brand" />
          {mock.meta[0]} · 2
        </span>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="fc-mock-title text-lg">{mock.title}</span>
        <span className="text-fg-muted">{mock.subtitle}</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {mock.items.map((name, index) => (
          <span key={name} className="fc-mock-card grid gap-2 p-2">
            <span
              className="ui-block aspect-square w-full"
              style={{
                background:
                  index === 1
                    ? "color-mix(in oklab, var(--color-brand-2) 30%, var(--color-surface-2))"
                    : index === 2
                      ? "color-mix(in oklab, var(--color-warning) 22%, var(--color-surface-2))"
                      : "color-mix(in oklab, var(--color-brand-fill) 30%, var(--color-surface-2))",
              }}
            />
            <span className="truncate font-semibold text-fg">{name}</span>
            <span className="fc-mock-btn justify-center">{mock.action}</span>
          </span>
        ))}
      </div>
      <span className="flex items-center gap-2 text-fg-muted">
        <Icon name="check" className="h-3.5 w-3.5 text-success" />
        {mock.meta[1]}
      </span>
    </div>
  ),
  saas: (mock) => (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-4">
      <div className="grid content-start gap-2.5 border-r border-line-subtle pr-3">
        <span className="fc-mock-title text-xs">{mock.brand}</span>
        {["dashboard", "inbox", "users", "chart"].map((icon, index) => (
          <span key={icon} className={cx("flex h-7 items-center justify-center rounded-[var(--radius-sm)]", index === 1 ? "bg-surface-3 text-brand" : "text-fg-muted")}>
            <Icon name={icon as "dashboard"} className="h-3.5 w-3.5" />
          </span>
        ))}
      </div>
      <div className="grid content-start gap-3">
        <span className="flex items-center justify-between gap-2">
          <span className="fc-mock-title text-sm">{mock.title}</span>
          <span className="fc-mock-btn">{mock.action}</span>
        </span>
        <span className="grid grid-cols-3 gap-2">
          {mock.meta.map((label, index) => (
            <span key={label} className="fc-mock-card grid gap-1 p-2">
              <span className="text-fg-muted">{label}</span>
              <span className="fc-mock-title text-lg">{[7, 12, 31][index]}</span>
            </span>
          ))}
        </span>
        <span className="grid gap-1.5">
          {mock.items.map((label, index) => (
            <span key={label} className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-line-subtle bg-surface-1 px-2.5 py-2">
              <span className="truncate text-fg-secondary">{label}</span>
              <span className={cx("h-2 w-2 shrink-0 rounded-full", index === 0 ? "bg-brand" : index === 1 ? "bg-warning" : "bg-success")} />
            </span>
          ))}
        </span>
        <span className="text-fg-muted">{mock.subtitle}</span>
      </div>
    </div>
  ),
};
