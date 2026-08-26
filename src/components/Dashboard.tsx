import React, { useEffect, useState } from "react";
import {
  Clock, Heart, BookOpen, User, MapPin, Bookmark,
  ScanLine as ArIcon, Users as MinistryIcon, Map,
} from "lucide-react";
import { Route } from "../types";
import { MASS_SCHEDULES, ROSARY_MYSTERIES } from "../data";
import { nextMass } from "../lib/schedule";
import CustomDioceseMap from "./CustomDioceseMap";
import HomeHero from "./HomeHero";
import { liturgicalDay } from "../lib/liturgical";

type Announcement = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
};

interface DashboardProps {
  parish: Route;
  announcements: Announcement[];
  onNavigate: (
    tab: "mass" | "history" | "ministries" | "sacraments" | "ar" | "navigator" | "rosary" | "me"
  ) => void;
  onSelectParish: (parishId: string) => void;
  /** Opens the Map tab with a walking route already drawn to this parish. */
  onWalkThere: (parishId: string) => void;
}

// Standard Catholic weekday cycle for which set of Mysteries is prayed —
// diocese-wide, not tied to any parish. Sunday and Wednesday both carry the
// Glorious Mysteries in the usual cycle.
const MYSTERY_BY_WEEKDAY: Record<number, "Joyful" | "Sorrowful" | "Glorious" | "Luminous"> = {
  0: "Glorious", // Sunday
  1: "Joyful", // Monday
  2: "Sorrowful", // Tuesday
  3: "Glorious", // Wednesday
  4: "Luminous", // Thursday
  5: "Sorrowful", // Friday
  6: "Joyful", // Saturday
};

function parishDisplayName(parish: Route): string {
  return parish.name.replace(" Guide", "").replace(" Tour", "");
}

// "in 3 hours", "in 25 minutes" — coarse enough to stay readable, fine
// enough that a pilgrim glancing at the dashboard can tell whether to
// hurry. Recomputed every 30s by the caller so it never goes stale while
// the dashboard is left open.
export function formatCountdown(target: Date, now: Date): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return "starting now";

  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes < 1) return "in under a minute";
  if (totalMinutes < 60) return `in ${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;

  const hours = Math.round(totalMinutes / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? "" : "s"}`;

  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

