import { useEffect, useState, type ReactNode } from "react";
import { Footprints, Heart, Ruler, Clock } from "lucide-react";
import { usePresence } from "../context/PresenceContext";
import { haversineMeters, type Coordinates } from "../lib/geo";
import { fetchWalkingRoute, formatDistance, formatWalkingMinutes } from "../lib/routing";
import { MASS_SCHEDULES } from "../data";
import { nextMass } from "../lib/schedule";
import parishData from "../data/diocese-parishes.json";
import { routeIdForParish } from "../lib/parishIds";

interface DioceseParish {
  id: string;
  name: string;
  vicariate: string;
  coordinates: Coordinates;
  status: string;
}

const PARISHES = (parishData as { parishes: DioceseParish[] }).parishes;

interface HomeHeroProps {
  /** Opens the Map tab and draws the walking route to this parish. */
  onWalkThere: (parishId: string) => void;
  /** Opens a parish's own page, for the two that have one. */
  onOpenParish: (routeId: string) => void;
}

/**
 * "Nearest to you now" — the redesign's Home hero.
 *
 * It features whichever of the 31 parishes is actually closest, not whichever
 * has the most content. That means the card frequently lands on a parish with
 * no Mass times collected yet, and when it does the Mass line and the
 * open/closed chip are simply absent rather than faked or filled with a
 * placeholder. A hero that invented a Mass time would send someone to a
 * locked church.
 */
export default function HomeHero({ onWalkThere, onOpenParish }: HomeHeroProps) {
  const { position, accuracyMeters, gpsStatus } = usePresence();
  const [route, setRoute] = useState<{ kind: string; distanceMeters: number; durationMinutes: number } | null>(null);

  const nearest = position
    ? PARISHES.reduce<{ parish: DioceseParish; metres: number } | null>((best, parish) => {
        const metres = haversineMeters(position, parish.coordinates);
        return !best || metres < best.metres ? { parish, metres } : best;
      }, null)
    : null;

  // One routing call, for the one parish being featured. The straight-line
  // distance shows immediately and is replaced when (or if) OSRM answers, so
  // the card is never blank waiting on the network.
  useEffect(() => {
    if (!position || !nearest) {
      setRoute(null);
      return;
    }
    let live = true;
    const target = nearest.parish.coordinates;
    void fetchWalkingRoute(position, target).then(result => {
      if (live) setRoute(result);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, nearest?.parish.id]);

  if (!position || !nearest) {
    return (
      <section className="rounded-[22px] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] p-5">
        <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
          Nearest to you now
        </p>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--color-brand-text)]">
          {gpsStatus === "denied"
            ? "Location is switched off, so the app cannot tell which parish you are nearest. Turn it on to see distances and walking times."
            : "Finding your location…"}
        </p>
      </section>
    );
  }

  const { parish, metres } = nearest;
  const routeId = routeIdForParish(parish.id);
  const schedule = routeId ? MASS_SCHEDULES[routeId] : undefined;
  const upcoming = schedule?.schedule ? nextMass(schedule.schedule, new Date()) : null;

  // OSRM's distance is trustworthy; its duration assumes a vehicle, so the
  // walking figure always comes from the app's own 5 km/h (see routing.ts).
  const shownMetres = route ? route.distanceMeters : metres;
  const minutes = route ? route.durationMinutes : metres / (5000 / 60);
  const routed = route?.kind === "routed";

  return (
    <section className="rounded-[22px] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
            Nearest to you now
          </p>
          {/* The chip only exists when a real schedule backs it. */}
          {upcoming && (
            <span className="text-[14px] font-semibold px-2.5 py-1 rounded-md bg-[var(--color-brand-success)] text-[var(--color-brand-on-accent)]">
              Mass {relativeMass(upcoming.date, new Date())}
            </span>
          )}
        </div>

        <h2 className="mt-2 text-[24px] font-bold leading-tight tracking-tight text-[var(--color-brand-text)]">
          {parish.name}
        </h2>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Stat
            icon={<Ruler className="w-4 h-4" />}
            value={formatDistance(shownMetres)}
            label={routed ? "walking route" : "direct"}
          />
          <Stat
            icon={<Footprints className="w-4 h-4" />}
            value={formatWalkingMinutes(minutes)}
            label="on foot"
          />
          <Stat
            icon={<Clock className="w-4 h-4" />}
            value={upcoming ? upcoming.time : "—"}
            label={upcoming ? "next Mass" : "no times yet"}
          />
        </div>

        {/* Said plainly rather than hidden: this is the state most of the
            diocese is in, and naming it is what tells the field team which
            parish still needs visiting. */}
        {!schedule && (
          <p className="mt-3 text-[15px] leading-snug text-[var(--color-brand-secondary)]">
            Mass times for this parish have not been collected yet.
          </p>
        )}
        {schedule && !schedule.scheduleVerified && (
          <p className="mt-3 text-[15px] leading-snug text-[var(--color-brand-error)]">
            These Mass times are unconfirmed — check with the parish before travelling.
          </p>
        )}
        {accuracyMeters !== null && accuracyMeters > 60 && (
          <p className="mt-2 text-[15px] text-[var(--color-brand-secondary)]">
            Your position is only accurate to ±{Math.round(accuracyMeters)} m, so this distance is rough.
          </p>
        )}
      </div>

      <div className="flex items-stretch border-t border-[var(--color-brand-border)]">
        <button
          type="button"
          onClick={() => onWalkThere(parish.id)}
          className="flex-1 py-3.5 text-[16px] font-semibold bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)]"
        >
          Get directions
        </button>
        {routeId && (
          <button
            type="button"
            onClick={() => onOpenParish(routeId)}
            className="px-5 text-[16px] font-semibold text-[var(--color-brand-primary)] border-l border-[var(--color-brand-border)]"
          >
            Open
          </button>
        )}
        <button
          type="button"
          aria-label="Save this parish"
          className="px-5 text-[var(--color-brand-secondary)] border-l border-[var(--color-brand-border)]"
        >
          <Heart className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
}

/**
 * "in 40 minutes" / "in 3 hours" / "tomorrow 6:00 AM" / "Friday".
 *
 * The mockup's chip reads "Mass in 3 hours", which only means anything if it
 * is counted from now — a fixed string would be wrong within the hour.
 */
function relativeMass(when: Date, now: Date): string {
  const minutes = Math.round((when.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 12) return `in ${hours} hour${hours === 1 ? "" : "s"}`;
  const sameDay = when.toDateString() === now.toDateString();
  if (sameDay) return `at ${when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const tomorrow = new Date(now.getTime() + 86400000);
  if (when.toDateString() === tomorrow.toDateString()) return "tomorrow";
  return when.toLocaleDateString("en-US", { weekday: "long" });
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[var(--color-brand-primary)]">
        {icon}
        <span className="text-[20px] font-bold tabular-nums leading-none">{value}</span>
      </div>
      <p className="mt-1 text-[15px] text-[var(--color-brand-secondary)]">{label}</p>
    </div>
  );
}
