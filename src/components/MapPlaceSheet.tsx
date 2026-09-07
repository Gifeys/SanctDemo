import { useState } from "react";
import { Navigation, X, ChevronRight, Footprints, Bike, Car } from "lucide-react";
import {
  TRAVEL_MODES,
  formatModeDuration,
  minutesFor,
  travelMode,
  type TravelModeId,
} from "../lib/travelModes";
import { PARISH_PATRON_IMAGES, PARISH_PATRON_SAINTS } from "../data";
import MassNowBadge from "./MassNowBadge";
import { formatDistance } from "../lib/routing";

interface MapPlaceSheetProps {
  /** Display name of the tapped parish. */
  name: string;
  /** "Vicariate of San Roque (unconfirmed)" — as shown on the pin. */
  location?: string;
  /** The tour route id, when this parish has one. Null for the other 29. */
  routeId: string | null;
  /** Straight-line metres from the pilgrim, or null with no fix. */
  straightLineMetres: number | null;
  /** Progress text for the directions request: "" while idle. */
  directionsStatus: string;
  /** Road distance of the drawn route, once there is one. */
  routeMetres: number | null;
  directionsBusy: boolean;
  /** True once a route to this parish is drawn, which turns Directions into Start. */
  hasRoute: boolean;
  onDirections: () => void;
  onStartWalking: () => void;
  onOpenParish: () => void;
  onClose: () => void;
}


const MODE_ICONS: Record<TravelModeId, typeof Footprints> = {
  walk: Footprints,
  motorcycle: Bike,
  car: Car,
};

/**
 * The card that opens when a pin is tapped.
 *
 * It replaces a 220px MapLibre popup that carried three stacked buttons —
 * View parish, Get directions, Start walking — where two of the three were
 * the same errand. This is the place card the client asked for: the parish's
 * details first, and ONE action.
 *
 * Start walking is not a fourth button competing with Directions. It appears
 * only after a route has been drawn, which is the order the errand actually
 * happens in: see the way, then set off.
 */
export default function MapPlaceSheet({
  name,
  location,
  routeId,
  straightLineMetres,
  directionsStatus,
  routeMetres,
  directionsBusy,
  hasRoute,
  onDirections,
  onStartWalking,
  onOpenParish,
  onClose,
}: MapPlaceSheetProps) {
  const [modeId, setModeId] = useState<TravelModeId>("walk");
  const photo = routeId ? PARISH_PATRON_IMAGES[routeId] : undefined;

  // The road distance once routed, the straight line before that. Both are
  // real measurements; which one is in hand is said plainly below rather
  // than blurred into a single confident-looking number.
  const metres = routeMetres ?? straightLineMetres;
  const selected = travelMode(modeId);
  const patron = routeId ? PARISH_PATRON_SAINTS[routeId] : undefined;

  return (
    <div className="map-sheet" role="dialog" aria-label={name}>
      <button type="button" className="map-sheet__close" onClick={onClose} aria-label="Close">
        <X className="w-4 h-4" />
      </button>

      {photo && (
        <img
          src={photo}
          alt={patron ? `${patron}, ${name}` : name}
          className="map-sheet__photo"
          style={{ objectPosition: "center 32%" }}
        />
      )}

      <div className="map-sheet__body">
        <h3 className="map-sheet__name">{name}</h3>
        <p className="map-sheet__meta">Catholic parish{location ? ` · ${location}` : ""}</p>

        {routeId && <MassNowBadge routeId={routeId} className="mt-2" />}

        {patron && <p className="map-sheet__patron">{patron}</p>}

        {/* Google's mode row, with the three ways people actually reach a
            parish here. Every time is an estimate from ONE distance — the
            routing service serves a single road profile and ignores the mode
            asked of it (see travelModes.ts) — so the row says so underneath
            instead of implying three separate routings. */}
        {routeId && metres !== null && (
          <>
            <div className="map-sheet__modes" role="tablist" aria-label="How you are travelling">
              {TRAVEL_MODES.map(mode => {
                const Icon = MODE_ICONS[mode.id];
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={mode.id === modeId}
                    className="map-sheet__mode"
                    data-selected={mode.id === modeId}
                    onClick={() => setModeId(mode.id)}
                  >
                    <Icon className="w-[18px] h-[18px]" />
                    <span className="map-sheet__mode-time">
                      {formatModeDuration(minutesFor(metres, mode))}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="map-sheet__estimate">
              {formatDistance(metres)}
              {routeMetres === null && " direct"} · {selected.note}
            </p>
          </>
        )}

        {routeId ? (
          <>
            {/* One button, and which one depends on where the errand has
                got to. Before a route exists the only useful thing is
                Directions; once it is drawn, asking for the same directions
                again is the redundancy the client spotted — the button
                becomes Start, exactly as Google Maps does it. */}
            <div className="map-sheet__actions">
              {hasRoute ? (
                <button type="button" className="map-sheet__action" onClick={onStartWalking}>
                  <Navigation className="w-4 h-4" />
                  Start
                </button>
              ) : (
                <button
                  type="button"
                  className="map-sheet__action"
                  onClick={onDirections}
                  disabled={directionsBusy}
                >
                  <Navigation className="w-4 h-4" />
                  {directionsBusy ? "Finding a route…" : "Directions"}
                </button>
              )}
            </div>

            {/* Only while there is no route. Once one is drawn the mode row
                above already carries the distance and the time for the mode
                actually selected, and this line always said "walk" — so with
                Car chosen the sheet contradicted itself. */}
            {!hasRoute && directionsStatus && (
              <p className="map-sheet__status">{directionsStatus}</p>
            )}

            {/* A quiet link rather than a fourth button: the sheet already
                answers "what is this place", and this is for the pilgrim who
                wants the Mass schedule, history and ministries behind it. */}
            <button type="button" className="map-sheet__link" onClick={onOpenParish}>
              Parish page <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <p className="map-sheet__soon">Coming soon to SanctiWalk</p>
        )}
      </div>
    </div>
  );
}
