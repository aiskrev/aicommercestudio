/**
 * Anonymous, cookieless site statistics (docs/ANALYTICS.md). Everything here runs in the browser and only
 * decides what may be sent: a page path, the visible name of a link or button and where it leads. Nothing
 * typed into a field, no address and no number is ever read.
 */

export type AnalyticsKind = "view" | "click" | "tool";

export interface AnalyticsEvent {
  type: AnalyticsKind;
  path: string;
  locale: "bg" | "en";
  label?: string;
  target?: string;
  referrer?: string;
}

/** The customer area is private; it is never measured (the API refuses these paths as well). */
const PRIVATE_PREFIXES = ["/bg/konto", "/en/account", "/bg/otkaz-ot-marketing", "/en/marketing-opt-out"];
const MAX_LABEL = 80;
const DIGITS = /\d/g;

export function isMeasuredPath(path: string): boolean {
  return /^\/(bg|en)(\/|$)/.test(path) && !PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Respect Do Not Track and Global Privacy Control: nothing is sent at all. */
export function trackingAllowed(nav: Pick<Navigator, "doNotTrack"> & { globalPrivacyControl?: boolean }): boolean {
  const dnt = nav.doNotTrack;
  return !(dnt === "1" || dnt === "yes" || nav.globalPrivacyControl === true);
}

/** A label that looks like contact data is not sent (the API drops it too). */
export function cleanLabel(value: string | null | undefined): string | undefined {
  const label = (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LABEL);
  if (!label || label.includes("@") || (label.match(DIGITS)?.length ?? 0) >= 6) return undefined;
  return label;
}

/**
 * Describes a click on a link or button: its visible name and where it leads. Returns `null` for anything
 * else (fields, plain text, links to the same page section). Outside links keep only their host; e-mail
 * and telephone links send just `mailto` or `tel`.
 */
export function describeClick(
  start: EventTarget | null,
  origin: string,
): { label?: string; target?: string } | null {
  if (!(start instanceof Element)) return null;
  const control = start.closest("a[href], button");
  if (!control || control.closest("[data-no-track]")) return null;

  const label = cleanLabel(control.getAttribute("data-track") ?? control.getAttribute("aria-label") ?? control.textContent);
  let target: string | undefined;

  if (control instanceof HTMLAnchorElement) {
    const href = control.getAttribute("href") ?? "";
    if (href.startsWith("mailto:")) target = "mailto";
    else if (href.startsWith("tel:")) target = "tel";
    else if (href.startsWith("#") || href.toLowerCase().startsWith("javascript:")) return null;
    else {
      try {
        const url = new URL(href, origin);
        if (url.origin === origin) target = url.pathname.length > 1 ? url.pathname.replace(/\/$/, "") : url.pathname;
        else if (url.protocol === "http:" || url.protocol === "https:") target = url.hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    }
  }
  if (!label && !target) return null;
  return { label, target };
}

export interface Collector {
  push(event: AnalyticsEvent): void;
  flush(): Promise<void>;
  /** True after the server said statistics are off: nothing more is queued or sent. */
  readonly stopped: boolean;
}

export interface CollectorOptions {
  send: (events: AnalyticsEvent[]) => Promise<{ enabled: boolean } | null>;
  /** Flush when this many events are waiting. */
  batch?: number;
  /** Flush this long after the first waiting event (ms). */
  delay?: number;
  schedule?: (callback: () => void, ms: number) => unknown;
  cancel?: (handle: unknown) => void;
}

/** Collects events and sends them in small batches; stops for good when the server says it is switched off. */
export function createCollector({
  send,
  batch = 10,
  delay = 4000,
  schedule = (callback, ms) => setTimeout(callback, ms),
  cancel = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: CollectorOptions): Collector {
  let queue: AnalyticsEvent[] = [];
  let timer: unknown;
  let stopped = false;

  async function flush() {
    if (timer !== undefined) {
      cancel(timer);
      timer = undefined;
    }
    if (stopped || queue.length === 0) return;
    const events = queue.slice(0, 20);
    queue = queue.slice(20);
    const answer = await send(events);
    if (answer && answer.enabled === false) {
      stopped = true;
      queue = [];
    }
    if (!stopped && queue.length > 0) await flush();
  }

  return {
    get stopped() {
      return stopped;
    },
    push(event) {
      if (stopped) return;
      queue.push(event);
      if (queue.length >= batch) void flush();
      else if (timer === undefined) timer = schedule(() => void flush(), delay);
    },
    flush,
  };
}

/** Sends one batch to the API; a failure is ignored (statistics never get in the visitor's way). */
export async function postEvents(events: AnalyticsEvent[]): Promise<{ enabled: boolean } | null> {
  try {
    const response = await fetch("/api/public/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
      keepalive: true,
      credentials: "same-origin",
    });
    return response.ok ? ((await response.json()) as { enabled: boolean }) : null;
  } catch {
    return null;
  }
}