export default function Dashboard({ parish, announcements, onNavigate, onSelectParish, onWalkThere }: DashboardProps) {
  const parishName = parishDisplayName(parish);
  const [now, setNow] = useState(() => new Date());

  // Keeps the countdown fresh without needing the pilgrim to reopen the tab.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const parishSchedule = MASS_SCHEDULES[parish.id];
  const upcomingMass = nextMass(parishSchedule?.schedule ?? [], now);

  const today = liturgicalDay(now);
  const todaysMysteryCategory = MYSTERY_BY_WEEKDAY[now.getDay()];
  const todaysMystery = ROSARY_MYSTERIES.find((m) => m.category === todaysMysteryCategory);

  const todaysEvent = announcements.find((ann) => {
    const d = new Date(ann.date);
    return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
  });

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] text-left">
      {/* Header — app first, home parish beneath it. The date moves into the
          Today card, where it now sits with the liturgical day. */}
      <div className="px-5 pt-6 pb-2 shrink-0 flex items-center justify-between">
        <div>
          <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)] block">
            SanctiWalk
          </span>
          <h2 className="text-[24px] font-bold text-[var(--color-brand-text)] tracking-tight leading-tight mt-0.5">
            {parishName}
          </h2>
        </div>
        <button
          onClick={() => onNavigate("me")}
          className="h-9 w-9 rounded-full bg-white border border-[var(--color-brand-border)] text-[var(--color-brand-secondary)] flex items-center justify-center shadow-xs cursor-pointer active:scale-95 transition-all hover:bg-[var(--color-brand-card)]"
          aria-label="Me"
        >
          <User className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 font-sans">
        {/* The redesign's hero. It features the parish you are actually
            closest to, which is usually one of the 29 with no content
            collected yet — see HomeHero for what it does about that. */}
        <HomeHero onWalkThere={onWalkThere} onOpenParish={onSelectParish} />

        {/* The day, named the way a parish bulletin names it. Computed from
            the date of Easter rather than stored, so it stays right without
            anyone maintaining a table. */}
        <button
          onClick={() => onNavigate("rosary")}
          className="w-full text-left rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-5"
        >
          <p className="text-[16px] font-semibold text-[var(--color-brand-text)]">
            {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className="mt-1 text-[15px] leading-snug text-[var(--color-brand-secondary)]">
            {today.name}
          </p>
          <p className="mt-3 pt-3 border-t border-[var(--color-brand-border)] text-[16px] font-semibold text-[var(--color-brand-primary)]">
            {todaysMysteryCategory} Mysteries ›
          </p>
        </button>

        {/* SECTION 0: TODAY — what a pilgrim needs right now, before anything
            else on the screen. Always the first thing rendered under the
            header, ahead of the parish grid and the diocese-wide section. */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest pl-1 font-sans">
            Today
          </h3>

          <button
            onClick={() => onNavigate("mass")}
            className="w-full bg-white rounded-2xl border border-[var(--color-brand-border)] shadow-xs p-4 text-left transition-colors hover:border-[var(--color-brand-primary)] space-y-1.5"
          >
            <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider">
              <Clock className="w-4 h-4 text-[var(--color-brand-secondary)]" />
              <span>Next Mass at {parishName}</span>
            </div>
            {upcomingMass ? (
              <>
                <p className="text-2xl font-black text-[var(--color-brand-text)] tracking-tight">
                  {formatCountdown(upcomingMass.date, now)}
                </p>
                <p className="text-[15px] text-[var(--color-brand-text)]">
                  {upcomingMass.date.toDateString() === now.toDateString() ? "Today" : upcomingMass.day}, {upcomingMass.time}
                </p>
                {parishSchedule?.scheduleVerified === false && (
                  <p className="text-sm font-bold text-amber-800 bg-amber-50 border border-amber-300 rounded-xl px-2.5 py-1.5 mt-1">
                    Sample schedule — not yet confirmed with the parish. Please call ahead before you go.
                  </p>
                )}
              </>
            ) : (
              <p className="text-[15px] text-[var(--color-brand-text)]">Mass schedule not yet published for this parish.</p>
            )}
          </button>

          <button
            onClick={() => onNavigate("rosary")}
            className="w-full bg-white rounded-2xl border border-[var(--color-brand-border)] shadow-xs p-4 text-left transition-colors hover:border-[var(--color-brand-primary)] space-y-1"
          >
            <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider">
              <BookOpen className="w-4 h-4 text-[var(--color-brand-secondary)]" />
              <span>Today's Mystery</span>
            </div>
            <p className="text-lg font-bold text-[var(--color-brand-text)]">
              {todaysMystery ? todaysMystery.title : "The Rosary"}
            </p>
            <p className="text-[15px] text-[var(--color-brand-secondary)]">Tap to pray the Rosary</p>
          </button>

          {todaysEvent && (
            <div className="w-full bg-white rounded-2xl border border-[var(--color-brand-border)] shadow-xs p-4 space-y-1">
              <div className="flex items-center gap-2 text-[15px] font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider">
                <Bookmark className="w-4 h-4 text-[var(--color-brand-secondary)]" />
                <span>Happening Today</span>
              </div>
              <p className="text-lg font-bold text-[var(--color-brand-text)]">{todaysEvent.title}</p>
              <p className="text-[15px] text-[var(--color-brand-secondary)]">{todaysEvent.date} at {todaysEvent.time}</p>
            </div>
          )}
        </div>

        {/* SECTION 1: content tied to the active parish. Its heading names
            that parish explicitly so switching parish (Location Simulator)
            makes the change obvious without needing an explanation —
            everything under this heading is specific to {parishName}, and
            only this section should change when the active parish changes. */}
        <div className="pt-2">
          <h3 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest font-serif italic">
            At {parishName}
          </h3>
        </div>

        {/* Diocese map card — tapping a live pin opens that parish's tour,
            same handler the Map tab uses. */}
        <div className="bg-white rounded-3xl border border-[var(--color-brand-border)] shadow-xs p-3 h-64">
          <CustomDioceseMap onSelectParish={onSelectParish} />
        </div>

        {/* Quick Navigation grid — everything here belongs to the active
            parish and follows it when it changes. */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-base font-bold text-[var(--color-brand-text)]">
            <button
              onClick={() => onNavigate("mass")}
              className="bg-white p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <Clock className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>Mass</span>
            </button>

            <button
              onClick={() => onNavigate("history")}
              className="bg-white p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <Bookmark className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>History</span>
            </button>

            <button
              onClick={() => onNavigate("ministries")}
              className="bg-white p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <MinistryIcon className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>Ministries</span>
            </button>

            <button
              onClick={() => onNavigate("sacraments")}
              className="bg-white p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <Heart className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>Sacraments</span>
            </button>

            <button
              onClick={() => onNavigate("ar")}
              className="bg-white p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <ArIcon className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0 animate-pulse" />
              <span>AR Tour</span>
            </button>

            <button
              onClick={() => onNavigate("navigator")}
              className="bg-white p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <Map className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>The Walk</span>
            </button>
          </div>
        </div>

        {/* Dynamic Announcements Bulletin board — parish events */}
        <div className="bg-white rounded-3xl border border-[var(--color-brand-border)] p-4.5 shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-[var(--color-brand-card)] pb-1.5">
            <h4 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans">
              Upcoming Parish Events
            </h4>
            <span className="text-sm font-mono text-[var(--color-brand-secondary)] bg-[var(--color-brand-card)] px-2 py-0.5 rounded">
              {parishName} Bulletin
            </span>
          </div>

          <div className="space-y-2.5">
            {announcements.map((ann) => (
              <div key={ann.id} className="flex gap-3 items-start text-[15px] border-b border-[var(--color-brand-card)]/60 pb-2 last:border-0 last:pb-0">
                <div className="p-2 bg-[var(--color-brand-card)] text-[var(--color-brand-secondary)] font-bold rounded-lg text-center font-mono w-14 shrink-0 text-sm">
                  {ann.type}
                </div>
                <div>
                  <h5 className="font-bold text-[var(--color-brand-text)] font-sans text-[15px]">{ann.title}</h5>
                  <p className="text-sm text-[var(--color-brand-secondary)] font-sans mt-0.5">{ann.date} at {ann.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: content that never changes with the active parish —
            kept visually and structurally separate from Section 1 above so
            the split is obvious without a word of explanation. */}
        <div className="pt-2">
          <h3 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-widest pl-1 font-sans border-t border-white/15 pt-4">
            Every Day
          </h3>
        </div>

        <button
          onClick={() => onNavigate("rosary")}
          className="w-full bg-white p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors text-base font-bold text-[var(--color-brand-text)]"
        >
          <BookOpen className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
          <span>Daily Rosary</span>
        </button>

        {/* Verse of the day — diocese-wide, not tied to any parish */}
        <div className="bg-white rounded-3xl border border-[var(--color-brand-border)] p-4.5 shadow-xs space-y-2">
          <h4 className="text-sm font-bold text-[var(--color-brand-secondary)] uppercase tracking-wider font-sans">
            Verse of the Day
          </h4>
          <blockquote className="text-[15px] text-[var(--color-brand-text)] leading-relaxed italic font-serif">
            "He has given us his very great and precious promises, so that through them you may participate in the divine nature and escape the corruption in the world caused by evil desires."
          </blockquote>
          <cite className="text-sm font-bold text-[var(--color-brand-secondary)] block font-mono">
            — 2 Peter 1:4
          </cite>
        </div>
      </div>
    </div>
  );
}
