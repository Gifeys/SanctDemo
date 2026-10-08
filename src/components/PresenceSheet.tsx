import { useEffect, useState } from "react";
import { ChevronUp, ScanLine, Map as MapIcon, X } from "lucide-react";
import { usePresence } from "../context/PresenceContext";
import { nextMass } from "../lib/schedule";
import { MASS_SCHEDULES } from "../data";

interface PresenceSheetProps {
  onOpenTour: (parishId: string) => void;
  onOpenAR: (parishId: string) => void;
}

function nextMassLabel(parishId: string): string {
  const parishSchedule = MASS_SCHEDULES[parishId];
  const upcoming = nextMass(parishSchedule?.schedule ?? [], new Date());

  // A parish with no schedule at all (real or placeholder) reads as a calm,
  // complete sentence rather than a blank or broken line.
  if (!upcoming) return "Mass schedule coming soon";

  const today = new Date();
  const isToday = upcoming.date.toDateString() === today.toDateString();
  const label = `Next Mass: ${isToday ? "Today" : upcoming.day}, ${upcoming.time}`;

  // The times behind this label may be an unverified placeholder (see
  // data.ts's scheduleVerified flag) — this quick-glance sheet must not
  // state a Mass time as fact when it hasn't been confirmed by the parish.
  return parishSchedule?.scheduleVerified === false ? `${label} (sample, unconfirmed)` : label;
}

// Rendered only in `present`. Anchored `absolute` (never `fixed`) against the
// same relative "phone screen" container the bottom nav bar uses, offset by
// exactly the nav bar's own height (h-16 / 64px) so the sheet sits above it
// rather than covering it. No backdrop/scrim behind it — the design
// deliberately avoids that commercial-app idiom.
export default function PresenceSheet({ onOpenTour, onOpenAR }: PresenceSheetProps) {
  const { presence, parish } = usePresence();
  const [collapsed, setCollapsed] = useState(false);
  /**
   * Dismissed outright, not just collapsed.
   *
   * Collapsing leaves a bar across the bottom of every screen. Someone
   * who is standing in their own parish all morning does not need to be
   * told so all morning, so the X takes it away entirely until they
   * arrive somewhere else.
   */
  const [dismissed, setDismissed] = useState(false);

  // Arriving at a different parish (or leaving/re-entering `present`) must
  // re-open the sheet — a pilgrim who hid it at one church shouldn't find it
  // silently hidden at the next one.
  useEffect(() => {
    setCollapsed(false);
    setDismissed(false);
  }, [presence.parishId, presence.mode]);

  if (presence.mode !== "present" || !parish || dismissed) return null;

  const displayName = parish.name.replace(" Guide", "").replace(" Tour", "");

  if (collapsed) {
    return (
      <div className="absolute bottom-16 inset-x-0 z-40 px-3 pb-2">
        <div className="w-full flex items-center gap-1 px-2 py-1 rounded-2xl shadow-md bg-[var(--color-brand-primary)] border border-[var(--color-brand-border)]">
          <button
            onClick={() => setCollapsed(false)}
            className="flex-1 min-w-0 flex items-center justify-between gap-2 px-2 py-2 text-left"
          >
            <span className="text-[16px] font-bold text-white font-sans truncate">
              You are near {displayName}
            </span>
            <ChevronUp className="w-4 h-4 text-[var(--color-brand-card)] shrink-0" />
          </button>

          {/* Its own button, outside the expand target: a dismiss nested
              inside "tap to expand" is a tap that does the opposite of
              what the row says. */}
          <button
            onClick={() => setDismissed(true)}
            aria-label="Hide this until I reach another parish"
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-16 inset-x-0 z-40 px-3 pb-2">
      <div className="rounded-3xl shadow-lg transition-all duration-300 ease-out bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-bold uppercase tracking-widest text-[var(--color-brand-secondary)] font-sans">
              You are near
            </span>
            <h3 className="text-lg font-bold text-[var(--color-brand-text)] font-serif italic leading-tight mt-0.5">
              {displayName}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Two different things, so two buttons. "Hide" leaves the
                thin bar you can tap to bring this back; the X means you
                do not want to be told again at this parish. */}
            <button
              onClick={() => setCollapsed(true)}
              className="text-[15px] font-bold text-[var(--color-brand-secondary)] px-2 py-1 rounded-lg hover:bg-[var(--color-brand-card)] transition-colors"
            >
              Hide
            </button>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss until I reach another parish"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-brand-secondary)] hover:bg-[var(--color-brand-card)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-[16px] font-bold text-[var(--color-brand-primary)] bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] hover:bg-[var(--color-brand-card)] transition-colors font-sans"
          >
            <ScanLine className="w-4 h-4" /> AR Tour
          </button>
        </div>
      </div>
    </div>
  );
}
