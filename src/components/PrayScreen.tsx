import { useState } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import DailyRosary from "./DailyRosary";
import { liturgicalDay } from "../lib/liturgical";
import { daysForMystery, mysteryForDate } from "../lib/mysteries";
import { MASS_SCHEDULES, ROSARY_MYSTERIES } from "../data";
import { nextMass, parseTimes } from "../lib/schedule";

interface PrayScreenProps {
  onOpenSettings: () => void;
  /** The active parish, whose Mass times this screen now carries. */
  parishId: string;
  parishName: string;
}

/**
 * The Pray screen — the redesign's screen 09.
 *
 * This is a wrapper, deliberately. The rosary itself is the client's own
 * hand-built app, mounted in an iframe (see DailyRosary), and it keeps its
 * own design, music and slideshow untouched. Only the screen around it is
 * restyled.
 *
 * That boundary is also why there is no "2 of 5 decades today" progress line
 * here as the mockup has: decade progress lives inside the iframe's own
 * state, which this side cannot read. Showing a number this screen cannot
 * know would be inventing it.
 */
export default function PrayScreen({ onOpenSettings, parishId, parishName }: PrayScreenProps) {
  const [praying, setPraying] = useState(false);
  const now = new Date();
  const today = liturgicalDay(now);
  const set = mysteryForDate(now);
  const mystery = ROSARY_MYSTERIES.find(m => m.category === set);

  // Mass times moved here from Home. Pray is now everything you would do at
  // church today, and Mass leads because it is the time-critical half — a
  // Rosary can be prayed at any hour, a 6:00 AM Mass cannot.
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const schedule = MASS_SCHEDULES[parishId];
  const todayTimes = schedule?.schedule
    ? parseTimes(schedule.schedule.find(d => d.day === DAYS[now.getDay()])?.time ?? "")
    : [];
  const upcoming = schedule?.schedule ? nextMass(schedule.schedule, now) : null;

  if (praying) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-brand-card)]">
        <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-brand-border)]">
          <button
            type="button"
            onClick={() => setPraying(false)}
            className="flex items-center gap-1.5 text-[16px] font-semibold text-[var(--color-brand-primary)]"
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <span className="text-[15px] text-[var(--color-brand-secondary)]">{set} Mysteries</span>
        </div>
        <DailyRosary />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[var(--color-brand-card)]">
      <div className="shrink-0 flex items-center justify-end px-4 pt-4">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Rosary settings"
          className="w-10 h-10 rounded-full bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] flex items-center justify-center text-[var(--color-brand-secondary)]"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <div className="px-5 pb-6">
        <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
          {today.name}
        </p>

        {/* Today's Masses at the active parish. */}
        <section className="mt-4 rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[16px] font-semibold text-[var(--color-brand-text)]">Mass today</h2>
            <span className="text-[15px] text-[var(--color-brand-secondary)] truncate">{parishName}</span>
          </div>

          {todayTimes.length > 0 ? (
            <ul className="mt-3 space-y-2">
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
              {schedule
                ? `No Mass listed for ${DAYS[now.getDay()]}.`
                : "This parish's Mass times have not been collected yet."}
            </p>
          )}

          {upcoming && (
            <p className="mt-3 pt-3 border-t border-[var(--color-brand-border)] text-[15px] text-[var(--color-brand-secondary)]">
              Next: {upcoming.day} {upcoming.time}
            </p>
          )}
          {schedule && !schedule.scheduleVerified && (
            <p className="mt-2 text-[15px] leading-snug text-[var(--color-brand-error)]">
              These times are unconfirmed — check with the parish before travelling.
            </p>
          )}
        </section>
        <h1 className="mt-3 text-[30px] font-bold leading-[1.12] tracking-tight text-[var(--color-brand-text)]">
          The {set}
          <br />
          Mysteries
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--color-brand-secondary)]">
          {daysForMystery(set)}. You can tap to move on at any point — nothing here has to be
          finished in one sitting.
        </p>

        <button
          type="button"
          onClick={() => setPraying(true)}
          className="mt-6 w-full py-3.5 rounded-full text-[16px] font-semibold bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)]"
        >
          Begin the Rosary
        </button>

        {mystery && (
          <ol className="mt-7 space-y-3">
            {mystery.prayers.map((decade, index) => {
              // The data stores each decade as "1. The Resurrection: Jesus
              // rises…". Split so the name can lead and the description can
              // sit under it, rather than rendering the numbering twice.
              const withoutNumber = decade.replace(/^\d+\.\s*/, "");
              const [name, ...rest] = withoutNumber.split(":");
              return (
                <li key={decade} className="flex gap-3.5">
                  <span className="shrink-0 w-8 text-[14px] font-mono text-[var(--color-brand-secondary)] pt-0.5">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold text-[var(--color-brand-text)] leading-snug">
                      {name.trim()}
                    </p>
                    {rest.length > 0 && (
                      <p className="mt-0.5 text-[15px] leading-snug text-[var(--color-brand-secondary)]">
                        {rest.join(":").trim()}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
