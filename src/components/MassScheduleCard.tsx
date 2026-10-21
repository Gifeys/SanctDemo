import { useState } from "react";
import { AlertTriangle, CalendarDays, ChevronUp, Clock } from "lucide-react";
import { MASS_SCHEDULES } from "../data";
import { liturgicalDay } from "../lib/liturgical";
import {
  dayOfMonth,
  sundayMassCard,
  weekAhead,
  type MassDay,
  type MassTime,
} from "../lib/sundayMasses";
import { useParishContent } from "../lib/useParishContent";
import WatchBell from "./WatchBell";

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
  const [showWeek, setShowWeek] = useState(false);

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

  // Every day of the coming week, today first.
  const week = weekAhead(schedule, now);

  // Any Mass the parish has marked off this week.
  const suspended =
    (card.anticipated !== null && !card.anticipated.available) ||
    card.sunday.times.some(t => !t.available);

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
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[21px] font-bold leading-[1.2] tracking-tight text-balance">
            {today.name}
          </h3>

          {/* Only where a Mass is actually off. A bell on a schedule with
              nothing wrong with it is an invitation to subscribe to
              silence. The icon carries it alone: a sentence explaining
              the bell took more room than the times it was about. */}
          {suspended && (
            <WatchBell
              watch={{ kind: "mass", parishId: routeId }}
              label="this Mass schedule"
              className="watch-bell--onDark"
              iconOnly
            />
          )}
        </div>

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
                    times={[card.anticipated]}
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

                {/* The rest of the week.
                    The card showed the anticipated Mass and Sunday and
                    nothing else, while every parish also holds weekday
                    Masses - so somebody looking for Tuesday's 6:00 AM
                    was told in effect that it did not exist. It is
                    folded away rather than listed, because Sunday is
                    what most people open this for. */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowWeek(v => !v)}
                    aria-expanded={showWeek}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-black/20 px-3 py-2.5 text-[14px] font-bold text-white/90"
                  >
                    <CalendarDays className="w-4 h-4" aria-hidden />
                    {showWeek ? "Hide the full schedule" : "See the full schedule"}
                  </button>

                  {showWeek && (
                    <div className="mt-3 space-y-3 border-t border-white/20 pt-3">
                      <p className="text-[13px] font-bold uppercase tracking-[0.12em] text-white/70">
                        The week ahead
                      </p>
                      {week.map(day => (
                        <WeekRow key={day.date.toISOString()} day={day} />
                      ))}
                    </div>
                  )}
                </div>
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
/**
 * A suspended Mass is struck through and labelled, not removed.
 *
 * Someone who comes at 8:00 every Sunday needs to see that the 8:00
 * exists and is off this week. An absence tells them nothing - they
 * assume they misremembered and turn up anyway.
 */
function MassRow({ label, times, date }: { label: string; times: MassTime[]; date: Date }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-bold">{label}</p>
        <ul className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
          {times.map(({ time, available }) => (
            <li
              key={time}
              /* A struck-through time is given the whole row.
                 "6:00 AM NOT AVAILABLE" does not fit one half of a
                 two-column grid on a phone, and whitespace-nowrap meant
                 it did not wrap either - it ran straight over the time
                 in the next column. Full width, and the label can sit
                 beside it with room to spare. */
              className={`flex items-center gap-1.5 text-[16px] ${
                available ? "text-white/95" : "col-span-2 text-white/55"
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0 opacity-80" />
              <span className={`font-variant-numeric tabular-nums${available ? "" : " line-through"}`}>
                {time}
              </span>
              {!available && (
                <span className="text-[12px] font-bold uppercase tracking-wider">
                  Not available
                </span>
              )}
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

/**
 * One day of the week ahead.
 *
 * Laid out flat rather than as the two-column grid the Sunday row
 * uses: a weekday usually has one or two Masses, and a grid built for
 * six leaves a hole beside every one of them.
 *
 * A day with no Mass says so. Leaving the row out would make the
 * reader notice an absence between Sunday and Tuesday, which is
 * exactly the kind of thing people get wrong when deciding whether to
 * leave the house.
 */
function WeekRow({ day }: { day: MassDay }) {
  return (
    <div className={`flex items-start gap-3 ${day.isToday ? "" : "opacity-95"}`}>
      <div className="w-[88px] shrink-0">
        <p className="text-[14px] font-bold leading-tight">
          {day.isToday ? "Today" : day.day}
        </p>
        <p className="text-[12px] font-semibold uppercase tracking-wider text-white/60">
          {day.date.toLocaleDateString("en-US", { month: "short" })} {dayOfMonth(day.date)}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        {day.times.length === 0 ? (
          <p className="text-[14px] text-white/55">No Mass</p>
        ) : (
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {day.times.map(({ time, available }) => (
              <li
                key={time}
                className={`flex items-center gap-1.5 text-[15px] ${
                  available ? "text-white/95" : "text-white/55"
                }`}
              >
                <Clock className="w-3.5 h-3.5 shrink-0 opacity-70" aria-hidden />
                <span className={`tabular-nums${available ? "" : " line-through"}`}>
                  {time}
                </span>
                {!available && (
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Off
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        {day.note && (
          <p className="mt-1 text-[13px] leading-snug text-white/70">{day.note}</p>
        )}
      </div>
    </div>
  );
}
