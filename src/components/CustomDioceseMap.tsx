import { ExternalLink } from "lucide-react";
import DioceseMapLive, { OPEN_IN_GOOGLE_MAPS_URL } from "./DioceseMapLive";

// One map: the app's own interactive MapLibre map (DioceseMapLive), restyled
// and shaded to match the client's Google My Map ("SanctDemoMap") — same
// dark base, teal pins (the client's orange, swapped per their request so
// pins match the app), and the client's own 7-point study-area polygon
// reproduced as a MapLibre fill layer. This used to be a two-tab switcher
// between an embedded copy of their My Map and this live map; the embed is
// gone because a My Map embed is a sealed Google iframe that can never show
// the pilgrim's own position — the entire point of merging the two designs
// into one map instead.
//
// The "open in Google Maps" link is kept below: harmless, and genuinely
// useful for sharing the client's original map outside the app.
interface CustomDioceseMapProps {
  onSelectParish: (parishId: string) => void;
  /** A parish to draw a walking route to as soon as the map is ready. */
  walkToParishId?: string | null;
  onWalkToConsumed?: () => void;
  // See DioceseMapLive's heightPx: when set, the map gets this fixed pixel
  // height and the legend/link below it grow the card instead of being
  // squeezed inside it. Omitted by the two callers that still live inside a
  // fixed-height card (Dashboard's mini map, the church selector).
  mapHeight?: number;
  /** Passed through: true while turn-by-turn navigation is running. */
  onNavigatingChange?: (navigating: boolean) => void;
}

export default function CustomDioceseMap({ onSelectParish, mapHeight, walkToParishId, onWalkToConsumed, onNavigatingChange }: CustomDioceseMapProps) {
  const wrapClassName = mapHeight != null ? "flex flex-col gap-2" : "flex flex-col gap-2 h-full min-h-0";
  const mapSlotClassName = mapHeight != null ? "" : "flex-1 min-h-0";

  return (
    <div className={wrapClassName}>
      <div className={mapSlotClassName}>
        <DioceseMapLive
          onSelectParish={onSelectParish}
          heightPx={mapHeight}
          walkToParishId={walkToParishId}
          onWalkToConsumed={onWalkToConsumed}
          onNavigatingChange={onNavigatingChange}
        />
      </div>

      <a
        href={OPEN_IN_GOOGLE_MAPS_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="dmap-live__open-link"
      >
        <ExternalLink className="w-4 h-4" />
        Open full map in Google Maps
      </a>
    </div>
  );
}
