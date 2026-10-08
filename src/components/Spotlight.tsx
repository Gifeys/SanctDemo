import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect,
  useRef, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  placeSpotlight, isUsableTarget, type Placement, type Rect,
} from "../lib/spotlight";

/**
 * Putting a hole in the screen around one thing and explaining it.
 *
 * Used by two features that would otherwise each build their own: the
 * first-run tutorial walks its steps through this, and Sancti uses it
 * to point at whatever a pilgrim just asked about. One implementation
 * means one set of edge cases, and the tutorial and the assistant
 * cannot drift into looking like different apps.
 *
 * ## Why targets are found by attribute, not by ref
 *
 * A ref would have to be threaded from the tab bar, the map and half a
 * dozen screens up to a provider at the root, and every new target
 * would mean touching every component in between. A component opts in
 * by putting `data-spotlight="map-tab"` on itself and nothing else
 * changes.
 *
 * The cost is that a mistyped name fails silently, so `show()` reports
 * whether it found anything and the tutorial uses that to skip a step
 * whose target is not on screen rather than freezing on it.
 */

export interface SpotlightCard {
  title?: string;
  body: string;
  /** Rendered under the body: Next / Back / Skip, or nothing. */
  footer?: ReactNode;
  /** Progress dots, as [current, total]. Omitted for a one-off. */
  progress?: [number, number];
}

interface SpotlightRequest {
  target: string;
  card?: SpotlightCard;
  /** Fades itself out after this long. Omitted means it waits. */
  autoHideMs?: number;
  /** Tapping the dimmed area dismisses. Off during the tutorial. */
  dismissOnTapOutside?: boolean;
  onDismiss?: () => void;
}

interface SpotlightApi {
  /** Returns false when nothing on screen carries that name. */
  show: (request: SpotlightRequest) => boolean;
  hide: () => void;
  /** True while something is being highlighted. */
  active: boolean;
}

const Ctx = createContext<SpotlightApi | null>(null);

export function useSpotlight(): SpotlightApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useSpotlight must be used inside <SpotlightProvider>");
  return api;
}

/** Put this on anything the tutorial or Sancti should be able to point at. */
export const SPOTLIGHT_ATTR = "data-spotlight";

/**
 * The box the overlay should cover and measure against.
 *
 * On a phone that is the window, and this returns it. In the browser
 * preview the app runs inside a phone mock a few hundred pixels wide,
 * and measuring the window there puts the dimming over the whole
 * laptop screen and lets the card hang off the side of the mock. The
 * shell is tagged in every one of PhoneContainer's layouts, so
 * whichever is rendering, this finds it.
 */
function appShell(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>("[data-app-shell]");
}

function findTarget(name: string): Rect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(`[${SPOTLIGHT_ATTR}="${CSS.escape(name)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  // Relative to the shell, because that is the box the overlay is
  // positioned inside. On a phone the shell starts at 0,0 and this is
  // the same number either way.
  const host = appShell()?.getBoundingClientRect();
  return {
    top: r.top - (host?.top ?? 0),
    left: r.left - (host?.left ?? 0),
    width: r.width,
    height: r.height,
  };
}

function shellViewport(): { width: number; height: number } {
  const host = appShell()?.getBoundingClientRect();
  if (!host || host.width < 1) {
    return { width: window.innerWidth, height: window.innerHeight };
  }
  return { width: host.width, height: host.height };
}

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<SpotlightRequest | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const hide = useCallback(() => {
    setRequest(null);
    setPlacement(null);
  }, []);

  const show = useCallback((next: SpotlightRequest) => {
    if (!isUsableTarget(findTarget(next.target))) return false;
    setRequest(next);
    return true;
  }, []);

  // Measured after paint, not during: the card's height depends on how
  // much text it holds, and the placement depends on that height.
  useLayoutEffect(() => {
    if (!request) return;

    const reposition = () => {
      const target = findTarget(request.target);
      if (!isUsableTarget(target)) {
        // Whatever it was pointing at has gone - a tab changed under it.
        // Better to stop than to keep a hole over nothing.
        hide();
        return;
      }
      const cardHeight = cardRef.current?.offsetHeight ?? 150;
      setPlacement(placeSpotlight(target!, shellViewport(), cardHeight));
    };

    reposition();

    // The tab bar moves when the keyboard opens and the map's controls
    // move when it is rotated; a hole left behind is worse than none.
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [request, hide]);

  // Re-measure once the card's real height is known.
  useEffect(() => {
    if (!request || !cardRef.current) return;
    const observer = new ResizeObserver(() => {
      const target = findTarget(request.target);
      if (!isUsableTarget(target)) return;
      setPlacement(
        placeSpotlight(target!, shellViewport(), cardRef.current?.offsetHeight ?? 150),
      );
    });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [request, placement !== null]);

  useEffect(() => {
    if (!request?.autoHideMs) return;
    const timer = window.setTimeout(() => {
      request.onDismiss?.();
      hide();
    }, request.autoHideMs);
    return () => window.clearTimeout(timer);
  }, [request, hide]);

  // Escape closes anything that a tap outside would close.
  useEffect(() => {
    if (!request?.dismissOnTapOutside) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { request.onDismiss?.(); hide(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request, hide]);

  const api: SpotlightApi = { show, hide, active: request !== null };

  return (
    <Ctx.Provider value={api}>
      {children}
      {request && placement && typeof document !== "undefined" &&
        createPortal(
          <Overlay
            request={request}
            placement={placement}
            cardRef={cardRef}
            onDismiss={() => { request.onDismiss?.(); hide(); }}
          />,
          appShell() ?? document.body,
        )}
    </Ctx.Provider>
  );
}

function Overlay({
  request, placement, cardRef, onDismiss,
}: {
  request: SpotlightRequest;
  placement: Placement;
  cardRef: React.MutableRefObject<HTMLDivElement | null>;
  onDismiss: () => void;
}) {
  const { hole, card, arrow, arrowOffset } = placement;

  return (
    <div
      className="spot"
      role="dialog"
      aria-modal="true"
      aria-label={request.card?.title ?? "Guide"}
    >
      {/*
        The dimming and the hole are one element. A giant box-shadow
        spreading outwards from the hole darkens everything around it in
        a single paint, which is both cheaper than four panels around
        the target and immune to the hairline seams four panels leave
        between them on fractional pixel positions.
      */}
      <div
        className="spot__hole"
        style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }}
        onClick={request.dismissOnTapOutside ? onDismiss : undefined}
      />

      {request.card && (
        <div
          ref={cardRef}
          className={`spot__card spot__card--arrow-${arrow}`}
          style={{ top: card.top, left: card.left, width: card.width }}
        >
          {arrow !== "none" && (
            <span className="spot__arrow" style={{ left: arrowOffset }} aria-hidden />
          )}

          {request.card.title && <h2 className="spot__title">{request.card.title}</h2>}
          <p className="spot__body">{request.card.body}</p>

          {(request.card.progress || request.card.footer) && (
            <div className="spot__foot">
              {request.card.progress && (
                <span className="spot__dots" aria-hidden>
                  {Array.from({ length: request.card.progress[1] }, (_, i) => (
                    <span
                      key={i}
                      className={`spot__dot${i === request.card!.progress![0] ? " is-on" : ""}`}
                    />
                  ))}
                </span>
              )}
              {request.card.footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
