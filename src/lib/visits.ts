/**
 * Estimated church visits, and who is using the app.
 *
 * ## What a "visit" is here, and what it is not
 *
 * A visit is recorded when the app's own presence detection says the
 * pilgrim is inside a parish's geofence - 100 metres of its verified
 * coordinates, held for long enough to clear the dwell gate in
 * presence.ts. That is proximity, not entry. A pilgrim standing in the
 * street outside, or in the hall next door, is indistinguishable from
 * one at the altar, and consumer GPS in a built-up area is routinely
 * out by more than the radius.
 *
 * So the figure is called an ESTIMATED visit everywhere it appears,
 * and nothing in this file should ever be described as proof that
 * somebody entered a church.
 *
 * ## What is stored
 *
 * The church, the time, and the uid. No coordinates, no track, no
 * history of where anybody went - only that somebody was near this
 * parish at this time. The uid is there because it is the only way to
 * tell twenty visits from twenty visitors, and because the security
 * rules need it to refuse a record written on somebody else's behalf.
 */

import { haversineMeters, type Coordinates } from './geo'

export interface VisitDoc {
  /** Who. Needed to separate visits from visitors, and by the rules. */
  uid: string
  churchId: string
  /** ISO 8601. */
  at: string
}

/**
 * How long before the same person at the same church counts again.
 *
 * The geofence re-fires every time GPS drifts across its boundary, and
 * near a wall that can be several times a minute. Without this, one
 * pilgrim praying a rosary would register as a crowd.
 *
 * Two hours: long enough to cover a Mass and the time around it, short
 * enough that somebody returning for an evening devotion is counted
 * again, which they should be.
 */
export const VISIT_COOLDOWN_MS = 2 * 60 * 60 * 1000

/** The window the dashboard calls "active". */
export const ACTIVE_WINDOW_MS = 15 * 60 * 1000

/** The key a device remembers its last visit under. */
export function visitKey(uid: string, churchId: string): string {
  return `sanctiwalk.visit.${uid}.${churchId}`
}

/**
 * Whether to write a visit, given when this device last wrote one.
 *
 * A `lastAt` in the future is treated as "not yet due". A clock that
 * has jumped backwards would otherwise make every crossing count.
 */
export function shouldRecordVisit(lastAt: number | null, now: number): boolean {
  if (lastAt === null) return true
  if (lastAt > now) return false
  return now - lastAt >= VISIT_COOLDOWN_MS
}

export interface ActiveLike {
  lastActiveAt?: string
}

/** How many of these profiles were seen inside the active window. */
export function countActive(profiles: ActiveLike[], now: Date): number {
  const floor = now.getTime() - ACTIVE_WINDOW_MS
  let n = 0
  for (const profile of profiles) {
    if (!profile.lastActiveAt) continue
    const seen = new Date(profile.lastActiveAt).getTime()
    if (Number.isNaN(seen)) continue
    if (seen >= floor && seen <= now.getTime() + 60_000) n += 1
  }
  return n
}

export interface ChurchCount {
  churchId: string
  count: number
}

export interface VisitDay {
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  count: number
}

export interface VisitSummary {
  /** Every visit on record, not only those in the chart's window. */
  total: number
  /** Distinct people behind those visits. */
  visitors: number
  churchesWithVisits: number
  byChurch: ChurchCount[]
  daily: VisitDay[]
}

function dateKey(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/** Everything the dashboard shows, from one pass over the records. */
export function summariseVisits(
  visits: VisitDoc[],
  days: number,
  now: Date,
): VisitSummary {
  const perChurch = new Map<string, number>()
  const people = new Set<string>()

  const order: string[] = []
  const perDay = new Map<string, number>()
  for (let back = days - 1; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back)
    const key = dateKey(day)
    order.push(key)
    perDay.set(key, 0)
  }

  for (const v of visits) {
    perChurch.set(v.churchId, (perChurch.get(v.churchId) ?? 0) + 1)
    if (v.uid) people.add(v.uid)

    const when = new Date(v.at)
    if (Number.isNaN(when.getTime())) continue
    const key = dateKey(when)
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }

  return {
    total: visits.length,
    visitors: people.size,
    churchesWithVisits: perChurch.size,
    byChurch: [...perChurch.entries()]
      .map(([churchId, count]) => ({ churchId, count }))
      .sort((a, b) => b.count - a.count || a.churchId.localeCompare(b.churchId)),
    daily: order.map(date => ({ date, count: perDay.get(date) ?? 0 })),
  }
}

/**
 * Distance from a position to a church, for the honesty note on the
 * dashboard. Re-exported so the admin screen does not reach into geo.
 */
export function metresFrom(a: Coordinates, b: Coordinates): number {
  return haversineMeters(a, b)
}
