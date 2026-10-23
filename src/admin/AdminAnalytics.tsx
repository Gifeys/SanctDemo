import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { db } from "../lib/firebase";
import AdminNav from "./AdminNav";
import { signOutNow } from "../lib/authFlow";
import type { AdminSession } from "./AdminApp";
import { ROUTES } from "../data";
import {
  formatHour, summariseActivity,
  type ActivityEntry, type AnalyticsSummary,
} from "../lib/analytics";
import {
  ACTIVE_WINDOW_MS, countActive, summariseVisits,
  type VisitDoc, type VisitSummary,
} from "../lib/visits";
import {
  summarisePageEvents, type PageEvent, type PageEventTotals,
} from "../lib/pageEvents";

/**
 * What the parish's visitors did, as opposed to what they asked for.
 *
 * ## Why this screen exists separately from the dashboard
 *
 * The dashboard answers "what is waiting for me" - applications needing
 * a decision. This answers "what is happening in the church", and the
 * two are read at different times by different people. Putting visitor
 * figures above an application queue would also push the work down the
 * page behind numbers nobody has to act on.
 *
 * ## What it deliberately does not show
 *
 * Nobody is named. The log carries a user id and this screen uses it
 * only to count distinct people - never to list them, never to show
 * what any one person did. "How many came on Sunday" and "who came on
 * Sunday" are different questions, and the parish office has not been
 * given the second one.
 *
 * ## Why the empty state says what it says
 *
 * A table of zeros cannot distinguish "nobody came" from "nothing is
 * being recorded". Until there is at least one entry this screen says
 * which of the two it is, rather than drawing an empty chart that looks
 * like a measurement.
 */

/** How far back the figures go. A fortnight covers two Sundays. */
const WINDOW_DAYS = 14;

/**
 * The radius quoted in the honesty note, read from the parish's own
 * record rather than written here twice. presence.ts is what actually
 * decides; this only has to describe it accurately.
 */
const GEOFENCE_M = ROUTES.find(r => r.geofenceRadius)?.geofenceRadius ?? 100;

