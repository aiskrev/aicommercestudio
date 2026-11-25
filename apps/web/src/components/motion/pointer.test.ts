import { afterEach, describe, expect, it, vi } from "vitest";

import { installPointerLayer } from "@/components/motion/pointer";

/** The pointer layer only writes bounded custom properties, only for a mouse on a fine, hovering pointer. */
function setFinePointer(fine: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: fine }) as unknown as typeof window.matchMedia;
}

function button() {
  document.body.innerHTML = '<a data-magnetic="" href="#"><span class="btn-label">Go</span></a>';
  const element = document.querySelector<HTMLElement>("[data-magnetic]")!;
  element.getBoundingClientRect = () => ({ left: 100, top: 100, width: 200, height: 50, right: 300, bottom: 150, x: 100, y: 100, toJSON: () => ({}) });
  return element;
}

function move(target: Element, x: number, y: number, pointerType = "mouse") {
  const event = new MouseEvent("pointermove", { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  target.dispatchEvent(event);
}

describe("pointer layer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("sets the magnetic offset in [-1, 1] once per frame for a mouse, and resets it on leaving", () => {
    setFinePointer(true);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const element = button();
    const remove = installPointerLayer();
    move(element.firstElementChild!, 290, 102);
    move(element.firstElementChild!, 1000, 102); // far outside: still clamped
    expect(frames).toHaveLength(1); // throttled: one frame for both events
    frames[0](0);
    expect(element.style.getPropertyValue("--mag-x")).toBe("1.000");
    expect(Number(element.style.getPropertyValue("--mag-y"))).toBeCloseTo(-0.92, 2);
    move(document.body, 10, 10);
    frames[1](0);
    expect(element.style.getPropertyValue("--mag-x")).toBe("");
    remove();
  });

  it("ignores touch and pen", () => {
    setFinePointer(true);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
    const element = button();
    const remove = installPointerLayer();
    move(element, 290, 102, "touch");
    move(element, 290, 102, "pen");
    expect(frames).toHaveLength(0);
    expect(element.style.getPropertyValue("--mag-x")).toBe("");
    remove();
  });

  it("is not installed without a fine, hovering pointer", () => {
    setFinePointer(false);
    const add = vi.spyOn(document, "addEventListener");
    installPointerLayer()();
    expect(add).not.toHaveBeenCalledWith("pointermove", expect.anything(), expect.anything());
    add.mockRestore();
  });
});
