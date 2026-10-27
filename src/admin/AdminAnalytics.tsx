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
  summarisePageEvents, monthlyActiveUsers, withTrailingMonths,
  type MonthlyUsers, type PageEvent, type PageEventTotals,
} from "../lib/pageEvents";
import UsersOverTime from "./UsersOverTime";

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

  /* The `visits` and `users` subscriptions used to live here, feeding
     the parish-geofence figures and the registered/active counts.

     Removed with the display they fed. They were onSnapshot LISTENERS
     on two whole collections, re-reading every time anything changed,
     and keeping them to populate numbers nobody looks at would spend
     the parish's Firestore quota on nothing. */

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
        {/* The parish-geofence figures used to be here: "Estimated
            visits", "Visitors", a daily chart and a by-parish list,
            all counted from a phone reporting itself within
            the geofence radius of the church.

            Removed on the parish's instruction. They answer "who came
            to the building", and what this page is for is "who used
            the app" - two different questions, and having both on one
            screen made the one they wanted hard to find. The records
            themselves are untouched; only this display is gone, so
            nothing is lost if it is ever wanted back.

            "Registered users" and "Active users" went with them, for
            the same reason: the parish asked for the page to answer
            who is USING the app, and every extra figure beside that
            made the answer harder to see. */}

        {/* The "Nothing recorded yet" panel stood here, explaining that
            station check-ins appear once pilgrims sign in.
            
            Removed: an empty box explaining why it is empty is the
            largest thing on a page whose job is to show four numbers.
            The station activity below still renders whenever there IS
            activity to show. */}

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
  // Derived from the same rows this already reads, so the chart costs
  // no additional Firestore reads.
  const [monthly, setMonthly] = useState<MonthlyUsers[]>([]);

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
        setMonthly(monthlyActiveUsers(rows));
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

      {/* The chart, here rather than only on the dashboard.
          This is the page the parish opens when they want to know
          who is using SanctiWalk, so it is where they looked for the
          graph and did not find it. */}
      <div className="mt-3 rounded-2xl border border-[var(--color-brand-border)] bg-[var(--color-brand-card)] p-4">
        <h3 className="text-[15px] font-bold text-[var(--color-brand-text)]">
          People using SanctiWalk each month
        </h3>
        <p className="mb-3 text-[13px] leading-relaxed text-[var(--color-brand-secondary)]">
          How many different people opened the app in each month.
          {since && ` Counting began ${since}, so anything before that reads as zero because nobody was counting, not because nobody came.`}
        </p>
        <UsersOverTime data={withTrailingMonths(monthly, 6)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Figure
          label="Opened the app"
          value={totals.opens}
          hint="Every time somebody opened SanctiWalk, on the web or on a phone."
        />
        <Figure
          label="Downloads"
          value={totals.downloads}
          hint="Taps on Download for Android. Downloading twice usually means the first one failed."
        />
      </div>

    </section>
  );
}
