import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AnalyticsEvent,
  cleanLabel,
  createCollector,
  describeClick,
  isMeasuredPath,
  trackingAllowed,
} from "@/lib/site-analytics";

const ORIGIN = "https://ai-commercestudio.com";

function click(html: string, selector = "[data-hit]") {
  document.body.innerHTML = html;
  return describeClick(document.querySelector(selector), ORIGIN);
}

describe("what is measured", () => {
  it("measures public pages only, never the customer area", () => {
    expect(isMeasuredPath("/bg")).toBe(true);
    expect(isMeasuredPath("/en/services/seo")).toBe(true);
    expect(isMeasuredPath("/bg/konto")).toBe(false);
    expect(isMeasuredPath("/bg/konto/vhod")).toBe(false);
    expect(isMeasuredPath("/en/account/plan")).toBe(false);
    expect(isMeasuredPath("/admin")).toBe(false);
    expect(isMeasuredPath("/bgx")).toBe(false);
  });

  it("respects Do Not Track and Global Privacy Control", () => {
    expect(trackingAllowed({ doNotTrack: null })).toBe(true);
    expect(trackingAllowed({ doNotTrack: "0" })).toBe(true);
    expect(trackingAllowed({ doNotTrack: "1" })).toBe(false);
    expect(trackingAllowed({ doNotTrack: "yes" })).toBe(false);
    expect(trackingAllowed({ doNotTrack: null, globalPrivacyControl: true })).toBe(false);
  });

  it("drops a label that looks like contact data", () => {
    expect(cleanLabel("  Поискайте \n оферта ")).toBe("Поискайте оферта");
    expect(cleanLabel("contact@example.com")).toBeUndefined();
    expect(cleanLabel("+359 882 377 753")).toBeUndefined();
    expect(cleanLabel("Етап 2 от 3")).toBe("Етап 2 от 3");
    expect(cleanLabel("   ")).toBeUndefined();
    expect(cleanLabel("x".repeat(200))).toHaveLength(80);
  });
});

describe("describeClick", () => {
  it("names an internal link and keeps only its path", () => {
    expect(click('<a data-hit href="/bg/kontakti?tip=oferta#form">Поискайте оферта</a>')).toEqual({
      label: "Поискайте оферта",
      target: "/bg/kontakti",
    });
    expect(click('<a data-hit href="https://ai-commercestudio.com/en/">Home</a>')).toEqual({ label: "Home", target: "/en" });
  });

  it("uses the child of a link and prefers data-track, then aria-label", () => {
    expect(click('<a href="/bg/uslugi"><span data-hit>Услуги</span></a>')).toEqual({ label: "Услуги", target: "/bg/uslugi" });
    expect(click('<a data-hit data-track="nav:services" aria-label="Услуги" href="/bg/uslugi">x</a>')?.label).toBe("nav:services");
    expect(click('<a data-hit aria-label="Търсене" href="/bg/x"><svg></svg></a>')?.label).toBe("Търсене");
  });

  it("keeps only the host of an outside link and never an e-mail or a number", () => {
    expect(click('<a data-hit href="https://www.example.com/private/path?x=1">Блог</a>')).toEqual({ label: "Блог", target: "example.com" });
    expect(click('<a data-hit href="mailto:me@example.com">me@example.com</a>')).toEqual({ label: undefined, target: "mailto" });
    expect(click('<a data-hit href="tel:+359882377753">+359 882 377 753</a>')).toEqual({ label: undefined, target: "tel" });
  });

  it("records a button by its name", () => {
    expect(click("<button data-hit>Изпратете запитването</button>")).toEqual({ label: "Изпратете запитването", target: undefined });
  });

  it("ignores fields, plain text, in-page anchors, script links and opted-out areas", () => {
    expect(click('<input data-hit value="secret">')).toBeNull();
    expect(click("<textarea data-hit>secret</textarea>")).toBeNull();
    expect(click("<p data-hit>just text</p>")).toBeNull();
    expect(click('<a data-hit href="#top">Нагоре</a>')).toBeNull();
    expect(click('<a data-hit href="javascript:void(0)">x</a>')).toBeNull();
    expect(click('<div data-no-track><a data-hit href="/bg">Начало</a></div>')).toBeNull();
    expect(describeClick(null, ORIGIN)).toBeNull();
  });
});

describe("collector", () => {
  const event = (n: number): AnalyticsEvent => ({ type: "view", path: `/bg/p${n}`, locale: "bg" });

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends the waiting events after a short delay, in one request", async () => {
    const send = vi.fn(async () => ({ enabled: true }));
    const collector = createCollector({ send, delay: 1000 });
    collector.push(event(1));
    collector.push(event(2));
    expect(send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith([event(1), event(2)]);
  });

  it("sends at once when a batch is full and never more than twenty at a time", async () => {
    const send = vi.fn<(events: AnalyticsEvent[]) => Promise<{ enabled: boolean }>>().mockResolvedValue({ enabled: true });
    const collector = createCollector({ send, batch: 3 });
    for (let n = 0; n < 3; n += 1) collector.push(event(n));
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);

    const bulk = createCollector({ send, batch: 1000, delay: 10 });
    for (let n = 0; n < 45; n += 1) bulk.push(event(n));
    await bulk.flush();
    expect(send.mock.calls.slice(1).map((call) => call[0].length)).toEqual([20, 20, 5]);
  });

  it("stops for good when the server says statistics are off", async () => {
    const send = vi.fn(async () => ({ enabled: false }));
    const collector = createCollector({ send, delay: 10 });
    collector.push(event(1));
    await vi.advanceTimersByTimeAsync(10);
    expect(collector.stopped).toBe(true);
    collector.push(event(2));
    await collector.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps going when a request fails", async () => {
    const send = vi.fn(async () => null);
    const collector = createCollector({ send, delay: 10 });
    collector.push(event(1));
    await vi.advanceTimersByTimeAsync(10);
    expect(collector.stopped).toBe(false);
  });
});
