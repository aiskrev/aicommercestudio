"use client";

import { type CSSProperties, type ReactNode, useState } from "react";

import { useSwapDirection } from "@/components/motion/indicator";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Button, cx } from "@/components/ui/primitives";
import type { AiActor, FutureContent } from "@/content/v5-types";

const ACTOR_ICON: Record<AiActor, IconName> = { system: "inbox", ai: "sparkles", human: "users" };

/** A piece of a stage scene: its order (--k) sets when it enters after the scene changes. */
const piece = (k: number): CSSProperties => ({ ["--k" as string]: k });

/**
 * The stage above the steps: one abstract scene per state (idle, receive, classify, extract, draft, approval), in
 * a directional .swap-stack. Shapes only, no invented data; decorative (aria-hidden) because the steps list and the
 * status below carry the same information as text. Scene pieces enter 90 ms apart (globals.css → .ai-stage).
 */
const SCENES: Record<string, ReactNode> = {
  idle: (
    <div className="ai-tray">
      <i className="ai-slot" />
      <i className="ai-slot" />
      <i className="ai-slot" />
    </div>
  ),
  receive: (
    <div className="ai-row">
      <span className="ai-env ai-piece ai-in-left" style={piece(0)}>
        <Icon name="mail" className="h-5 w-5" />
        <b />
        <b className="w-2/3" />
      </span>
      <Icon name="arrowRight" className="ai-piece ai-in-fade h-4 w-4 text-fg-subtle" style={piece(1)} />
      <span className="ai-box ai-piece ai-in-pop" style={piece(2)}>
        <Icon name="inbox" className="h-5 w-5" />
      </span>
    </div>
  ),
  classify: (
    <div className="ai-row">
      <span className="ai-box is-ai ai-piece ai-in-pop" style={piece(0)}>
        <Icon name="sparkles" className="h-5 w-5" />
      </span>
      <span className="ai-tags">
        <i className="ai-tag ai-piece ai-in-rise" style={piece(1)} />
        <i className="ai-tag is-hit ai-piece ai-in-hit" style={piece(2)} />
        <i className="ai-tag ai-piece ai-in-rise" style={piece(3)} />
      </span>
    </div>
  ),
  extract: (
    <div className="ai-row">
      <span className="ai-doc">
        <b />
        <b className="is-mark ai-piece ai-in-mark" style={piece(0)} />
        <b />
        <b className="is-mark ai-piece ai-in-mark" style={piece(1)} />
        <b className="w-1/2" />
      </span>
      <Icon name="arrowRight" className="ai-piece ai-in-fade h-4 w-4 text-fg-subtle" style={piece(2)} />
      <span className="ai-fields">
        <i className="ai-piece ai-in-left" style={piece(3)} />
        <i className="ai-piece ai-in-left" style={piece(4)} />
        <i className="ai-piece ai-in-left" style={piece(5)} />
      </span>
    </div>
  ),
  draft: (
    <div className="ai-row">
      <span className="ai-box is-ai ai-piece ai-in-pop" style={piece(0)}>
        <Icon name="pen" className="h-5 w-5" />
      </span>
      <span className="ai-lines">
        <i className="ai-piece ai-in-draw" style={piece(1)} />
        <i className="ai-piece ai-in-draw" style={piece(2)} />
        <i className="ai-piece ai-in-draw" style={piece(3)} />
        <i className="w-1/2 ai-piece ai-in-draw" style={piece(4)} />
      </span>
    </div>
  ),
  approve: (
    <div className="ai-row">
      <span className="ai-box is-human ai-piece ai-in-pop" style={piece(0)}>
        <Icon name="users" className="h-5 w-5" />
      </span>
      <span className="ai-gate ai-piece ai-in-rise" style={piece(1)}>
        <i className="is-yes" />
        <i />
      </span>
      <span className="ai-verdict">
        <Icon name="check" className="ai-verdict-yes h-5 w-5" />
        <Icon name="refresh" className="ai-verdict-no h-5 w-5" />
      </span>
    </div>
  ),
};

/**
 * Interactive AI workflow demonstration (Future Commerce §7). Pre-recorded steps over made-up inputs: nothing is
 * sent anywhere, no AI model is called and no real system is touched — the panel says so above the controls.
 * The run advances one step per click and stops at the human approval step, which only a person can complete.
 * Progress is announced in a polite live region. Each step shows its real state (pending → active → done, or
 * waiting for the person): the dot pings once when a step becomes active, the connector fills and the check mark
 * pops in when it completes — driven only by the clicks, with no timers and no simulated "thinking" delay.
 */
export function AiWorkflowDemo({ text }: { text: FutureContent["aiDemo"] }) {
  const [sampleKey, setSampleKey] = useState(text.samples[0].key);
  // -1 = not started; 0..steps-1 = the step reached; the last step waits for the person.
  const [position, setPosition] = useState(-1);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const sample = text.samples.find((item) => item.key === sampleKey) ?? text.samples[0];
  const last = text.steps.length - 1;
  const waiting = position === last && decision === null;
  const scene = position < 0 ? "idle" : text.steps[position].key;
  const scenes = ["idle", ...text.steps.map((step) => step.key)];
  const direction = useSwapDirection(scenes, scene);

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
        <div className="ai-stage" aria-hidden="true" data-scene={scene} data-decision={decision ?? undefined} data-testid="ai-demo-stage">
          <p className="ai-stage-head">
            <span className="ai-stage-led" />
            {position < 0 ? text.samplesLabel : text.steps[position].title}
          </p>
          <div className="swap-stack swap-stack-detail" data-swapped={direction !== null} data-dir={direction ?? undefined}>
            {scenes.map((key) => (
              <div key={key} data-active={key === scene} className="ai-scene">
                {SCENES[key] ?? SCENES.idle}
              </div>
            ))}
          </div>
        </div>
        <ol className="mt-5 grid" data-testid="ai-demo-steps">
          {text.steps.map((step, index) => {
            const current = state(index);
            return (
              <li key={step.key} className="fc-run-step" data-state={current}>
                <span className="fc-run-dot" aria-hidden="true">
                  {/* Remounted when the step completes, so the check mark pops in once (globals.css → .fc-run-step). */}
                  <Icon key={current === "done" ? "done" : "open"} name={current === "done" ? "check" : ACTOR_ICON[step.actor]} className="h-4 w-4" />
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
