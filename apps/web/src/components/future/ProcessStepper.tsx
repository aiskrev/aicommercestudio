"use client";

import { type KeyboardEvent, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { ProcessStage } from "@/content/v5-types";

/**
 * Interactive project timeline (Future Commerce §4): Discovery → Design → Development → Testing → Launch →
 * Maintenance. The stages are WAI-ARIA tabs inside the ordered list (← → ↑ ↓ Home End), the panel shows what you get
 * and what we need from you. A progress hairline above the stages fills up to the selected stage (260 ms). The six
 * stage panels share one grid cell (.swap-stack), so the panel keeps the height of the longest one and switching
 * never moves the content below; the outgoing panel fades out, the new one fades in. Without JavaScript the first
 * stage's panel is shown. The stage list is a plain grid, so touch scrolling on phones stays native.
 */
export function ProcessStepper({
  steps,
  label,
  outputLabel,
  inputLabel,
  testId,
}: {
  steps: ProcessStage[];
  label: string;
  outputLabel: string;
  inputLabel: string;
  testId?: string;
}) {
  const [selected, setSelected] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();
  const tabId = (index: number) => `${base}-stage-${index}`;
  const panelId = `${base}-panel`;

  const select = (index: number) => {
    setSelected(index);
    setSwapped(true);
  };

  function onKeyDown(event: KeyboardEvent<HTMLOListElement>) {
    const last = steps.length - 1;
    const target = { ArrowRight: selected === last ? 0 : selected + 1, ArrowDown: selected === last ? 0 : selected + 1, ArrowLeft: selected === 0 ? last : selected - 1, ArrowUp: selected === 0 ? last : selected - 1, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
    refs.current[target]?.focus();
  }

  return (
    <div>
      <div className="fc-steps-track" style={{ ["--progress" as string]: (selected + 1) / steps.length }} aria-hidden="true">
        <span />
      </div>
      <ol role="tablist" aria-label={label} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:mt-5 lg:grid-cols-6 lg:gap-3" onKeyDown={onKeyDown} data-testid={testId}>
        {steps.map((item, index) => (
          <li key={item.title} role="presentation" className="min-w-0">
            <button
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={tabId(index)}
              aria-selected={index === selected}
              aria-controls={panelId}
              tabIndex={index === selected ? 0 : -1}
              onClick={() => select(index)}
              className="fc-step h-full"
            >
              <span className="t-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-body-sm font-semibold text-fg">{item.title}</span>
              <span className="hidden text-xs leading-snug text-fg-muted sm:block">{item.text}</span>
            </button>
          </li>
        ))}
      </ol>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={tabId(selected)}
        tabIndex={0}
        className="tab-panel mt-4"
        data-testid="process-stage-panel"
      >
        <div className="swap-stack" data-swapped={swapped}>
          {steps.map((step, index) => {
            const active = index === selected;
            return (
              <div
                key={step.title}
                data-active={active}
                aria-hidden={!active || undefined}
                className="grid gap-4 rounded-[var(--radius-xl)] border border-line-subtle bg-surface-1 p-5 sm:p-6 md:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-8"
              >
                <div>
                  <span className="t-index">
                    {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                  </span>
                  <h3 className="t-h3-lg mt-2">{step.title}</h3>
                </div>
                <div>
                  <p className="t-label flex items-center gap-2">
                    <Icon name="check" className="h-3.5 w-3.5 text-success" />
                    {outputLabel}
                  </p>
                  <p className="mt-2 leading-relaxed text-fg-secondary">{step.output}</p>
                </div>
                <div>
                  <p className="t-label flex items-center gap-2">
                    <Icon name="users" className="h-3.5 w-3.5 text-brand" />
                    {inputLabel}
                  </p>
                  <p className="mt-2 leading-relaxed text-fg-secondary">{step.input}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
