import { COMPASS_POINTS_4, COMPASS_POINTS_8, classifyHeading, formatHeading } from "../lib/heading";
import { headingNeedsPermission, type HeadingStatus } from "../lib/useDeviceHeading";

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
//
// Four cardinals, not eight. The type floor is 14px and the dial is 56px
// across, which leaves about 119px of circumference — enough for four labels
// with air around them, and not nearly enough for eight, which collided into
// an unreadable smear. The eight-point rose still drives the readout below
// ("Facing Northeast"), so no direction is lost; only the dial is simplified.
// The client's spec asks for N/E/S/W with the ordinals explicitly optional.
const ROSE_RADIUS = 19;
const DIAL_POINTS = COMPASS_POINTS_4;

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
    // Inside the wrap, like every other state.
    //
    // This branch used to return the bare button, and ALL of the positioning
    // lives on .dmap-compass-wrap (absolute, top 92px, left 8px). Without it
    // the "Enable compass" pill had no position at all and fell to the bottom
    // of the map — nowhere near the Recentre control it belongs beside, and
    // on iOS this is the only state most users ever see, because iOS always
    // starts at "prompt".
    return (
      <div className="dmap-compass-wrap">
        <button type="button" className="dmap-compass dmap-compass--prompt" onClick={onRequestPermission}>
          Enable compass
        </button>
      </div>
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
            {DIAL_POINTS.map(point => {
              const { x, y } = rosePosition(point.centre);
              const cardinal = point.abbreviation.length === 1;
              const isNorth = point.centre === 0;
              return (
                <text
                  key={point.abbreviation}
                  x={x}
                  y={y}
                  // Counter-rotate each letter by the dial's own rotation so
                  // the text stays upright while its position orbits — a
                  // rotating "S" that ends up upside-down is unreadable.
                  transform={`rotate(${-dialRotation} ${x} ${y})`}
                  className={
                    isNorth ? "dmap-compass__north" : cardinal ? "dmap-compass__cardinal" : "dmap-compass__ordinal"
                  }
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

      {/* The readout is shown in EVERY state, not only when a heading
          exists. It used to put the "why" in a tooltip and aria-label —
          neither of which a phone can display — so on the device the
          compass simply sat there inert with no way to tell whether the
          permission was refused, the sensor was missing, or it was still
          warming up. On a phone the explanation has to be on the glass. */}
      <p className="dmap-compass__readout" data-state={hasHeading ? "ok" : "off"}>
        {hasHeading && direction ? (
          <>
            Facing {direction.name}
            <span className="dmap-compass__degrees">{Math.round(heading)}°</span>
          </>
        ) : (
          unavailableLabel(status)
        )}
      </p>

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
      return "No compass on this device";
    case "unavailable":
      // Distinct from "unsupported": the events were listened for and
      // nothing absolute arrived within three seconds.
      //
      // The remedy is platform-specific, so the message has to be too.
      // Only a device that gates the sensor behind a permission call is an
      // iOS device, and only there is the Settings path the actual fix —
      // handing that instruction to someone on a laptop with no
      // magnetometer sends them hunting for a switch that isn't there.
      return headingNeedsPermission()
        ? "No compass reading — turn on Settings › Safari › Motion & Orientation Access"
        : "No compass on this device";
    default:
      return "Finding north…";
  }
}