export default function AdminAnalytics({ session }: { session: AdminSession }) {
  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const churchId = session.profile.churchId;

  // Filtered on churchId here AND in the security rules, like every other
  // admin screen: the filter makes it correct, the rule makes it safe.
  useEffect(() => {
    const q = query(collection(db, "activity"), where("churchId", "==", churchId));
    return onSnapshot(
      q,
      snap => setEntries(snap.docs.map(d => d.data() as ActivityEntry)),
      err => setError(err.message),
    );
  }, [churchId]);

  const summary = useMemo<AnalyticsSummary | null>(
    () => (entries === null ? null : summariseActivity(entries, new Date(), WINDOW_DAYS)),
    [entries],
  );

  // Estimated visits and the parish's own users.
  //
  // Both filtered on churchId here AND in the rules, like every other
  // admin screen: the filter makes it correct, the rule makes it safe.
  const [visits, setVisits] = useState<VisitDoc[] | null>(null);
  const [people, setPeople] = useState<{ role?: string; lastActiveAt?: string }[] | null>(null);

  useEffect(() => {
    const q = query(collection(db, "visits"), where("churchId", "==", churchId));
    return onSnapshot(
      q,
      snap => setVisits(snap.docs.map(d => d.data() as VisitDoc)),
      err => setError(err.message),
    );
  }, [churchId]);

  useEffect(() => {
    const q = query(collection(db, "users"), where("churchId", "==", churchId));
    return onSnapshot(
      q,
      snap => setPeople(snap.docs.map(d => d.data() as { role?: string; lastActiveAt?: string })),
      err => setError(err.message),
    );
  }, [churchId]);

  const visitSummary = useMemo<VisitSummary | null>(
    () => (visits === null ? null : summariseVisits(visits, WINDOW_DAYS, new Date())),
    [visits],
  );

  /** Ordinary pilgrims. An administrator is not one of the parish's users. */
  const registered = useMemo(
    () => (people === null ? null : people.filter(p => (p.role ?? "user") === "user").length),
    [people],
  );

  const activeNow = useMemo(
    () => (people === null ? null
      : countActive(people.filter(p => (p.role ?? "user") === "user"), new Date())),
    [people],
  );

  const stationName = useStationNames(churchId);

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)]">
      <header className="bg-[var(--color-brand-primary)] text-[var(--color-brand-on-accent)] px-4 pt-6 pb-5">
        <p className="text-[13px] font-bold uppercase tracking-wider opacity-80">
          Parish office
        </p>
        <h1 className="text-[24px] font-bold font-serif italic">Visitor activity</h1>
        <button
          onClick={() => void signOutNow()}
          className="mt-3 rounded-full border border-white/40 px-4 py-1.5 text-[14px] font-semibold"
        >
          Sign out
        </button>
      </header>

      <main className="px-4 py-5 max-w-[900px] mx-auto">
        <AdminNav />

        {error && (
          <p role="alert" className="mb-4 rounded-2xl bg-[#FBE9E4] border border-[#E7C3B8] px-4 py-3 text-[15px] text-[var(--color-brand-error)]">
            {error}
          </p>
        )}

        <ReachPanel />

        {summary === null && (
          <div className="py-12 text-center">
            <Loader2 className="mx-auto w-6 h-6 animate-spin text-[var(--color-brand-primary)]" />
          </div>
        )}

        {/* The four figures the parish asked for, above everything
            else. A parish opens this to ask "how many", and the station
            breakdown below answers a different question. */}
        {visitSummary !== null && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Figure label="Registered users" value={registered ?? "—"}
                      hint="pilgrims with an account at this parish" />
              <Figure label="Estimated visits" value={visitSummary.total}
                      hint="geolocation-detected, all time" />
              <Figure label="Active users" value={activeNow ?? "—"}
                      hint={`in the last ${Math.round(ACTIVE_WINDOW_MS / 60000)} minutes`} />
              <Figure label="Visitors" value={visitSummary.visitors}
                      hint="distinct people behind those visits" />
            </div>

            <Panel
              title={`Estimated visits, last ${WINDOW_DAYS} days`}
              note="Counted when a signed-in pilgrim's device reports it is within this parish's geofence."
            >
              {visitSummary.total === 0 ? (
                <p className="text-[15px] text-[var(--color-brand-secondary)]">
                  No visits recorded yet. A visit appears here when a
                  signed-in pilgrim arrives at the parish with location
                  turned on.
                </p>
              ) : (
                <Bars
                  data={visitSummary.daily.map(d => ({
                    key: d.date,
                    label: d.date.slice(8),
                    value: d.count,
                  }))}
                />
              )}
            </Panel>

            <Panel
              title="Visits by parish"
              note="You see your own parish only. The security rules refuse another parish's records, which is why this list is not diocese-wide."
            >
              {visitSummary.byChurch.length === 0 ? (
                <p className="text-[15px] text-[var(--color-brand-secondary)]">
                  Nothing recorded yet.
                </p>
              ) : (
                <Rows
                  data={visitSummary.byChurch.map(c => ({
                    key: c.churchId,
                    label: parishLabel(c.churchId),
                    value: c.count,
                  }))}
                />
              )}
            </Panel>

            <p className="mb-6 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
              <strong>Estimated</strong> is the operative word. A visit is
              recorded when a phone reports being within {GEOFENCE_M} metres
              of this parish, which is proximity and not proof of entry:
              somebody passing on the street counts, and satellite accuracy
              in a built-up area is often worse than that radius. Only
              signed-in pilgrims are counted, and the same person is counted
              once per parish every two hours. No location is stored — a
              record holds the parish, the time, and an account identifier,
              and nothing else.
            </p>
          </>
        )}

        {summary !== null && summary.totalEvents === 0 && (
          <div className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] px-5 py-8 text-center">
            <p className="text-[16px] font-semibold text-[var(--color-brand-text)]">
              Nothing recorded yet
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-brand-secondary)]">
              Activity appears here once pilgrims sign in and check in at
              stations on the tour. Visitors who are not signed in are not
              counted.
            </p>
          </div>
        )}

        {summary !== null && summary.totalEvents > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Figure label="People" value={summary.uniqueVisitors}
                      hint="distinct signed-in visitors" />
              <Figure label="Activity" value={summary.totalEvents}
                      hint="recorded events" />
              <Figure label="Busiest hour" value={formatHour(summary.peakHour)}
                      hint="across all days" />
              <Figure label="Check-ins" value={summary.byKind.station_visit}
                      hint="at tour stations" />
            </div>

            <Panel title="When people come"
                   note="By hour of the day, all recorded activity.">
              <Bars
                data={summary.byHour.map(h => ({
                  key: String(h.hour),
                  label: h.hour % 6 === 0 ? formatHour(h.hour) : "",
                  value: h.count,
                }))}
              />
            </Panel>

            <Panel title="Which days"
                   note="Sunday first. A parish's week is not a working week.">
              <Rows
                data={summary.byWeekday.map(d => ({
                  key: d.label, label: d.label, value: d.count,
                }))}
              />
            </Panel>

            <Panel
              title={`The last ${WINDOW_DAYS} days`}
              note="Activity, and the number of distinct people behind it."
            >
              <table className="w-full text-[15px]">
                <thead>
                  <tr className="text-left text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
                    <th className="py-1.5">Date</th>
                    <th className="py-1.5 text-right">Activity</th>
                    <th className="py-1.5 text-right">People</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.daily.map(d => (
                    <tr key={d.date} className="border-t border-[var(--color-brand-border)]">
                      <td className="py-1.5 tabular-nums">{d.date}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.count}</td>
                      <td className="py-1.5 text-right tabular-nums">{d.visitors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            <Panel
              title="Most visited stations"
              note="Check-ins and comments together: both are someone stopping there."
            >
              {summary.topStations.length === 0 ? (
                <p className="text-[15px] text-[var(--color-brand-secondary)]">
                  No station check-ins recorded yet.
                </p>
              ) : (
                <Rows
                  data={summary.topStations.map(s => ({
                    key: s.stationId,
                    label: stationName(s.stationId),
                    value: s.count,
                  }))}
                />
              )}
            </Panel>

            <Panel title="Which features are used"
                   note="Every recorded kind, including those at zero.">
              <Rows
                data={[
                  { key: "sign_in", label: "Sign-ins", value: summary.byKind.sign_in },
                  { key: "station_visit", label: "Station check-ins", value: summary.byKind.station_visit },
                  { key: "station_comment", label: "Station comments", value: summary.byKind.station_comment },
                ]}
              />
            </Panel>

            <p className="mt-6 text-[14px] leading-relaxed text-[var(--color-brand-secondary)]">
              These figures count signed-in visitors only, and no individual
              is identified. A pilgrim who browses without signing in is not
              recorded at all, so the numbers are a floor rather than a
              count of everyone who came.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

/**
 * Station ids back into the names the parish knows them by.
 *
 * The log stores an id. "st-altar-mayor" on a report to a parish priest
 * is not an answer to "which part of my church do people stop at".
 */
/** The parish's own name, rather than its id, in the breakdown. */
function parishLabel(churchId: string): string {
  const route = ROUTES.find(r => r.id === churchId);
  return route ? route.name.replace(" Guide", "").replace(" Tour", "") : churchId;
}

function useStationNames(churchId: string): (id: string) => string {
  return useMemo(() => {
    const route = ROUTES.find(r => r.id === churchId);
    const names = new Map<string, string>();
    for (const station of route?.stations ?? []) names.set(station.id, station.name);
    // Falls back to the id rather than hiding the row: a station that has
    // been renamed or removed still had people standing at it.
    return (id: string) => names.get(id) ?? id;
  }, [churchId]);
}

function Figure({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
      <p className="text-[13px] font-bold uppercase tracking-wider text-[var(--color-brand-secondary)]">
        {label}
      </p>
      <p className="mt-1 text-[26px] font-bold leading-tight text-[var(--color-brand-text)]">
        {value}
      </p>
      <p className="mt-0.5 text-[13px] text-[var(--color-brand-secondary)]">{hint}</p>
    </div>
  );
}

function Panel({ title, note, children }: {
  title: string; note: string; children: React.ReactNode;
}) {
  return (
    <section className="mb-5 rounded-[18px] border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-5">
      <h2 className="text-[17px] font-bold font-serif italic text-[var(--color-brand-text)]">
        {title}
      </h2>
      <p className="mt-0.5 mb-3 text-[14px] text-[var(--color-brand-secondary)]">{note}</p>
      {children}
    </section>
  );
}

interface Datum { key: string; label: string; value: number }

/** A column per bucket. For the hours, where there are twenty-four. */
function Bars({ data }: { data: Datum[] }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <div className="flex items-end gap-[3px] h-[120px]" role="img"
         aria-label={data.map(d => `${d.key}: ${d.value}`).join(", ")}>
      {data.map(d => (
        <div key={d.key} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <div
            className="w-full rounded-t-[3px] bg-[var(--color-brand-primary)]"
            style={{ height: `${Math.max(d.value === 0 ? 0 : 3, (d.value / max) * 100)}%` }}
            title={`${d.key}: ${d.value}`}
          />
          <span className="text-[10px] text-[var(--color-brand-secondary)] whitespace-nowrap">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A labelled row per item, for short lists where the name matters. */
function Rows({ data }: { data: Datum[] }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <ul className="space-y-2">
      {data.map(d => (
        <li key={d.key} className="flex items-center gap-3">
          <span className="w-[42%] shrink-0 truncate text-[15px] text-[var(--color-brand-text)]"
                title={d.label}>
            {d.label}
          </span>
          <span className="flex-1 h-[10px] rounded-full bg-[var(--color-brand-card-sunk)] overflow-hidden">
            <span
              className="block h-full rounded-full bg-[var(--color-brand-primary)]"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </span>
          <span className="w-[3ch] shrink-0 text-right text-[15px] font-semibold tabular-nums text-[var(--color-brand-text)]">
            {d.value}
          </span>
        </li>
      ))}
    </ul>
  );
}


/**
 * How many found the app at all, and how many took it away.
 *
 * Separate from the visit figures above it because it answers a
 * different question: those are about people inside a church, these
 * are about everyone who opened SanctiWalk anywhere. Most of them
 * never sign in and are not standing near a parish, so they appear in
 * nothing else on this page.
 *
 * Counts, not names. The same decision as the rest of this screen:
 * "how many downloaded it" and "who downloaded it" are different
 * questions and only the first is answered here. There is nothing in
 * the record that reaches a person.
 */
function ReachPanel() {
  const [totals, setTotals] = useState<PageEventTotals | null>(null);
  const [since, setSince] = useState<string | null>(null);

  useEffect(() => {
    const stop = onSnapshot(
      collection(db, "pageEvents"),
      snap => {
        const rows: PageEvent[] = [];
        let earliest: number | null = null;
        snap.forEach(doc => {
          const d = doc.data() as {
            kind?: string;
            visitorId?: string;
            createdAt?: { toDate?: () => Date };
          };
          const when = d.createdAt?.toDate?.();
          if (!when) return;
          if (earliest === null || when.getTime() < earliest) earliest = when.getTime();
          if (d.kind !== "open" && d.kind !== "download") return;
          rows.push({ kind: d.kind, visitorId: d.visitorId ?? "", at: when.toISOString() });
        });
        setTotals(summarisePageEvents(rows));
        setSince(earliest === null ? null : new Date(earliest).toLocaleDateString());
      },
      () => setTotals(null),
    );
    return stop;
  }, []);

  if (totals === null) return null;

  return (
    <section className="mb-5">
      <h2 className="text-[18px] font-bold text-[var(--color-brand-text)]">
        Reach
      </h2>
      <p className="text-[14px] leading-snug text-[var(--color-brand-secondary)]">
        {since
          ? `Everyone who opened SanctiWalk or downloaded it, counted since ${since}.`
          : "Everyone who opened SanctiWalk or downloaded it."}{" "}
        Nobody is named.
      </p>

      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Figure
          label="Opened the app"
          value={totals.opens}
          hint="Every time somebody opened SanctiWalk, on the web or on a phone."
        />
        <Figure
          label="Different people"
          value={totals.people}
          hint="Distinct browsers. Forty opens from four people is not forty people."
        />
        <Figure
          label="Downloads"
          value={totals.downloads}
          hint="Taps on Download for Android. Downloading twice usually means the first one failed."
        />
        <Figure
          label="Different downloaders"
          value={totals.downloaders}
          hint="Distinct browsers that downloaded it at least once."
        />
      </div>
    </section>
  );
}
