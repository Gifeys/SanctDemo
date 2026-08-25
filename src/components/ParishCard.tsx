import { Route } from "../types";
import { MASS_SCHEDULES, PARISH_PATRON_SAINTS } from "../data";
import { nextMass } from "../lib/schedule";

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

  return (
    <button type="button" className="parish-card" onClick={() => onSelect(parish.id)}>
      <div className="parish-card__row">
        <h3 className="parish-card__name">{parishDisplayName(parish)}</h3>
        <span className="chip--live">Live</span>
      </div>
      <p className="parish-card__patron">{patron}</p>
      <hr className="parish-card__rule" />
      <p className="parish-card__meta">{nextMassLine(parish.id)}</p>
    </button>
  );
}
