import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, Navigation2, CornerUpLeft, RotateCw, Flag } from "lucide-react";
import { usePresence } from "../context/PresenceContext";
import type { Coordinates } from "../lib/geo";
import { fetchWalkingRoute, formatDistance, formatWalkingMinutes, WALK_SPEED_MPS, type WalkingRoute } from "../lib/routing";
import {
  announcementFor,
  instructionFor,
  nextOffRouteState,
  progressAlong,
  type NavigationProgress,
  type OffRouteState,
} from "../lib/navigation";

interface NavigationOverlayProps {
  destination: Coordinates;
  destinationName: string;
  onStop: () => void;
  /** Called whenever a route is (re)calculated, so the map can draw it. */
  onRoute?: (route: WalkingRoute) => void;
}

type Phase = "routing" | "navigating" | "rerouting" | "arrived" | "no-route";

/**
 * Turn-by-turn walking navigation.
 *
 * The maths lives in lib/navigation.ts and is tested there; this component
 * owns only what a pure function cannot: the GPS subscription, the reroute
 * request, and what the pilgrim sees.
 *
 * Two honesty constraints carry over from the rest of the app. A 'direct'
 * route — OSRM unreachable, or the request timed out — has no turns, so
 * navigation refuses to start rather than reading out "head north, then
 * arrive" over a straight line drawn through buildings. And walking time is
 * always derived at WALK_SPEED_MPS, never from OSRM's own duration, which
 * assumes a vehicle.
 */
export default function NavigationOverlay({
  destination,
  destinationName,
  onStop,
  onRoute,
}: NavigationOverlayProps) {
  const { position } = usePresence();
  const [route, setRoute] = useState<WalkingRoute | null>(null);
  const [phase, setPhase] = useState<Phase>("routing");
  const [progress, setProgress] = useState<NavigationProgress | null>(null);
  const [reroutes, setReroutes] = useState(0);

  const offRouteRef = useRef<OffRouteState>({ strikes: 0, offRoute: false });
  const stepIndexRef = useRef(0);
  const requestRef = useRef(0);
  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;

  // Held in a ref so the routing effect does not re-run on every GPS tick —
  // it needs the position at the moment it fires, not as a dependency.
  const positionRef = useRef<Coordinates | null>(position);
  positionRef.current = position;

  const requestRoute = async (isReroute: boolean) => {
    const from = positionRef.current;
    if (!from) return;

    const id = ++requestRef.current;
    setPhase(isReroute ? "rerouting" : "routing");

    const result = await fetchWalkingRoute(from, destination, { withSteps: true });
    if (requestRef.current !== id) return; // superseded by a newer request

    // A direct route has no turns to give. Navigation cannot honestly run on
    // one, so it says so instead of pretending.
    if (result.kind !== "routed" || result.steps.length === 0) {
      setRoute(result);
      setPhase("no-route");
      return;
    }

    stepIndexRef.current = 0;
    offRouteRef.current = { strikes: 0, offRoute: false };
    setRoute(result);
    setPhase("navigating");
    if (isReroute) setReroutes(n => n + 1);
    onRouteRef.current?.(result);
  };

  // First route, once.
  useEffect(() => {
    void requestRoute(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination.lat, destination.lng]);

  // Every fix: advance the instruction, and decide whether the route is lost.
  useEffect(() => {
    if (!position || !route || phase !== "navigating") return;

    const next = progressAlong(position, route.steps, destination, stepIndexRef.current);
    stepIndexRef.current = next.stepIndex;
    setProgress(next);

    if (next.arrived) {
      setPhase("arrived");
      return;
    }

    offRouteRef.current = nextOffRouteState(position, route.path, offRouteRef.current);
    if (offRouteRef.current.offRoute) void requestRoute(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, route, phase]);

  const step = route && progress ? route.steps[progress.stepIndex] : null;
  const upcoming = route && progress ? route.steps[progress.stepIndex + 1] : null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 p-3">
      <div className="rounded-[22px] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] shadow-2xl overflow-hidden">
        {/* The instruction band. Navy, because in this palette navy marks
            position, route and action — and this is all three. */}
        <div className="bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-5 py-4">
          {phase === "routing" && <BandMessage icon={<RotateCw className="w-5 h-5 animate-spin" />} text="Finding a walking route…" />}

          {phase === "rerouting" && (
            <BandMessage icon={<RotateCw className="w-5 h-5 animate-spin" />} text="You've left the route — finding a new one…" />
          )}

          {phase === "no-route" && (
            <BandMessage
              icon={<Navigation2 className="w-5 h-5" />}
              text="No walking directions available right now. The route line shows the direct line only — follow the map rather than turn-by-turn."
            />
          )}

          {phase === "arrived" && (
            <BandMessage icon={<Flag className="w-5 h-5" />} text={`You have arrived at ${destinationName}.`} />
          )}

          {phase === "navigating" && step && progress && (
            <div className="flex items-start gap-3.5">
              <CornerUpLeft
                className="w-6 h-6 shrink-0 mt-0.5"
                style={{ transform: maneuverTransform(step.maneuver.modifier) }}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[20px] font-bold leading-tight">{instructionFor(step)}</p>
                <p className="mt-1 text-[16px] opacity-85 tabular-nums">
                  {announcementFor(step, progress.metersToManeuver)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <div className="min-w-0">
            {progress && phase !== "no-route" ? (
              <p className="text-[16px] font-semibold text-[var(--color-brand-text)] tabular-nums">
                {formatDistance(progress.metersRemaining)} ·{" "}
                {formatWalkingMinutes(progress.metersRemaining / WALK_SPEED_MPS / 60)}
              </p>
            ) : (
              <p className="text-[16px] font-semibold text-[var(--color-brand-text)] truncate">{destinationName}</p>
            )}
            <p className="text-[15px] text-[var(--color-brand-secondary)] truncate">
              {upcoming ? `Then ${instructionFor(upcoming).toLowerCase()}` : `to ${destinationName}`}
              {reroutes > 0 && ` · rerouted ${reroutes}×`}
            </p>
          </div>

          <button
            type="button"
            onClick={onStop}
            className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-full text-[16px] font-semibold bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] text-[var(--color-brand-text)]"
          >
            <X className="w-4 h-4" />
            Stop
          </button>
        </div>
      </div>
    </div>
  );
}

function BandMessage({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="shrink-0 mt-0.5">{icon}</span>
      <p className="text-[16px] leading-snug font-semibold">{text}</p>
    </div>
  );
}

/**
 * Points the single arrow glyph in the direction of the manoeuvre.
 *
 * One icon rotated beats importing eight near-identical ones, and it keeps
 * the arrow's weight and size identical between instructions — a set of
 * separate glyphs visibly jitters as it swaps.
 */
function maneuverTransform(modifier?: string): string {
  switch (modifier) {
    case "right":
      return "scaleX(-1)";
    case "slight right":
      return "scaleX(-1) rotate(25deg)";
    case "sharp right":
      return "scaleX(-1) rotate(-30deg)";
    case "slight left":
      return "rotate(25deg)";
    case "sharp left":
      return "rotate(-30deg)";
    case "uturn":
      return "rotate(90deg)";
    case "straight":
      return "rotate(90deg) scaleX(-1)";
    default:
      return "none";
  }
}
