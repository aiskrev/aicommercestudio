/**
 * Pointer layer of the motion system (docs/MOTION_SYSTEM.md → Pointer layer). One delegated `pointermove`
 * listener on the document, throttled to one update per animation frame. It only writes CSS custom properties;
 * the visual result (translate, tilt, spotlight) lives in globals.css and is bounded there:
 *
 *   [data-magnetic]  --mag-x / --mag-y in [-1, 1]   container ≤ 7 px, label ≤ 3 px more (hero, header, final CTA)
 *   [data-portal]    --px / --py (%), --tx / --ty in [-1, 1]   spotlight position and ≤ 2° tilt (service cards)
 *   [data-field]     --fx / --fy in [-1, 1]          hero technical field and preview depth layers (≤ 14 px)
 *
 * Only mouse pointers on a fine, hovering input: touch and pen never set anything, keyboard focus never moves
 * anything, and nothing is installed when reduced motion is requested. Leaving an element resets its properties,
 * so it eases back to rest through its CSS transition.
 */
const MAGNETIC = ["--mag-x", "--mag-y"];
/** Cards that get the pointer spotlight (and, in CSS, a light tilt): the homepage portals and every card type. */
const PORTAL_TARGETS = "[data-portal], .motion-card, .card-interactive, .price-card, .offer-card, .vl-tile, .feature-panel";
const PORTAL = ["--px", "--py", "--tx", "--ty"];
const FIELD = ["--fx", "--fy"];

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

function clear(element: HTMLElement | null, properties: string[]) {
  if (!element) return;
  for (const property of properties) element.style.removeProperty(property);
}

/** Pointer position relative to the element's centre, each axis in [-1, 1]. */
function relative(element: HTMLElement, x: number, y: number) {
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    rect,
    dx: clamp((x - (rect.left + rect.width / 2)) / (rect.width / 2)),
    dy: clamp((y - (rect.top + rect.height / 2)) / (rect.height / 2)),
  };
}

export function finePointer(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** Installs the listener; returns the cleanup. The caller checks reduced motion first. */
export function installPointerLayer(): () => void {
  if (!finePointer()) return () => {};
  let frame = 0;
  let last: PointerEvent | null = null;
  let magnet: HTMLElement | null = null;
  let portal: HTMLElement | null = null;
  let field: HTMLElement | null = null;

  const update = () => {
    frame = 0;
    const event = last;
    if (!event) return;
    const target = event.target instanceof Element ? event.target : null;

    const nextMagnet = target?.closest<HTMLElement>("[data-magnetic]") ?? null;
    if (nextMagnet !== magnet) clear(magnet, MAGNETIC);
    magnet = nextMagnet;
    if (magnet && !magnet.matches(":disabled, [aria-disabled='true'], [aria-busy='true']")) {
      const at = relative(magnet, event.clientX, event.clientY);
      if (at) {
        magnet.style.setProperty("--mag-x", at.dx.toFixed(3));
        magnet.style.setProperty("--mag-y", at.dy.toFixed(3));
      }
    }

    const nextPortal = target?.closest<HTMLElement>(PORTAL_TARGETS) ?? null;
    if (nextPortal !== portal) clear(portal, PORTAL);
    portal = nextPortal;
    if (portal) {
      const at = relative(portal, event.clientX, event.clientY);
      if (at) {
        portal.style.setProperty("--px", `${(((event.clientX - at.rect.left) / at.rect.width) * 100).toFixed(1)}%`);
        portal.style.setProperty("--py", `${(((event.clientY - at.rect.top) / at.rect.height) * 100).toFixed(1)}%`);
        portal.style.setProperty("--tx", at.dx.toFixed(3));
        portal.style.setProperty("--ty", at.dy.toFixed(3));
      }
    }

    const nextField = target?.closest<HTMLElement>("[data-field]") ?? null;
    if (nextField !== field) clear(field, FIELD);
    field = nextField;
    if (field) {
      const at = relative(field, event.clientX, event.clientY);
      if (at) {
        field.style.setProperty("--fx", at.dx.toFixed(3));
        field.style.setProperty("--fy", at.dy.toFixed(3));
      }
    }
  };

  const onMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    last = event;
    if (!frame) frame = requestAnimationFrame(update);
  };
  const resetAll = () => {
    last = null;
    clear(magnet, MAGNETIC);
    clear(portal, PORTAL);
    clear(field, FIELD);
    magnet = portal = field = null;
  };
  const onOut = (event: PointerEvent) => {
    if (!event.relatedTarget) resetAll(); // the pointer left the window
  };

  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerout", onOut, { passive: true });
  window.addEventListener("blur", resetAll);
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerout", onOut);
    window.removeEventListener("blur", resetAll);
    resetAll();
  };
}

/**
 * Ambient loops ([data-loop]: the hero scan, the final call to action's drift) are paused while their section is
 * off screen: `data-offscreen` is set from one IntersectionObserver and the CSS pauses the animations.
 */
export function installLoopPausing(): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) (entry.target as HTMLElement).toggleAttribute("data-offscreen", !entry.isIntersecting);
  });
  for (const element of document.querySelectorAll<HTMLElement>("[data-loop]")) observer.observe(element);
  return () => observer.disconnect();
}
