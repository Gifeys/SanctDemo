import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Heart, Church, Footprints, Ruler, Clock, ScanLine, BookOpen, Users, Sparkles } from "lucide-react";
import type { Route } from "../types";
import { MASS_SCHEDULES, PARISH_PATRON_SAINTS } from "../data";
import { nextMass, parseTimes } from "../lib/schedule";
import { usePresence } from "../context/PresenceContext";
import { haversineMeters, type Coordinates } from "../lib/geo";
import { fetchWalkingRoute, formatDistance, formatWalkingMinutes } from "../lib/routing";
import parishData from "../data/diocese-parishes.json";
import { parishIdForRoute } from "../lib/parishIds";
import MassNowBadge from "./MassNowBadge";

interface DioceseParish {
  id: string;
  name: string;
  vicariate: string;
  coordinates: Coordinates;
  established?: string;
  fiestaDay?: string;
}

const PARISHES = (parishData as { parishes: DioceseParish[] }).parishes;

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ChurchDetailProps {
  parish: Route;
  onBack: () => void;
  onWalkThere: (parishId: string) => void;
  onNavigate: (tab: "mass" | "history" | "ministries" | "sacraments" | "ar") => void;
}

/**
 * A parish's own page — the redesign's screen 05.
 *
 * The mockup opens on a full-bleed parish photograph. There are no parish
 * photographs in this project yet; the field team is collecting them, and the
 * data-collection sheet asks for them by name. Rather than ship a stock
 * cathedral that isn't this church — which would be worse than nothing, since
 * a pilgrim would be looking for a building that doesn't match — the header is
 * a typographic panel carrying the same information, with a note naming what
 * is missing.
 */
