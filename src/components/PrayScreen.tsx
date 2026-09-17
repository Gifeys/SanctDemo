import { useState } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import DailyRosary from "./DailyRosary";
import { liturgicalDay } from "../lib/liturgical";
import { verseForDate } from "../lib/verses";
import { daysForMystery, mysteryForDate } from "../lib/mysteries";
import { ROSARY_MYSTERIES } from "../data";

interface PrayScreenProps {
  onOpenSettings: () => void;
}

/**
 * The Pray screen — the redesign's screen 09.
 *
 * This is a wrapper, deliberately. The rosary itself is the client's own
 * hand-built app, mounted in an iframe (see DailyRosary), and it keeps its
 * own design, music and slideshow untouched. Only the screen around it is
 * restyled.
 *
 * Mass times briefly lived here too. They were moved back out: a screen that
 * mixes a schedule with a prayer reads as two half-screens rather than one,
 * and the parish page already answers "when is Mass" under "Today at this
 * church". Pray is the Rosary.
 *
 * That boundary is also why there is no "2 of 5 decades today" progress line
 * here as the mockup has: decade progress lives inside the iframe's own
 * state, which this side cannot read. Showing a number this screen cannot
 * know would be inventing it.
 */
export default function PrayScreen({ onOpenSettings }: PrayScreenProps) {
  const [praying, setPraying] = useState(false);
  const now = new Date();
  const today = liturgicalDay(now);
  const verse = verseForDate(now);

  // The season label used to sit in the Verse of the Day card; the client
  // moved it up to the day line at the top. That line already spells the
  // season out on most days — "Friday of the 24th Week in Ordinary Time" —
  // so it is appended only on the days that do not name it: Easter Sunday,
  // Pentecost, Christmas Day, Ash Wednesday and the days just after it.
  // Otherwise the line would read "…in Ordinary Time · Ordinary Time".
  const dayLine = today.name.includes(today.season)
    ? today.name
    : `${today.name} · ${today.season}`;
  const set = mysteryForDate(now);
  const mystery = ROSARY_MYSTERIES.find(m => m.category === set);

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
          {dayLine}
        </p>

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

        {/* Verse of the Day — moved here from Home, where it was the last
            card on a long scroll. It is chosen for the liturgical season and
            rotates by date, so it really is "of the day", and it sits between
            the invitation to pray and the decades themselves: something to
            read whether or not the pilgrim starts the Rosary now. */}
        <div className="mt-6 rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-5 space-y-2.5">
          {/* The season no longer sits here. It said the same thing as the
              day line at the top of this screen, and squeezed into the
              card's right-hand corner it wrapped to two lines. */}
          <h4 className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
            Verse of the Day
          </h4>
          <blockquote className="text-[16px] text-[var(--color-brand-text)] leading-relaxed">
            &ldquo;{verse.text}&rdquo;
          </blockquote>
          <cite className="text-[15px] font-semibold text-[var(--color-brand-primary)] block not-italic">
            {verse.reference}
          </cite>
        </div>

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
