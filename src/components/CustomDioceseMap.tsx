import { useState } from "react";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import DioceseMapLive from "./DioceseMapLive";

// The client's own Google My Map ("SanctDemoMap"). They built and styled it
// themselves and asked for it to be the map the app shows.
//
// It is embedded as an iframe, which is the only way Google allows a My Map to
// appear inside another site. That carries a real limitation worth knowing
// before changing anything here: an embedded My Map is a self-contained Google
// page. It cannot show the pilgrim's own position, cannot be restyled to match
// the app, and cannot tell this app anything — no click events, no camera
// position, nothing crosses the iframe boundary.
//
// What it does NOT affect: parish detection. The geofence, the "you are near"
// banner and the arrival sheet all run off PresenceContext and are completely
// independent of whichever map is on screen. Arriving at a parish still works
// exactly the same with this map showing.
//
// The app's own map is still here, one tap away, for when live position,
// distances or walking routes are actually needed.
const MY_MAP_ID = "1gNkblHn4JSJoWLb6zP4D_h6E6WIZomg";
const EMBED_URL = `https://www.google.com/maps/d/embed?mid=${MY_MAP_ID}`;
const OPEN_URL = `https://www.google.com/maps/d/viewer?mid=${MY_MAP_ID}`;

interface CustomDioceseMapProps {
  onSelectParish: (parishId: string) => void;
}

type MapView = "custom" | "live";

export default function CustomDioceseMap({ onSelectParish }: CustomDioceseMapProps) {
  const [view, setView] = useState<MapView>("custom");

  return (
    <div className="flex flex-col gap-3">
      {/* Which map is showing. Two options, both labelled with what they are
          for, so the choice explains itself rather than needing a caption. */}
      <div
        className="flex gap-2 p-1 rounded-xl"
        style={{ background: "var(--color-brand-card)" }}
        role="tablist"
        aria-label="Choose a map"
      >
        <button
          role="tab"
          aria-selected={view === "custom"}
          onClick={() => setView("custom")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[16px] font-bold transition-all"
          style={
            view === "custom"
              ? { background: "var(--color-brand-primary)", color: "#FFFFFF" }
              : { color: "var(--color-brand-text)" }
          }
        >
          <MapPin className="w-4 h-4" />
          Diocese map
        </button>
        <button
          role="tab"
          aria-selected={view === "live"}
          onClick={() => setView("live")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[16px] font-bold transition-all"
          style={
            view === "live"
              ? { background: "var(--color-brand-primary)", color: "#FFFFFF" }
              : { color: "var(--color-brand-text)" }
          }
        >
          <Navigation className="w-4 h-4" />
          Where I am
        </button>
      </div>

      {view === "custom" ? (
        <div className="flex flex-col gap-2">
          <div className="rounded-2xl overflow-hidden" style={{ minHeight: 320 }}>
            <iframe
              src={EMBED_URL}
              title="Diocese of Kalookan — SanctiWalk map"
              className="w-full block"
              style={{ height: 320, border: 0 }}
              loading="lazy"
            />
          </div>

          {/* Said plainly rather than left for someone to discover: this map
              cannot show where you are, and the other tab can. */}
          <p
            className="text-[15px] leading-snug px-1"
            style={{ color: "var(--color-brand-secondary)" }}
          >
            This map does not show your own location. Tap{" "}
            <span className="font-bold" style={{ color: "var(--color-brand-text)" }}>
              Where I am
            </span>{" "}
            for your position, distance to each parish, and walking directions.
          </p>

          <a
            href={OPEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-[16px] font-bold"
            style={{
              background: "var(--color-brand-card)",
              color: "var(--color-brand-primary)",
            }}
          >
            <ExternalLink className="w-4 h-4" />
            Open full map in Google Maps
          </a>
        </div>
      ) : (
        <DioceseMapLive onSelectParish={onSelectParish} />
      )}
    </div>
  );
}
