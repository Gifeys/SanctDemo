import { useState } from "react";
import { AlertTriangle, ChevronUp, Clock } from "lucide-react";
import { MASS_SCHEDULES } from "../data";
import { liturgicalDay } from "../lib/liturgical";
import { dayOfMonth, sundayMassCard } from "../lib/sundayMasses";
import { useParishContent } from "../lib/useParishContent";

interface MassScheduleCardProps {
  /** The active tour route id, e.g. "route-mhcp". */
  routeId: string;
  now: Date;
}

/**
 * The green Mass panel on Home.
 *
 * Every value is derived, not written in: the liturgical title comes from
 * liturgicalDay(), the times from the parish's own schedule (or an admin's
 * override), and the dates from the coming Sunday. The mockup's "DATE 00"
 * placeholders become the real day of the month, which is the difference
 * between a card that is decoration and one a pilgrim can plan around — for
 * six days out of seven, "Sunday Masses" with no date is ambiguous.
 *
 * The green is deliberately darker than the mockup's. White body text on that
 * lighter green measures 2.78:1, and what sits on it is the Mass TIMES; the
 * gradient here holds 4.7:1 at its lightest point. See --home-mass-from.
 */
export default function MassScheduleCard({
  routeId,
  now,
}: MassScheduleCardProps) {
  const [expanded, setExpanded] = useState(true);

  const managed = useParishContent(routeId);
  const compiled = MASS_SCHEDULES[routeId];

  // An admin's schedule wins over the one compiled into data.ts. A schedule
  // typed by the parish office is confirmed by definition, which is why it
  // also clears the unverified flag.
  const schedule = managed?.massSchedule ?? compiled?.schedule ?? [];
  const verified = managed?.massSchedule ? true : compiled?.scheduleVerified !== false;

  const card = sundayMassCard(schedule, now, { verified });
  const today = liturgicalDay(now);

  const hasAnything = card.anticipated !== null || card.sunday.times.length > 0;

  return (
    <section
      className="rounded-[26px] overflow-hidden shadow-lg"
      style={{
        background: `linear-gradient(160deg, var(--home-mass-from), var(--home-mass-to))`,
      }}
    >
      {managed?.massImageUrl && (
        <img
          src={managed.massImageUrl}
          alt=""
          className="w-full h-[168px] object-cover"
          loading="lazy"
        />
      )}

      <div className="p-5 text-white">
        {/* The season sits above as an eyebrow rather than beside the title.
            Squeezed alongside, it forced a long liturgical name like
            "Wednesday of the 23rd Week in Ordinary Time" onto four cramped
            lines. It is also DROPPED when the title already contains it,
            which for most of the year it does — "Ordinary Time · Wednesday
            of the 23rd Week in Ordinary Time" says it twice. */}
        {!today.name.toLowerCase().includes(today.season.toLowerCase()) && (
          <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-white/75">
            {today.season}
          </p>
        )}
        <h3 className="text-[21px] font-bold leading-[1.2] tracking-tight text-balance">
          {today.name}
        </h3>

        {!hasAnything ? (
          // 29 of the 31 parishes have no collected schedule. An empty green
          // panel reads as broken; this says which it is.
          <p className="mt-3 text-[16px] leading-relaxed text-white/90">
            Mass times for this parish have not been collected yet.
          </p>
        ) : (
          <>
            {card.unverified && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-black/25 px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-[15px] font-semibold leading-snug">
                  Sample times, not yet confirmed by the parish.
                </span>
              </div>
            )}

            {expanded && (
              <div className="mt-4 space-y-4">
                {card.anticipated && (
                  <MassRow
                    label="Anticipated Mass"
                    times={[card.anticipated.time]}
                    date={card.anticipated.date}
                  />
                )}

                {card.sunday.times.length > 0 && (
                  <MassRow
                    label="Sunday Masses"
                    times={card.sunday.times}
                    date={card.sunday.date}
                  />
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setExpanded(v => !v)}
              className="mt-4 w-full flex items-center justify-center gap-1.5 text-[14px] font-bold uppercase tracking-[0.12em] text-white/85"
              aria-expanded={expanded}
            >
              <ChevronUp
                className={`w-4 h-4 transition-transform duration-200 ${expanded ? "" : "rotate-180"}`}
              />
              {expanded ? "Show less" : "Show times"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * One labelled group of times with the date it falls on.
 *
 * The times wrap into two columns the way the mockup has them, but as a grid
 * rather than fixed columns — a parish with three Sunday Masses should not
 * leave a ragged hole, and one with eight should not overflow.
 */
function MassRow({ label, times, date }: { label: string; times: string[]; date: Date }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold">{label}</p>
        <ul className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
          {times.map(time => (
            <li key={time} className="flex items-center gap-1.5 text-[16px] text-white/95">
              <Clock className="w-3.5 h-3.5 shrink-0 opacity-80" />
              <span className="font-variant-numeric tabular-nums">{time}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/70">
          {date.toLocaleDateString("en-US", { month: "short" })}
        </p>
        <p className="text-[30px] font-black leading-none tabular-nums">{dayOfMonth(date)}</p>
      </div>
    </div>
  );
}
