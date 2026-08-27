import React, { useEffect, useState } from "react";
import {
  Clock, Heart, BookOpen, User, MapPin, Bookmark,
  ScanLine as ArIcon, Users as MinistryIcon, Map, Search,
} from "lucide-react";
import { Route } from "../types";
import { MASS_SCHEDULES, ROSARY_MYSTERIES } from "../data";
import { nextMass } from "../lib/schedule";
import HomeHero from "./HomeHero";
import BulletinRail from "./BulletinRail";
import { liturgicalDay } from "../lib/liturgical";
import { verseForDate } from "../lib/verses";
import { MYSTERY_BY_WEEKDAY } from "../lib/mysteries";

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
  /** Opens the full-screen parish search. */
  onOpenSearch: () => void;
}

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

export default function Dashboard({ parish, announcements, onNavigate, onSelectParish, onWalkThere, onOpenSearch }: DashboardProps) {
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
  const verse = verseForDate(now);
  const todaysMysteryCategory = MYSTERY_BY_WEEKDAY[now.getDay()];
  const todaysMystery = ROSARY_MYSTERIES.find((m) => m.category === todaysMysteryCategory);

  const todaysEvent = announcements.find((ann) => {
    const d = new Date(ann.date);
    return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
  });

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] text-left">
      {/* Header. The date leads, where the app's own name used to sit — the
          name is on the tab bar and the icon already, and the date is the
          thing that actually changes. The liturgical day sits under the
          parish name, so the whole "what day is it" answer is in one place
          instead of repeated in a card below. */}
      <div className="px-5 pt-6 pb-2 shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)] block">
            {now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <h2 className="text-[24px] font-bold text-[var(--color-brand-text)] tracking-tight leading-tight mt-0.5">
            {parishName}
          </h2>
          <p className="mt-1 text-[15px] leading-snug text-[var(--color-brand-secondary)]">
            {today.name}
          </p>
        </div>
        <button
          onClick={() => onNavigate("me")}
          className="h-9 w-9 rounded-full bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-[var(--color-brand-secondary)] flex items-center justify-center shadow-xs cursor-pointer active:scale-95 transition-all hover:bg-[var(--color-brand-card)]"
          aria-label="Me"
        >
          <User className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 space-y-4 font-sans">
        <button
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2.5 px-4 py-3 rounded-full bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] text-left"
        >
          <Search className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
          <span className="text-[16px] text-[var(--color-brand-secondary)]">Search parish or place</span>
        </button>

        {/* The redesign's hero. It features the parish you are actually
            closest to, which is usually one of the 29 with no content
            collected yet — see HomeHero for what it does about that. */}
        <HomeHero onWalkThere={onWalkThere} onOpenParish={onSelectParish} />

        {/* The parish bulletin — live announcements, swiping. */}
        <BulletinRail announcements={announcements} onNavigate={onNavigate} />

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

        {/* Quick Navigation grid — everything here belongs to the active
            parish and follows it when it changes. */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-base font-bold text-[var(--color-brand-text)]">
            <button
              onClick={() => onNavigate("mass")}
              className="bg-[var(--color-brand-card)] p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <Clock className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>Mass</span>
            </button>

            <button
              onClick={() => onNavigate("history")}
              className="bg-[var(--color-brand-card)] p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <Bookmark className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>History</span>
            </button>

            <button
              onClick={() => onNavigate("ministries")}
              className="bg-[var(--color-brand-card)] p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <MinistryIcon className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>Ministries</span>
            </button>

            <button
              onClick={() => onNavigate("sacraments")}
              className="bg-[var(--color-brand-card)] p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <Heart className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>Sacraments</span>
            </button>

            <button
              onClick={() => onNavigate("ar")}
              className="bg-[var(--color-brand-card)] p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <ArIcon className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0 animate-pulse" />
              <span>AR Tour</span>
            </button>

            <button
              onClick={() => onNavigate("navigator")}
              className="bg-[var(--color-brand-card)] p-3.5 rounded-2xl border border-[var(--color-brand-border)] flex items-center gap-2.5 shadow-xs hover:border-[var(--color-brand-primary)] text-left transition-colors"
            >
              <Map className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
              <span>The Walk</span>
            </button>
          </div>
        </div>

        {/* Dynamic Announcements Bulletin board — parish events */}
        <div className="bg-[var(--color-brand-card)] rounded-3xl border border-[var(--color-brand-border)] p-4.5 shadow-xs space-y-3">
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

        {/* Diocese-wide, and the only thing left here now that the map has
            its own tab, the Rosary lives on Pray, and Mass times moved to
            Pray with it. */}
        {/* Verse of the Day — chosen for the liturgical season and rotating
            by date, so it is actually "of the day". Was one hardcoded verse
            that never changed. */}
        <div className="rounded-[22px] bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)] p-5 space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
              Verse of the Day
            </h4>
            <span className="text-[14px] text-[var(--color-brand-secondary)]">{verse.season}</span>
          </div>
          <blockquote className="text-[16px] text-[var(--color-brand-text)] leading-relaxed">
            &ldquo;{verse.text}&rdquo;
          </blockquote>
          <cite className="text-[15px] font-semibold text-[var(--color-brand-primary)] block not-italic">
            {verse.reference}
          </cite>
        </div>
      </div>
    </div>
  );
}
