import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cx } from "@/components/ui/primitives";

/**
 * Lightweight product previews (docs/V5_DESIGN_SYSTEM.md → "Product preview"). Pure HTML/CSS shapes: no images,
 * no animation library, no client JavaScript. The drawing is decorative (`aria-hidden`); the caption under it says
 * what it is and that it is a demonstration with sample data, so it can never be read as a client project.
 */
export type PreviewKind = "static" | "interactive" | "store" | "portal" | "ai";

const URLS: Record<PreviewKind, string> = {
  static: "studio-example.eu",
  interactive: "studio-example.eu/calculator",
  store: "shop-example.eu/catalogue",
  portal: "portal-example.eu/requests",
  ai: "workflow · demo",
};

export function UiPreview({
  kind,
  caption,
  className,
  compact = false,
  testId,
}: {
  kind: PreviewKind;
  /**
   * Visible caption; always states that this is a demonstration. Leave it out only where the surrounding
   * element already carries that caption (a composite hero, a labelled card).
   */
  caption?: string;
  className?: string;
  compact?: boolean;
  testId?: string;
}) {
  const Wrapper = caption ? "figure" : "div";
  return (
    <Wrapper className={cx("min-w-0", className)} data-testid={testId ?? `preview-${kind}`} data-preview={kind}>
      <div className="ui-frame" aria-hidden="true">
        <div className="ui-bar">
          <span className="ui-dots">
            <i />
            <i />
            <i />
          </span>
          <span className="ui-url">{URLS[kind]}</span>
        </div>
        <div className={cx("ui-screen", compact ? "p-3" : "p-4 sm:p-5")}>{SCREENS[kind](compact)}</div>
      </div>
      {caption && <figcaption className="t-label mt-3">{caption}</figcaption>}
    </Wrapper>
  );
}

const SCREENS: Record<PreviewKind, (compact: boolean) => ReactNode> = {
  static: (compact) => (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <span className="ui-block h-3 w-14" />
        <span className="flex gap-2">
          <span className="ui-line w-8" />
          <span className="ui-line w-8" />
          <span className="ui-line w-8" />
        </span>
      </div>
      <div className="grid gap-2 py-2">
        <span className="ui-line h-3 w-4/5 bg-fg-secondary/60" />
        <span className="ui-line h-3 w-3/5 bg-fg-secondary/60" />
        <span className="ui-line mt-1 w-2/3" />
        <span className="ui-block ui-accent mt-2 h-5 w-20" />
      </div>
      {!compact && (
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="grid gap-1.5 rounded-[var(--radius-sm)] border border-line-subtle p-2">
              <span className="ui-block h-4 w-4" />
              <span className="ui-line w-full" />
              <span className="ui-line w-2/3" />
            </span>
          ))}
        </div>
      )}
    </div>
  ),
  interactive: (compact) => (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
      <div className="grid gap-2.5">
        <span className="flex gap-1.5">
          <span className="ui-block ui-accent h-1.5 flex-1" />
          <span className="ui-block ui-accent h-1.5 flex-1" />
          <span className="ui-block h-1.5 flex-1" />
        </span>
        {[0, 1, 2].slice(0, compact ? 2 : 3).map((i) => (
          <span key={i} className="grid gap-1.5">
            <span className="ui-line w-1/3" />
            <span className="block h-5 rounded-[var(--radius-sm)] border border-line-default bg-surface-1" />
          </span>
        ))}
      </div>
      <div className="grid content-start gap-2 rounded-[var(--radius-md)] border border-brand/35 bg-surface-1 p-3">
        <span className="ui-line w-1/2" />
        <span className="ui-block h-6 w-3/4 bg-fg-secondary/60" />
        <span className="ui-line w-full" />
        <span className="ui-block ui-accent mt-1 h-5 w-2/3" />
      </div>
    </div>
  ),
  store: (compact) => (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <span className="ui-block h-3 w-16" />
        <span className="ui-chip">
          <Icon name="cart" className="h-3 w-3 text-brand" />2
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="grid gap-1.5">
            <span className={cx("ui-block aspect-square w-full", i === 1 && "ui-cyan opacity-60")} />
            <span className="ui-line w-full" />
            <span className="ui-line w-1/2 bg-fg-secondary/60" />
          </span>
        ))}
      </div>
      {!compact && (
        <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-line-subtle bg-surface-1 px-3 py-2">
          <span className="ui-line w-1/3" />
          <span className="ui-block ui-accent h-5 w-16" />
        </div>
      )}
    </div>
  ),
  portal: (compact) => (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
      <div className="grid content-start gap-2 border-r border-line-subtle pr-3">
        <span className="ui-block h-3 w-full" />
        <span className="ui-line w-full" />
        <span className="ui-line w-4/5" />
        <span className="ui-line w-full" />
      </div>
      <div className="grid content-start gap-2">
        <span className="flex gap-2">
          <span className="ui-block h-8 flex-1" />
          <span className="ui-block h-8 flex-1" />
          <span className="ui-block ui-accent h-8 flex-1 opacity-70" />
        </span>
        {(compact ? [0, 1] : [0, 1, 2]).map((i) => (
          <span key={i} className="flex items-center gap-2 border-b border-line-subtle py-1.5">
            <span className="ui-line flex-1" />
            <span className={cx("h-2 w-2 rounded-full", i === 0 ? "bg-success" : i === 1 ? "bg-warning" : "bg-brand")} />
          </span>
        ))}
      </div>
    </div>
  ),
  ai: (compact) => (
    <ol className="grid gap-2">
      {(
        [
          { icon: "mail", tone: "text-fg-secondary" },
          { icon: "sparkles", tone: "text-brand-2" },
          { icon: "users", tone: "text-warning" },
          { icon: "check", tone: "text-success" },
        ] as const
      )
        .slice(0, compact ? 3 : 4)
        .map((step, index) => (
          <li key={step.icon} className="flex items-center gap-3">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line-default bg-surface-1">
              <Icon name={step.icon} className={cx("h-3.5 w-3.5", step.tone)} />
            </span>
            <span className="grid flex-1 gap-1.5">
              <span className="ui-line w-2/5 bg-fg-secondary/50" />
              <span className="ui-line" style={{ width: `${70 - index * 10}%` }} />
            </span>
          </li>
        ))}
    </ol>
  ),
};
