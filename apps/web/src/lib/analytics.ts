import type { Locale } from "@/i18n/config";
import type { ToolKey } from "@/lib/tools";

/**
 * Privacy-aware product analytics for the interactive tools.
 *
 * Events carry only an allow-list of enumerated or numeric fields — never answers, free text,
 * names, e-mails or anything typed by the visitor. No data leaves the browser today: events are
 * dispatched as a DOM `acs:analytics` CustomEvent so a consent-aware sink can be attached later
 * (`registerAnalyticsSink`) without touching the tools.
 */
export type ToolEventName = "tool_opened" | "tool_started" | "step_completed" | "tool_completed" | "export_requested";

export type ExportFormat = "print" | "text" | "link";

export interface ToolEvent {
  name: ToolEventName;
  tool: ToolKey;
  locale: Locale;
  /** 1-based step number (step_completed). */
  step?: number;
  totalSteps?: number;
  /** Enumerated result bucket (e.g. readiness level), never a raw answer. */
  result?: string;
  format?: ExportFormat;
}

type Sink = (event: ToolEvent) => void;

const sinks = new Set<Sink>();
const RESULT_PATTERN = /^[a-z_]{1,32}$/;
const FORMATS: ReadonlySet<string> = new Set(["print", "text", "link"]);

/** Builds the event from allow-listed fields only; anything else is dropped. */
export function sanitizeToolEvent(input: ToolEvent & Record<string, unknown>): ToolEvent {
  const event: ToolEvent = { name: input.name, tool: input.tool, locale: input.locale };
  const int = (value: unknown) => (Number.isInteger(value) && (value as number) >= 0 && (value as number) < 100 ? (value as number) : undefined);
  const step = int(input.step);
  const totalSteps = int(input.totalSteps);
  if (step !== undefined) event.step = step;
  if (totalSteps !== undefined) event.totalSteps = totalSteps;
  if (typeof input.result === "string" && RESULT_PATTERN.test(input.result)) event.result = input.result;
  if (typeof input.format === "string" && FORMATS.has(input.format)) event.format = input.format as ExportFormat;
  return event;
}

export function registerAnalyticsSink(sink: Sink): () => void {
  sinks.add(sink);
  return () => sinks.delete(sink);
}

export function trackToolEvent(event: ToolEvent): void {
  const clean = sanitizeToolEvent(event as ToolEvent & Record<string, unknown>);
  for (const sink of sinks) sink(clean);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("acs:analytics", { detail: clean }));
}
