import { Route } from "../types";
import { MASS_SCHEDULES, PARISH_PATRON_SAINTS } from "../data";
import { nextMass } from "../lib/schedule";
import { usePresence } from "../context/PresenceContext";
import { haversineMeters } from "../lib/geo";
import { formatDistance, formatWalkingMinutes, WALK_SPEED_MPS } from "../lib/routing";

interface ParishCardProps {
  parish: Route;
  onSelect: (parishId: string) => void;
}

function parishDisplayName(parish: Route): string {
  return parish.name.replace(" Guide", "").replace(" Tour", "");
}

// "Next Mass · Wednesday 6:00 AM" — matches the prototype's line verbatim.
// A parish whose schedule is unverified (see data.ts's scheduleVerified
// flag) still shows the sample time but flags it, same as PresenceSheet
// already does elsewhere — a card must never state a placeholder Mass time
// as if it were confirmed.
function nextMassLine(parishId: string): string {
  const parishSchedule = MASS_SCHEDULES[parishId];
  const upcoming = nextMass(parishSchedule?.schedule ?? [], new Date());
  if (!upcoming) return "Mass schedule coming soon";

  const label = `Next Mass · ${upcoming.day} ${upcoming.time}`;
  return parishSchedule?.scheduleVerified === false ? `${label} (sample, unconfirmed)` : label;
}

export default function ParishCard({ parish, onSelect }: ParishCardProps) {
  const patron = PARISH_PATRON_SAINTS[parish.id] ?? "Patron saint not yet listed";
  const { position } = usePresence();

  // Straight-line, and labelled "direct" so it is never mistaken for a
  // walking distance — the card is a summary, and firing an OSRM request per
  // card just to fill a caption is what used to draw unasked-for routes
  // across the map. "Get directions" on the pin is where the real route
  // lives. Absent entirely when there is no fix, rather than showing a dash.
  const straightLine =
    position && parish.coordinates ? haversineMeters(position, parish.coordinates) : null;

  return (
    <button type="button" className="parish-card" onClick={() => onSelect(parish.id)}>
      <div className="parish-card__row">
        <h3 className="parish-card__name">{parishDisplayName(parish)}</h3>
        <span className="chip--live">Live</span>
      </div>
      {straightLine !== null && (
        <p className="parish-card__distance">
          {formatDistance(straightLine)} direct
          <span className="parish-card__walk">
            · about {formatWalkingMinutes(straightLine / WALK_SPEED_MPS / 60)} on foot
          </span>
        </p>
      )}
      <p className="parish-card__patron">{patron}</p>
      <hr className="parish-card__rule" />
      <p className="parish-card__meta">{nextMassLine(parish.id)}</p>
    </button>
  );
}
