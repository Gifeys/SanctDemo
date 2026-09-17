import { useState } from "react";
import { ArrowLeft, Settings } from "lucide-react";
import DailyRosary from "./DailyRosary";
import { liturgicalDay } from "../lib/liturgical";
import { verseForDate } from "../lib/verses";
import { seasonAccent } from "../lib/liturgicalColours";
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
  const accent = seasonAccent(today.colour);
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
        {/* The day's name leads the screen, with the verse card under it.
            It reads as the date stamp for everything below rather than as
            the mysteries' eyebrow — which is why the heading further down
            now stands on its own, with "Prayed on Fridays and Tuesdays"
            carrying it instead. */}
        <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
          {today.name}
        </p>

        {/* Verse of the Day, at the top of Pray at the client's request.
            It was the last card on Home and then sat below "Begin the
            Rosary"; here it is the first thing on the screen a pilgrim opens
            to read something, and it needs no scrolling to reach.

            The card is painted in the liturgical colour of the day — the
            same green, violet, white/gold, red or rose the priest is
            vested in — so the season is legible at a glance instead of
            being spelled out in words. seasonAccent supplies a wash, a
            border and an ink whose contrast is unit-tested, because a
            seasonal tint is exactly how a card becomes unreadable. */}
        <div
          className="mt-3 rounded-[22px] border p-5 space-y-2.5"
          style={{ backgroundColor: accent.tint, borderColor: accent.border }}
        >
          {/* The title takes the line to itself and the season moved down
              beside the reference. Sharing one row, the two of them needed
              274px and had 273: "VERSE OF THE DAY" wrapped to two lines on
              the narrower phones, which is what the redesign had been living
              with. Below, it reads the way a missal is laid out — the words,
              then where they are from and when they are read. */}
          <h4
            className="text-[14px] font-mono uppercase tracking-[0.14em] whitespace-nowrap"
            style={{ color: accent.ink }}
          >
            Verse of the Day
          </h4>
          <blockquote className="text-[16px] text-[var(--color-brand-text)] leading-relaxed">
            &ldquo;{verse.text}&rdquo;
          </blockquote>
          <div className="flex items-baseline justify-between gap-3">
            <cite className="text-[15px] font-semibold not-italic" style={{ color: accent.ink }}>
              {verse.reference}
            </cite>
            <span className="text-[14px] shrink-0 text-[var(--color-brand-secondary)]">
              {verse.season}
            </span>
          </div>
        </div>

        <h1 className="mt-6 text-[30px] font-bold leading-[1.12] tracking-tight text-[var(--color-brand-text)]">
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
