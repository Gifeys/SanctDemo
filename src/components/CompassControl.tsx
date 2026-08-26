import { COMPASS_POINTS_8, classifyHeading, formatHeading } from "../lib/heading";
import type { HeadingStatus } from "../lib/useDeviceHeading";

export type MapOrientationMode = "north-up" | "heading-up";

interface CompassControlProps {
  /** Smoothed bearing in degrees, or null when no heading is available. */
  heading: number | null;
  status: HeadingStatus;
  mode: MapOrientationMode;
  onToggleMode: () => void;
  /** iOS only — shown as an enable button while status is "prompt". */
  onRequestPermission: () => void;
}

// The rose is drawn once, upright, and the whole dial is counter-rotated by
// the current heading. That is what makes the letters behave like a real
// compass: turning the phone east swings the dial so E climbs to the top.
const ROSE_RADIUS = 21;

function rosePosition(centre: number) {
  // -90 because SVG angles start at 3 o'clock and bearings start at 12.
  const radians = ((centre - 90) * Math.PI) / 180;
  return {
    x: Math.cos(radians) * ROSE_RADIUS,
    y: Math.sin(radians) * ROSE_RADIUS,
  };
}

/**
 * The map's compass, modelled on Google Maps': a dial that turns with the
 * pilgrim, and a tap target that puts the map back to north.
 *
 * It renders in every sensor state rather than disappearing when there is no
 * heading. A compass that vanishes on a laptop — or on a phone that refused
 * the permission — looks like a broken feature; one that says why it is
 * inert is merely honest about the hardware.
 */
export default function CompassControl({
  heading,
  status,
  mode,
  onToggleMode,
  onRequestPermission,
}: CompassControlProps) {
  if (status === "prompt") {
    return (
      <button type="button" className="dmap-compass dmap-compass--prompt" onClick={onRequestPermission}>
        Enable compass
      </button>
    );
  }

  const hasHeading = heading !== null && status === "granted";
  const direction = hasHeading ? classifyHeading(heading, COMPASS_POINTS_8) : null;

  // In heading-up mode the map itself is already rotated, so the dial sits
  // still and the pilgrim's direction is always at the top. In north-up the
  // map is fixed and the dial does the turning.
  const dialRotation = !hasHeading ? 0 : mode === "heading-up" ? 0 : -heading;

  const label = !hasHeading
    ? unavailableLabel(status)
    : `${formatHeading(heading, COMPASS_POINTS_8)} — ${
        mode === "heading-up" ? "map follows your heading" : "map is north-up"
      }. Tap to switch to ${mode === "heading-up" ? "north-up" : "heading-up"}.`;

  return (
    <div className="dmap-compass-wrap">
      <button
        type="button"
        className="dmap-compass"
        onClick={onToggleMode}
        disabled={!hasHeading}
        title={label}
        aria-label={label}
        data-mode={mode}
      >
        <svg viewBox="-28 -28 56 56" aria-hidden="true">
          <circle className="dmap-compass__face" cx="0" cy="0" r="25" />

          <g style={{ transform: `rotate(${dialRotation}deg)` }} className="dmap-compass__dial">
            {COMPASS_POINTS_8.map(point => {
              const { x, y } = rosePosition(point.centre);
              const cardinal = point.abbreviation.length === 1;
              return (
                <text
                  key={point.abbreviation}
                  x={x}
                  y={y}
                  // Counter-rotate each letter by the dial's own rotation so
                  // the text stays upright while its position orbits — a
                  // rotating "S" that ends up upside-down is unreadable.
                  transform={`rotate(${-dialRotation} ${x} ${y})`}
                  className={cardinal ? "dmap-compass__cardinal" : "dmap-compass__ordinal"}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {point.abbreviation}
                </text>
              );
            })}

            {/* The north needle, so north is findable at a glance without
                reading the letters. */}
            <polygon className="dmap-compass__needle" points="0,-14 4,-2 -4,-2" />
            <polygon className="dmap-compass__needle-tail" points="0,14 4,2 -4,2" />
          </g>
        </svg>
      </button>

      {hasHeading && direction && (
        <p className="dmap-compass__readout">
          Facing {direction.name}
          <span className="dmap-compass__degrees">{Math.round(heading)}°</span>
        </p>
      )}
      {!hasHeading && <p className="dmap-compass__readout">{unavailableLabel(status)}</p>}
    </div>
  );
}

// Each of these is a genuinely different situation with a different remedy,
// so they get different words rather than one catch-all "compass
// unavailable" that leaves the pilgrim nothing to act on.
function unavailableLabel(status: HeadingStatus): string {
  switch (status) {
    case "insecure":
      return "Compass needs a secure (https) connection";
    case "denied":
      return "Compass permission was denied";
    case "unsupported":
    case "unavailable":
      return "No compass on this device";
    default:
      return "Finding north…";
  }
}
