import { useEffect, useState } from "react";
import { ChevronUp, ScanLine, Map as MapIcon } from "lucide-react";
import { usePresence } from "../context/PresenceContext";
import { nextMass } from "../lib/schedule";
import { MASS_SCHEDULES } from "../data";

interface PresenceSheetProps {
  onOpenTour: (parishId: string) => void;
  onOpenAR: (parishId: string) => void;
}

function nextMassLabel(parishId: string): string {
  const schedule = MASS_SCHEDULES[parishId] ?? [];
  const upcoming = nextMass(schedule, new Date());

  // San Roque's schedule is deliberately empty in data.ts (not yet
  // published) — nextMass() correctly returns null for that, and this must
  // read as a calm, complete sentence rather than a blank or broken line.
  if (!upcoming) return "Mass schedule coming soon";

  const today = new Date();
  const isToday = upcoming.date.toDateString() === today.toDateString();
  return `Next Mass: ${isToday ? "Today" : upcoming.day}, ${upcoming.time}`;
}

// Rendered only in `present`. Anchored `absolute` (never `fixed`) against the
// same relative "phone screen" container the bottom nav bar uses, offset by
// exactly the nav bar's own height (h-16 / 64px) so the sheet sits above it
// rather than covering it. No backdrop/scrim behind it — the design
// deliberately avoids that commercial-app idiom.
export default function PresenceSheet({ onOpenTour, onOpenAR }: PresenceSheetProps) {
  const { presence, parish } = usePresence();
  const [collapsed, setCollapsed] = useState(false);

  // Arriving at a different parish (or leaving/re-entering `present`) must
  // re-open the sheet — a pilgrim who hid it at one church shouldn't find it
  // silently hidden at the next one.
  useEffect(() => {
    setCollapsed(false);
  }, [presence.parishId, presence.mode]);

  if (presence.mode !== "present" || !parish) return null;

  const displayName = parish.name.replace(" Guide", "").replace(" Tour", "");

  if (collapsed) {
    return (
      <div className="absolute bottom-16 inset-x-0 z-40 px-3 pb-2">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl shadow-md transition-all duration-300 ease-out bg-[var(--color-brand-primary)] border border-[var(--color-brand-border)]"
        >
          <span className="text-[16px] font-bold text-white font-sans">
            You are near {displayName}
          </span>
          <ChevronUp className="w-4 h-4 text-[var(--color-brand-card)] shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-16 inset-x-0 z-40 px-3 pb-2">
      <div className="rounded-3xl shadow-lg transition-all duration-300 ease-out bg-white border border-[var(--color-brand-border)] p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-bold uppercase tracking-widest text-[var(--color-brand-secondary)] font-sans">
              You are near
            </span>
            <h3 className="text-lg font-bold text-[var(--color-brand-text)] font-serif italic leading-tight mt-0.5">
              {displayName}
            </h3>
          </div>
          <button
            onClick={() => setCollapsed(true)}
            className="text-[15px] font-bold text-[var(--color-brand-secondary)] px-2 py-1 rounded-lg hover:bg-[var(--color-brand-card)] transition-colors shrink-0"
          >
            Hide
          </button>
        </div>

        <p className="text-[15px] text-[var(--color-brand-text)] font-sans">
          {nextMassLabel(parish.id)}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onOpenTour(parish.id)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[16px] font-bold text-white bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] transition-colors font-sans"
          >
            <MapIcon className="w-4 h-4" /> Open Tour
          </button>
          <button
            onClick={() => onOpenAR(parish.id)}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[16px] font-bold text-[var(--color-brand-primary)] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] hover:bg-white transition-colors font-sans"
          >
            <ScanLine className="w-4 h-4" /> AR Tour
          </button>
        </div>
      </div>
    </div>
  );
}
