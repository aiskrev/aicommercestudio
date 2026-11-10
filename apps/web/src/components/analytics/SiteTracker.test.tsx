import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SiteTracker } from "@/components/analytics/SiteTracker";
import { trackToolEvent } from "@/lib/analytics";

let pathname = "/bg";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

type Body = { events: { type: string; path: string; label?: string; target?: string; referrer?: string }[] };

function sentEvents(fetchMock: ReturnType<typeof vi.fn>): Body["events"] {
  return fetchMock.mock.calls.flatMap((call) => (JSON.parse((call[1] as RequestInit).body as string) as Body).events);
}

describe("SiteTracker", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    pathname = "/bg";
    window.history.replaceState({}, "", "/bg");
    fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ enabled: true }) }));
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("sends a page view with the path and the referring page of the first view only", async () => {
    Object.defineProperty(document, "referrer", { value: "https://www.google.com/search?q=x", configurable: true });
    const { rerender } = render(<SiteTracker locale="bg" />);
    pathname = "/bg/uslugi";
    window.history.replaceState({}, "", "/bg/uslugi");
    rerender(<SiteTracker locale="bg" />);
    await vi.advanceTimersByTimeAsync(5000);

    const events = sentEvents(fetchMock);
    expect(events.map((e) => [e.type, e.path])).toEqual([
      ["view", "/bg"],
      ["view", "/bg/uslugi"],
    ]);
    expect(events[0].referrer).toBe("https://www.google.com/search?q=x");
    expect(events[1].referrer).toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/public/analytics");
  });

  it("sends a click on a link with its name and destination, and nothing from fields", async () => {
    document.body.innerHTML = '<a id="go" href="/bg/kontakti?x=1">Заявете консултация</a><input id="f" value="secret" />';
    render(<SiteTracker locale="bg" />);
    document.getElementById("go")!.click();
    document.getElementById("f")!.click();
    await vi.advanceTimersByTimeAsync(5000);

    const clicks = sentEvents(fetchMock).filter((e) => e.type === "click");
    expect(clicks).toEqual([{ type: "click", path: "/bg", locale: "bg", label: "Заявете консултация", target: "/bg/kontakti" }]);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("secret");
  });

  it("forwards tool events with the tool and the event name only", async () => {
    render(<SiteTracker locale="bg" />);
    trackToolEvent({ name: "tool_started", tool: "advisor", locale: "bg" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(sentEvents(fetchMock).find((e) => e.type === "tool")).toMatchObject({ label: "advisor:tool_started", path: "/bg" });
  });

  it("sends nothing for Do Not Track visitors, and nothing from the customer area", async () => {
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    render(<SiteTracker locale="bg" />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
    pathname = "/bg/konto";
    window.history.replaceState({}, "", "/bg/konto");
    render(<SiteTracker locale="bg" />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops after the server says statistics are off", async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ enabled: false }) }));
    const { rerender } = render(<SiteTracker locale="bg" />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    pathname = "/bg/uslugi";
    window.history.replaceState({}, "", "/bg/uslugi");
    rerender(<SiteTracker locale="bg" />);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
