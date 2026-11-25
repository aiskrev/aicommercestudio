"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { useSwapDirection } from "@/components/motion/indicator";
import { prefersReducedMotion } from "@/components/motion/reveal";
import { Icon } from "@/components/ui/Icon";
import type { ProcessStage } from "@/content/v5-types";

/** Same query as `.process-narrative` in globals.css: the pinned scroll narrative is on only here. */
const NARRATIVE = "(min-width: 64rem) and (min-height: 40rem) and (prefers-reduced-motion: no-preference)";

/**
 * Interactive project timeline (Future Commerce §4): Discovery → Design → Development → Testing → Launch →
 * Maintenance. The stages are WAI-ARIA tabs (← → ↑ ↓ Home End); the panel shows what you get and what we need.
 *
 * Desktop (≥ 64rem wide, ≥ 40rem tall, no reduced motion): a scroll narrative about three viewport heights tall.
 * The stages and the panel stay pinned (CSS `position: sticky`, no scroll hijacking) while the page scrolls past six
 * invisible sentinels; one IntersectionObserver makes the stage whose sentinel crosses the reading line active. The
 * progress rail is scrubbed by the same scroll (`animation-timeline: view()`, where supported). Clicking or using
 * the arrow keys still selects a stage, and the page scrolls to that stage's part of the narrative so scroll and
 * selection agree. Phones and tablets: a vertical stepper with a rail, no pinning. Without JavaScript the
 * narrative is not pinned (noscript style) and the first stage is shown.
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
  const direction = useSwapDirection(
    steps.map((_, index) => index),
    selected,
  );
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const sentinels = useRef<(HTMLSpanElement | null)[]>([]);
  // While the page scrolls to a stage chosen by click or keyboard, the sentinels it passes are ignored.
  const locked = useRef(false);
  const base = useId();
  const tabId = (index: number) => `${base}-stage-${index}`;
  const panelId = `${base}-panel`;

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(NARRATIVE);
    let observer: IntersectionObserver | null = null;
    const connect = () => {
      observer?.disconnect();
      observer = null;
      if (!query.matches) return;
      // The reading line: a thin band at 45 % of the viewport height.
      observer = new IntersectionObserver(
        (entries) => {
          if (locked.current) return;
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const index = Number((entry.target as HTMLElement).dataset.stage);
            if (Number.isInteger(index)) setSelected(index);
          }
        },
        { rootMargin: "-45% 0px -54% 0px" },
      );
      for (const sentinel of sentinels.current) if (sentinel) observer.observe(sentinel);
    };
    connect();
    query.addEventListener("change", connect);
    return () => {
      query.removeEventListener("change", connect);
      observer?.disconnect();
    };
  }, []);

  const select = (index: number) => {
    setSelected(index);
    const sentinel = sentinels.current[index];
    if (!sentinel || typeof window.matchMedia !== "function" || !window.matchMedia(NARRATIVE).matches) return;
    const rect = sentinel.getBoundingClientRect();
    const top = window.scrollY + rect.top + rect.height / 2 - window.innerHeight * 0.45;
    locked.current = true;
    const release = () => {
      locked.current = false;
    };
    window.addEventListener("scrollend", release, { once: true });
    window.setTimeout(release, 1200); // browsers without scrollend
    window.scrollTo({ top, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  function onKeyDown(event: KeyboardEvent<HTMLOListElement>) {
    const last = steps.length - 1;
    const target = { ArrowRight: selected === last ? 0 : selected + 1, ArrowDown: selected === last ? 0 : selected + 1, ArrowLeft: selected === 0 ? last : selected - 1, ArrowUp: selected === 0 ? last : selected - 1, Home: 0, End: last }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
    refs.current[target]?.focus({ preventScroll: true });
  }

  return (
    <div className="process-narrative" style={{ ["--stages" as string]: steps.length }}>
      <noscript>
        <style>{".process-narrative{height:auto!important}.process-sticky{position:static!important}"}</style>
      </noscript>
      <div className="process-sentinels" aria-hidden="true">
        {steps.map((step, index) => (
          <span
            key={step.title}
            data-stage={index}
            ref={(el) => {
              sentinels.current[index] = el;
            }}
          />
        ))}
      </div>
      <div className="process-sticky">
        <div className="process-steps" style={{ ["--progress" as string]: (selected + 1) / steps.length }}>
          <div className="fc-steps-track" aria-hidden="true">
            <span />
          </div>
          <ol role="tablist" aria-label={label} className="process-list" onKeyDown={onKeyDown} data-testid={testId}>
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
                  data-done={index < selected || undefined}
                >
                  <span className="t-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="text-body-sm font-semibold text-fg">{item.title}</span>
                  <span className="hidden text-xs leading-snug text-fg-muted sm:block">{item.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div role="tabpanel" id={panelId} aria-labelledby={tabId(selected)} tabIndex={0} className="tab-panel mt-4" data-testid="process-stage-panel">
          <div className="swap-stack swap-stack-detail" data-swapped={direction !== null} data-dir={direction ?? undefined}>
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
    </div>
  );
}
