import type { ActivityKind } from './activityLog'

/**
 * Reading the activity log back.
 *
 * ## Why this exists
 *
 * `activityLog.ts` has been writing sign-ins, station visits and station
 * comments to Firestore since the check-in feature was built, and until
 * now nothing read any of it. The parish was being recorded and shown
 * nothing - which is the worst of both arrangements, since the data is
 * collected whether or not anybody benefits from it.
 *
 * ## Why the maths is out here
 *
 * It is arithmetic over timestamps, and arithmetic belongs where it can
 * be tested. Inside the dashboard component it could only be checked by
 * signing in as an administrator of a parish with months of real
 * activity behind it, which is not a thing that exists during
 * development.
 *
 * ## One deliberate omission
 *
 * Nothing here identifies a person. The log carries a uid, and it is
 * used only to count how many DISTINCT people appear - never to list
 * them, never to show what any one of them did. A parish asking "how
 * many came on Sunday" is asking a different question from "who came on
 * Sunday", and only the first is answered.
 */

export interface ActivityEntry {
  uid: string
  kind: ActivityKind
  summary: string
  churchId: string
  /** ISO 8601, as written by activityLog. */
  createdAt: string
}

export interface HourBucket {
  hour: number
  count: number
}

export interface WeekdayBucket {
  weekday: number
  label: string
  count: number
}

export interface DayBucket {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  count: number
  visitors: number
}

export interface StationCount {
  stationId: string
  count: number
}

export const ACTIVITY_KINDS: ActivityKind[] = [
  'sign_in', 'station_visit', 'station_comment',
]

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * The station a logged sentence refers to.
 *
 * The log was written as prose - "Checked in at station st-altar" - and
 * the station id was never stored in a field of its own. Rather than
 * leave the existing rows unreadable, the id is recovered from the
 * sentence. New rows carry a `stationId` field as well; this remains the
 * fallback for everything written before that.
 */
export function stationIdFrom(summary: string): string | null {
  const match = /\bstation\s+(\S+)/i.exec(summary ?? '')
  return match ? match[1] : null
}

/** A timestamp, or null when the row carries something unparseable. */
function at(entry: ActivityEntry): Date | null {
  const date = new Date(entry.createdAt)
  return Number.isNaN(date.getTime()) ? null : date
}

/** How many distinct people appear, however often each one does. */
export function uniqueVisitors(entries: ActivityEntry[]): number {
  return new Set(entries.map(e => e.uid)).size
}

/** How often each feature was used. Every kind is named, including zero. */
export function countsByKind(entries: ActivityEntry[]): Record<ActivityKind, number> {
  const counts = Object.fromEntries(
    ACTIVITY_KINDS.map(k => [k, 0]),
  ) as Record<ActivityKind, number>

  for (const entry of entries) {
    if (entry.kind in counts) counts[entry.kind] += 1
  }
  return counts
}

/** Activity by hour of the day, all twenty-four of them. */
export function visitsByHour(entries: ActivityEntry[]): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }))
  for (const entry of entries) {
    const when = at(entry)
    if (when) buckets[when.getHours()].count += 1
  }
  return buckets
}

/**
 * The busiest hour, or null when nothing has been recorded.
 *
 * Null rather than 0, because 0 is midnight: reporting midnight as a
 * parish's peak visiting hour on the strength of no data at all would be
 * a confident falsehood.
 */
export function peakHour(entries: ActivityEntry[]): number | null {
  const buckets = visitsByHour(entries)
  const busiest = buckets.reduce((best, b) => (b.count > best.count ? b : best))
  return busiest.count === 0 ? null : busiest.hour
}

/** Activity by day of the week, Sunday first. */
export function visitsByWeekday(entries: ActivityEntry[]): WeekdayBucket[] {
  const buckets: WeekdayBucket[] = WEEKDAY_LABELS.map((label, weekday) => ({
    weekday, label, count: 0,
  }))
  for (const entry of entries) {
    const when = at(entry)
    if (when) buckets[when.getDay()].count += 1
  }
  return buckets
}

/** Local calendar date as YYYY-MM-DD. */
function dateKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * The last `days` days up to and including today, oldest first.
 *
 * Both the number of events and the number of distinct people are
 * carried, because they answer different questions: twenty visits from
 * one pilgrim walking a tour is not twenty pilgrims.
 */
export function dailyVisits(
  entries: ActivityEntry[],
  days: number,
  now: Date,
): DayBucket[] {
  const order: string[] = []
  const counts = new Map<string, { count: number; visitors: Set<string> }>()

  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
    const key = dateKey(day)
    order.push(key)
    counts.set(key, { count: 0, visitors: new Set() })
  }

  for (const entry of entries) {
    const when = at(entry)
    if (!when) continue
    const bucket = counts.get(dateKey(when))
    if (!bucket) continue // Outside the window.
    bucket.count += 1
    bucket.visitors.add(entry.uid)
  }

  return order.map(date => {
    const bucket = counts.get(date)!
    return { date, count: bucket.count, visitors: bucket.visitors.size }
  })
}

/**
 * The most engaged-with stations.
 *
 * A comment counts alongside a visit. Both are someone stopping at that
 * station and doing something there, which is what "most visited area"
 * is asking about.
 */
export function topStations(entries: ActivityEntry[], limit: number): StationCount[] {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const stationId = stationIdFrom(entry.summary)
    if (!stationId) continue
    counts.set(stationId, (counts.get(stationId) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([stationId, count]) => ({ stationId, count }))
    .sort((a, b) => b.count - a.count || a.stationId.localeCompare(b.stationId))
    .slice(0, limit)
}

export interface AnalyticsSummary {
  totalEvents: number
  uniqueVisitors: number
  peakHour: number | null
  byKind: Record<ActivityKind, number>
  byHour: HourBucket[]
  byWeekday: WeekdayBucket[]
  daily: DayBucket[]
  topStations: StationCount[]
}

/** Everything the dashboard shows, from one pass over the log. */
export function summariseActivity(
  entries: ActivityEntry[],
  now: Date,
  days = 7,
  stations = 5,
): AnalyticsSummary {
  return {
    totalEvents: entries.length,
    uniqueVisitors: uniqueVisitors(entries),
    peakHour: peakHour(entries),
    byKind: countsByKind(entries),
    byHour: visitsByHour(entries),
    byWeekday: visitsByWeekday(entries),
    daily: dailyVisits(entries, days, now),
    topStations: topStations(entries, stations),
  }
}

/** "2 PM", for an hour number. Midnight and noon named rather than "12". */
export function formatHour(hour: number | null): string {
  if (hour === null) return "—"
  if (hour === 0) return "midnight"
  if (hour === 12) return "noon"
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}
