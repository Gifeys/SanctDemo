import { useEffect, useMemo, useState } from "react";
import { Search as SearchIcon, Clock } from "lucide-react";
import { usePresence } from "../context/PresenceContext";
import { searchParishesScored } from "../lib/mapSearch";
import { MASS_SCHEDULES } from "../data";
import { nextMass } from "../lib/schedule";
import { type Coordinates } from "../lib/geo";
import ParishListRow from "./ParishListRow";
import parishData from "../data/diocese-parishes.json";

interface DioceseParish {
  id: string;
  name: string;
  vicariate: string;
  coordinates: Coordinates;
  status: string;
}

const PARISHES = (parishData as { parishes: DioceseParish[] }).parishes;

const LIVE_ROUTE_ID: Record<string, string> = {
  "mary-help-of-christians-parish": "route-mhcp",
  "san-roque-cathedral": "route-src",
};

const RECENT_KEY = "sanctiwalk.recentSearches";
const MAX_RECENT = 4;

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, MAX_RECENT) : [];
  } catch {
    // Storage may be unavailable (private mode, quota). Recents are a
    // convenience; losing them must never break search.
    return [];
  }
}

function pushRecent(parishId: string): string[] {
  const next = [parishId, ...loadRecent().filter(id => id !== parishId)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

/**
 * The design offers four filters: Parishes, Mass soon, Confession, Places.
 *
 * Only two of those have data behind them. Confession times were never
 * collected — they are a line on the parish sheet the field team is still
 * filling in — and "Places" means non-parish landmarks, of which this app has
 * none. Rather than render two chips that quietly return nothing, they are
 * absent, and the screen says what is missing.
 */
type Filter = "parishes" | "mass-soon";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "parishes", label: "Parishes" },
  { id: "mass-soon", label: "Mass soon" },
];

interface SearchScreenProps {
  onSelectParish: (parishId: string) => void;
  onClose: () => void;
}

export default function SearchScreen({ onSelectParish, onClose }: SearchScreenProps) {
  const { position } = usePresence();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("parishes");
  const [recent, setRecent] = useState<string[]>(() => loadRecent());
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const searchable = useMemo(
    () =>
      PARISHES.map(p => ({
        id: p.id,
        name: p.name,
        location: p.vicariate ?? "",
        coordinates: p.coordinates,
      })),
    [],
  );

  const results = useMemo<{ parish: { id: string; name: string }; distanceMeters: number | null }[]>(() => {
    const hits = query.trim()
      ? searchParishesScored(query, searchable, { origin: position })
      : searchable.map(p => ({ parish: p, score: 0, distanceMeters: null as number | null }));

    if (filter !== "mass-soon") return hits;

    // "Mass soon" can only mean something for the parishes whose schedule has
    // actually been collected — two of thirty-one today.
    return hits.filter(h => {
      const routeId = LIVE_ROUTE_ID[h.parish.id];
      const schedule = routeId ? MASS_SCHEDULES[routeId] : undefined;
      if (!schedule?.schedule) return false;
      const upcoming = nextMass(schedule.schedule, now);
      if (!upcoming) return false;
      const hours = (upcoming.date.getTime() - now.getTime()) / 3_600_000;
      return hours >= 0 && hours <= 6;
    });
  }, [query, filter, position?.lat, position?.lng, searchable, now]);

  const choose = (parishId: string) => {
    setRecent(pushRecent(parishId));
    onSelectParish(parishId);
  };

  const showRecent = !query.trim() && filter === "parishes" && recent.length > 0;

  return (
    <div className="flex-1 flex flex-col bg-[var(--color-brand-card)] min-h-0">
      <div className="px-4 pt-5 pb-3 shrink-0 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-full bg-[var(--color-brand-card-sunk)] border border-[var(--color-brand-border)]">
            <SearchIcon className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search parishes"
              aria-label="Search parishes"
              className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[16px] text-[var(--color-brand-text)] placeholder:text-[var(--color-brand-secondary)]"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[16px] font-semibold text-[var(--color-brand-primary)] shrink-0"
          >
            Cancel
          </button>
        </div>

        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`text-[15px] font-semibold px-3.5 py-1.5 rounded-full border ${
                filter === f.id
                  ? "bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] border-[var(--color-brand-primary)]"
                  : "bg-[var(--color-brand-card)] text-[var(--color-brand-secondary)] border-[var(--color-brand-border)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-2">
        {showRecent && (
          <>
            <p className="pt-1 pb-1 text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
              Recent
            </p>
            {recent
              .map(id => PARISHES.find(p => p.id === id))
              .filter((p): p is DioceseParish => Boolean(p))
              .map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choose(p.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--color-brand-card)] border border-[var(--color-brand-border)] text-left"
                >
                  <Clock className="w-4 h-4 text-[var(--color-brand-secondary)] shrink-0" />
                  <span className="text-[16px] text-[var(--color-brand-text)]">{p.name}</span>
                </button>
              ))}
            <p className="pt-4 pb-1 text-[14px] font-mono uppercase tracking-[0.14em] text-[var(--color-brand-secondary)]">
              All parishes
            </p>
          </>
        )}

        {results.length === 0 && (
          <p className="py-8 text-center text-[16px] leading-relaxed text-[var(--color-brand-secondary)]">
            {filter === "mass-soon"
              ? "No Mass in the next six hours at a parish whose schedule has been collected. Only 2 of 31 have times so far."
              : `No parish matches "${query.trim()}".`}
          </p>
        )}

        {results.map(({ parish, distanceMeters }) => {
          const full = PARISHES.find(p => p.id === parish.id)!;
          return (
            <div key={parish.id}>
            <ParishListRow
              parish={{
                id: parish.id,
                name: parish.name,
                meta: full.vicariate ? `${full.vicariate} (unconfirmed)` : undefined,
                coordinates: full.coordinates,
                isLive: full.status === "live",
              }}
              distanceMeters={distanceMeters}
              onSelect={choose}
            />
            </div>
          );
        })}

        {/* The two filters the design shows that this data cannot answer yet.
            Named rather than silently dropped, so it reads as a known gap
            being worked on and not as a feature that was forgotten. */}
        <p className="pt-5 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
          Confession times and non-parish landmarks are not searchable yet — both are still
          being collected by the field team.
        </p>
      </div>
    </div>
  );
}