export default function ChurchDetail({ parish, onBack, onWalkThere, onNavigate }: ChurchDetailProps) {
  const { position } = usePresence();
  const [route, setRoute] = useState<{ kind: string; distanceMeters: number; durationMinutes: number } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const dioceseId = parishIdForRoute(parish.id);
  const record = PARISHES.find(p => p.id === dioceseId);
  const coordinates = parish.coordinates ?? record?.coordinates;
  const patron = PARISH_PATRON_SAINTS[parish.id];
  const schedule = MASS_SCHEDULES[parish.id];
  const upcoming = schedule?.schedule ? nextMass(schedule.schedule, now) : null;

  const straightLine = position && coordinates ? haversineMeters(position, coordinates) : null;

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!position || !coordinates) {
      setRoute(null);
      return;
    }
    let live = true;
    void fetchWalkingRoute(position, coordinates).then(r => {
      if (live) setRoute(r);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.lat, position?.lng, parish.id]);

  const metres = route ? route.distanceMeters : straightLine;
  const minutes = route ? route.durationMinutes : straightLine !== null ? straightLine / (5000 / 60) : null;

  // "Today at this church" — built from the Mass schedule alone, because that
  // is the only part of a parish's day this project has collected. The mockup
  // also lists Confession, the Rosary and closing time; those are lines on the
  // field team's sheet that have not come back yet, so the section says so
  // rather than showing an invented day.
  const todayName = DAYS[now.getDay()];
  const todayTimes = schedule?.schedule
    ? parseTimes(schedule.schedule.find(s => s.day === todayName)?.time ?? "")
    : [];

  const stationCount = parish.stations?.length ?? 0;

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] min-h-0 overflow-y-auto">
      {/* Header panel. Stands in for the design's full-bleed photograph.
          Sticky, because it carries the only way back off this screen and
          it used to scroll away with everything else - on a short screen
          you had to scroll back up to leave. */}
      <div className="sticky top-0 z-10 shrink-0 bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-5 pt-5 pb-6 rounded-b-[2rem]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex items-center gap-1.5 text-[16px] font-semibold"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <button
            type="button"
            aria-label="Save this parish"
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          >
            <Heart className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center gap-2 text-[14px] font-mono uppercase tracking-[0.14em] opacity-80">
          <Church className="w-4 h-4" />
          {[record?.vicariate ? `${record.vicariate} (unconfirmed)` : null, record?.established ? `est. ${record.established}` : null]
            .filter(Boolean)
            .join(" · ") || "Diocese of Kalookan"}
        </div>

        <h1 className="mt-2 text-[30px] font-bold leading-[1.12] tracking-tight">
          {parish.name.replace(" Guide", "").replace(" Tour", "")}
        </h1>
        {patron && <p className="mt-1.5 text-[16px] opacity-85">{patron}</p>}

        <div className="mt-5 grid grid-cols-3 gap-3">
          <HeaderStat
            icon={<Ruler className="w-4 h-4" />}
            value={metres !== null ? formatDistance(metres) : "—"}
            label={metres === null ? "location off" : route?.kind === "routed" ? "walking route" : "direct"}
          />
          <HeaderStat
            icon={<Footprints className="w-4 h-4" />}
            value={minutes !== null ? formatWalkingMinutes(minutes) : "—"}
            label="on foot"
          />
          <HeaderStat
            icon={<Clock className="w-4 h-4" />}
            value={upcoming ? upcoming.time : "—"}
            label={upcoming ? "next Mass" : "no times yet"}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <MassNowBadge routeId={parish.id} />
          {stationCount > 0 && (
            <span className="text-[14px] font-semibold px-3 py-1.5 rounded-full bg-white/12">
              {stationCount} scannable {stationCount === 1 ? "station" : "stations"}
            </span>
          )}
          {schedule && !schedule.scheduleVerified && (
            <span className="text-[14px] font-semibold px-3 py-1.5 rounded-full bg-[var(--color-brand-error)]">
              Mass times unconfirmed
            </span>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Today at this church */}
        <section className="rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-5">
          <h2 className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
            Today at this church
          </h2>

          {todayTimes.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {todayTimes.map(time => (
                <li key={time} className="flex items-baseline gap-3">
                  <span className="text-[16px] font-bold tabular-nums text-[var(--color-brand-primary)] w-[76px] shrink-0">
                    {time}
                  </span>
                  <span className="text-[16px] text-[var(--color-brand-text)]">Mass</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[16px] leading-relaxed text-[var(--color-brand-secondary)]">
              {schedule ? `No Mass listed for ${todayName}.` : "This parish's Mass times have not been collected yet."}
            </p>
          )}

          <p className="mt-4 pt-4 border-t border-[var(--color-brand-border)] text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
            Confession, Rosary and closing times are not collected yet — only Mass times are
            confirmed for this parish so far.
          </p>
        </section>

        {/* Entry points into the screens that already hold this parish's
            content, rather than duplicating them here. */}
        <div className="grid grid-cols-2 gap-3">
          <DetailLink icon={<Clock className="w-5 h-5" />} label="Mass schedule" onClick={() => onNavigate("mass")} />
          <DetailLink icon={<BookOpen className="w-5 h-5" />} label="History" onClick={() => onNavigate("history")} />
          <DetailLink icon={<Users className="w-5 h-5" />} label="Ministries" onClick={() => onNavigate("ministries")} />
          <DetailLink icon={<Sparkles className="w-5 h-5" />} label="Sacraments" onClick={() => onNavigate("sacraments")} />
          {stationCount > 0 && (
            <DetailLink
              icon={<ScanLine className="w-5 h-5" />}
              label="Scan a station"
              onClick={() => onNavigate("ar")}
            />
          )}
        </div>

        {/* The design's own note about photography, kept honest. */}
        <p className="text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          Parish photographs are still being gathered by the field team. This page will carry a
          picture of the church itself once they arrive.
        </p>
      </div>

      {/* "Get directions", not "Walk there". The button always drew a route
          and handed it to the pilgrim — it never started a walk — and not
          everyone coming to a parish is on foot, so the old label promised
          both more and less than it did. The walking time stays in the label
          because that is what the route is measured for. */}
      <div className="sticky bottom-0 shrink-0 px-4 py-3 bg-[var(--color-brand-card)] border-t border-[var(--color-brand-border)]">
        <button
          type="button"
          onClick={() => onWalkThere(dioceseId ?? parish.id)}
          className="w-full py-3.5 rounded-full text-[16px] font-semibold bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)]"
        >
          Get directions
          {metres !== null && minutes !== null && (
            <span className="font-normal opacity-85">
              {" "}
              · {formatWalkingMinutes(minutes)} · {formatDistance(metres)}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function HeaderStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[20px] font-bold tabular-nums leading-none">{value}</span>
      </div>
      <p className="mt-1 text-[15px] opacity-80">{label}</p>
    </div>
  );
}

function DetailLink({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-left"
    >
      <span className="text-[var(--color-brand-primary)] shrink-0">{icon}</span>
      <span className="text-[16px] font-semibold text-[var(--color-brand-text)]">{label}</span>
    </button>
  );
}
