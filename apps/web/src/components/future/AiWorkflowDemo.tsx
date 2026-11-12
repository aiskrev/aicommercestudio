"use client";

import { useState } from "react";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Button, cx } from "@/components/ui/primitives";
import type { AiActor, FutureContent } from "@/content/v5-types";

const ACTOR_ICON: Record<AiActor, IconName> = { system: "inbox", ai: "sparkles", human: "users" };

/**
 * Interactive AI workflow demonstration (Future Commerce §7). Pre-recorded steps over made-up inputs: nothing is
 * sent anywhere, no AI model is called and no real system is touched — the panel says so above the controls.
 * The run advances one step per click and stops at the human approval step, which only a person can complete.
 * Progress is announced in a polite live region.
 */
export function AiWorkflowDemo({ text }: { text: FutureContent["aiDemo"] }) {
  const [sampleKey, setSampleKey] = useState(text.samples[0].key);
  // -1 = not started; 0..steps-1 = the step reached; the last step waits for the person.
  const [position, setPosition] = useState(-1);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const sample = text.samples.find((item) => item.key === sampleKey) ?? text.samples[0];
  const last = text.steps.length - 1;
  const waiting = position === last && decision === null;

  const choose = (key: typeof sampleKey) => {
    setSampleKey(key);
    setPosition(-1);
    setDecision(null);
  };
  const restart = () => {
    setPosition(-1);
    setDecision(null);
  };

  const state = (index: number): "pending" | "active" | "done" | "waiting" => {
    if (index < position || (index === position && decision !== null)) return "done";
    if (index === position) return text.steps[index].actor === "human" ? "waiting" : "active";
    return "pending";
  };

  const status = decision === "approved" ? text.approved : decision === "rejected" ? text.rejected : waiting ? text.waiting : position >= 0 ? `${text.steps[position].title}: ${sample.outputs[position]}` : "";

  return (
    <div className="grid gap-6 rounded-[var(--radius-2xl)] border border-line-default bg-surface-1 p-5 shadow-[var(--shadow-panel)] sm:p-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-10" data-testid="ai-demo">
      <div className="min-w-0">
        <p className="alert alert-info text-body-sm" data-testid="ai-demo-disclaimer">
          <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{text.disclaimer}</span>
        </p>
        <fieldset className="mt-5">
          <legend className="t-label">{text.samplesLabel}</legend>
          <div className="mt-2 grid gap-2">
            {text.samples.map((item) => (
              <label key={item.key} className="fc-choice">
                <input type="radio" name="ai-demo-sample" value={item.key} checked={sampleKey === item.key} onChange={() => choose(item.key)} />
                <span>
                  <span className="fc-choice-mark" aria-hidden="true" />
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5 rounded-[var(--radius-lg)] border border-line-subtle bg-surface-page p-4">
          <p className="t-label">{text.inputLabel}</p>
          <p className="mt-2 text-body-sm leading-relaxed text-fg-secondary">{sample.input}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          {position < last && (
            <Button onClick={() => setPosition((value) => value + 1)} icon="arrowRight" data-testid="ai-demo-next">
              {position < 0 ? text.start : text.next}
            </Button>
          )}
          {waiting && (
            <>
              <Button onClick={() => setDecision("approved")} icon="check" data-testid="ai-demo-approve">
                {text.approve}
              </Button>
              <Button variant="secondary" onClick={() => setDecision("rejected")} data-testid="ai-demo-reject">
                {text.reject}
              </Button>
            </>
          )}
          {position >= 0 && (
            <Button variant="ghost" onClick={restart}>
              {text.restart}
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <ol className="grid" data-testid="ai-demo-steps">
          {text.steps.map((step, index) => {
            const current = state(index);
            return (
              <li key={step.key} className="fc-run-step" data-state={current}>
                <span className="fc-run-dot" aria-hidden="true">
                  <Icon name={current === "done" ? "check" : ACTOR_ICON[step.actor]} className="h-4 w-4" />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-fg">{step.title}</span>
                    <span className={cx("badge", step.actor === "ai" ? "badge-accent" : step.actor === "human" ? "badge-warning" : "")}>{text.actors[step.actor]}</span>
                    <span className="text-xs text-fg-subtle">{text.states[current]}</span>
                  </p>
                  {current !== "pending" && <p className="fc-panel-enter mt-1.5 text-body-sm leading-relaxed text-fg-muted">{sample.outputs[index]}</p>}
                </div>
              </li>
            );
          })}
        </ol>
        <p role="status" aria-live="polite" className={cx("mt-2 min-h-6 text-body-sm font-medium", decision === "approved" ? "text-success" : decision === "rejected" ? "text-warning" : "text-fg-secondary")} data-testid="ai-demo-status">
          {status}
        </p>
      </div>
    </div>
  );
}
