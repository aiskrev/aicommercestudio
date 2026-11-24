import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MotionRuntime } from "@/components/motion/MotionRuntime";
import { prefersReducedMotion, reveal, revealGroup } from "@/components/motion/reveal";

vi.mock("next/navigation", () => ({ usePathname: () => "/bg" }));

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let observers: { callback: Callback; observed: Element[]; disconnect: ReturnType<typeof vi.fn> }[] = [];

class FakeObserver {
  callback: Callback;
  observed: Element[] = [];
  disconnect = vi.fn();
  constructor(callback: Callback) {
    this.callback = callback;
    observers.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  unobserve(element: Element) {
    this.observed = this.observed.filter((item) => item !== element);
  }
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as unknown as typeof window.matchMedia;
}

function page() {
  return render(
    <>
      <div data-testid="above" {...reveal()} />
      <ul data-testid="below" {...revealGroup()}>
        <li />
      </ul>
      <MotionRuntime />
    </>,
  );
}

describe("scroll reveal runtime", () => {
  beforeEach(() => {
    observers = [];
    vi.useFakeTimers();
    vi.stubGlobal("IntersectionObserver", FakeObserver);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("server markup is visible: the helpers only add an empty data-reveal", () => {
    expect(reveal()).toEqual({ "data-reveal": "" });
    expect(revealGroup()).toEqual({ "data-reveal": "", "data-reveal-children": "" });
  });

  it("hides only what the observer reports off screen, reveals it once and never hides it again", () => {
    setReducedMotion(false);
    const { getByTestId } = page();
    const [observer] = observers;
    const above = getByTestId("above");
    const below = getByTestId("below");
    expect(observer.observed).toEqual([above, below]);

    act(() => observer.callback([{ target: above, isIntersecting: true }, { target: below, isIntersecting: false }]));
    expect(above.dataset.reveal).toBe(""); // on screen at load: never hidden
    expect(below.dataset.reveal).toBe("pending");

    act(() => observer.callback([{ target: below, isIntersecting: true }]));
    expect(below.dataset.reveal).toBe("in");
    expect(observer.observed).toEqual([]); // once only
    act(() => vi.advanceTimersByTime(1500));
    expect(below.dataset.reveal).toBe("done");
  });

  it("disconnects its observer when the layout unmounts", () => {
    setReducedMotion(false);
    const { getByTestId, unmount } = page();
    const below = getByTestId("below");
    act(() => observers[0].callback([{ target: below, isIntersecting: false }]));
    expect(below.dataset.reveal).toBe("pending");
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("does nothing with reduced motion: no observer, content stays as rendered", () => {
    setReducedMotion(true);
    const { getByTestId } = page();
    expect(observers).toHaveLength(0);
    expect(getByTestId("below").dataset.reveal).toBe("");
    expect(prefersReducedMotion()).toBe(true);
  });
});
