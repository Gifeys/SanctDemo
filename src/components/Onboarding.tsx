import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { usePresence } from "../context/PresenceContext";
import { searchParishesScored } from "../lib/mapSearch";
import { haversineMeters, type Coordinates } from "../lib/geo";
import ParishListRow from "./ParishListRow";
import parishData from "../data/diocese-parishes.json";

interface DioceseParish {
  id: string;
  name: string;
  vicariate: string;
  vicariateVerified?: boolean;
  coordinates: Coordinates;
  status: string;
}

const PARISHES = (parishData as { parishes: DioceseParish[] }).parishes;

interface OnboardingProps {
  onChoose: (parishId: string) => void;
}

/**
 * "Choose your home parish" — the redesign's first screen.
 *
 * The mockup says 47 parishes; this diocese has 31 in the dataset, and the
 * count is read from the data rather than written into the copy so it cannot
 * drift from what the list actually shows.
 *
 * Parishes are ordered by distance when there is a GPS fix, because the one
 * you are standing in is almost always the one you want. Without a fix they
 * fall back to alphabetical rather than an arbitrary file order.
 */
export default function Onboarding({ onChoose }: OnboardingProps) {
  const { position, gpsStatus } = usePresence();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const rows = useMemo<{ parish: DioceseParish; metres: number | null }[]>(() => {
    const withDistance = PARISHES.map(p => ({
      parish: p,
      metres: position ? haversineMeters(position, p.coordinates) : null,
    }));

    if (query.trim()) {
      const searchable = PARISHES.map(p => ({
        id: p.id,
        name: p.name,
        location: p.vicariate ?? "",
        coordinates: p.coordinates,
      }));
      const hits = searchParishesScored(query, searchable, { origin: position });
      return hits.map(h => ({
        parish: PARISHES.find(p => p.id === h.parish.id)!,
        metres: h.distanceMeters,
      }));
    }

    return withDistance.sort((a, b) => {
      if (a.metres !== null && b.metres !== null) return a.metres - b.metres;
      return a.parish.name.localeCompare(b.parish.name);
    });
  }, [query, position?.lat, position?.lng]);

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] min-h-0">
      <div className="px-5 pt-8 pb-4 shrink-0">
        <p className="text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
          SanctiWalk
        </p>
        <h1 className="mt-3 text-[30px] font-bold leading-[1.15] tracking-tight text-[var(--color-brand-text)]">
          Choose your
          <br />
          home parish.
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-[var(--color-brand-secondary)]">
          Mass times, the day's mystery and your walking distances are all measured from here.
          You can change it any time.
        </p>

        <div className="mt-5 flex items-center gap-2.5 px-4 py-3 rounded-full bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)]">
          <Search className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${PARISHES.length} parishes`}
            aria-label={`Search ${PARISHES.length} parishes`}
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[16px] text-[var(--color-brand-text)] placeholder:text-[var(--color-brand-secondary)]"
          />
        </div>

        {/* Said once, here, rather than repeated on every row. */}
        {gpsStatus !== "granted" && (
          <p className="mt-3 text-[15px] text-[var(--color-brand-secondary)]">
            Turn on location to see which parishes are nearest.
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-2">
        {rows.length === 0 && (
          <p className="py-8 text-center text-[16px] text-[var(--color-brand-secondary)]">
            No parish matches "{query.trim()}".
          </p>
        )}
        {rows.map(({ parish, metres }) => (
          <div key={parish.id}>
          <ParishListRow
            parish={{
              id: parish.id,
              name: parish.name,
              // Flagged, because these assignments are inferred from the
              // nearest vicariate seat, not taken from the diocese.
              meta: parish.vicariate ? `${parish.vicariate} (unconfirmed)` : undefined,
              coordinates: parish.coordinates,
              isLive: parish.status === "live",
            }}
            distanceMeters={metres}
            selected={selected === parish.id}
            onSelect={setSelected}
          />
          </div>
        ))}
      </div>

      <div className="shrink-0 px-5 pt-3 pb-5 border-t border-[var(--color-brand-border)] bg-[var(--color-brand-card)]">
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onChoose(selected)}
          className="w-full py-3.5 rounded-full text-[16px] font-semibold bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] disabled:opacity-40"
        >
          Continue
        </button>
        <p className="mt-2.5 text-center text-[15px] text-[var(--color-brand-secondary)]">
          Diocese of Kalookan · {PARISHES.length} parishes
        </p>
      </div>
    </div>
  );
}
