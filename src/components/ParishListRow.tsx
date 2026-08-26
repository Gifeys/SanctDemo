import { Check } from "lucide-react";
import { usePresence } from "../context/PresenceContext";
import { haversineMeters, type Coordinates } from "../lib/geo";
import { formatDistance, formatWalkingMinutes, WALK_SPEED_MPS } from "../lib/routing";

export interface ParishRowData {
  id: string;
  name: string;
  /** Vicariate, town, or whatever secondary line the caller has. */
  meta?: string;
  coordinates?: Coordinates;
  /** True for the two parishes with a tour, schedule and history behind them. */
  isLive?: boolean;
}

interface ParishListRowProps {
  parish: ParishRowData;
  onSelect: (parishId: string) => void;
  selected?: boolean;
  /** Pre-computed distance, when the caller already has it (e.g. from search). */
  distanceMeters?: number | null;
}

/**
 * One parish in a list — the row shared by onboarding, search and anywhere
 * else the diocese is enumerated.
 *
 * The design's rows read "Vicariate of San Roque · 0.7 km away". Both halves
 * are conditional here for the same reason: the vicariate in this dataset is
 * inferred rather than official (flagged vicariateVerified: false), and the
 * distance needs a GPS fix. Neither is invented when missing — the row simply
 * shows less.
 */
export default function ParishListRow({ parish, onSelect, selected, distanceMeters }: ParishListRowProps) {
  const { position } = usePresence();

  const metres =
    distanceMeters !== undefined
      ? distanceMeters
      : position && parish.coordinates
        ? haversineMeters(position, parish.coordinates)
        : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(parish.id)}
      aria-pressed={selected}
      className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl border transition-colors ${
        selected
          ? "bg-[var(--color-brand-card-sunk)] border-[var(--color-brand-primary)]"
          : "bg-[var(--color-brand-card)] border-[var(--color-brand-border)]"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[16px] font-semibold text-[var(--color-brand-text)] leading-snug">
            {parish.name}
          </p>
          {parish.isLive && (
            <span className="text-[14px] font-semibold px-2 py-0.5 rounded-md bg-[var(--color-brand-success)] text-[var(--color-brand-on-accent)]">
              Live
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[15px] text-[var(--color-brand-secondary)] leading-snug">
          {[
            parish.meta,
            metres !== null ? `${formatDistance(metres)} away` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Distance unknown — location is off"}
        </p>
        {metres !== null && (
          <p className="mt-0.5 text-[15px] text-[var(--color-brand-primary)] font-medium tabular-nums">
            about {formatWalkingMinutes(metres / WALK_SPEED_MPS / 60)} on foot
          </p>
        )}
      </div>

      {selected && (
        <span
          aria-hidden
          className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] flex items-center justify-center"
        >
          <Check className="w-4 h-4" />
        </span>
      )}
    </button>
  );
}
