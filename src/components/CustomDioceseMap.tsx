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
}

export default function CustomDioceseMap({ onSelectParish }: CustomDioceseMapProps) {
  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex-1 min-h-0">
        <DioceseMapLive onSelectParish={onSelectParish} />
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
