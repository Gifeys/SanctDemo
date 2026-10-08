const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface MassScheduleEntry {
  day: string
  /** One or more times for this day, comma separated: "6:00 AM, 8:00 AM". */
  time: string
  /**
   * Times on this day the parish has temporarily suspended.
   *
   * A list of exceptions, not a flag per time, for the same reason
   * closedApplications is: absent means everything runs, so every parish
   * that has never touched this keeps its full schedule. The strings
   * match the entries in `time` exactly.
   *
   * Suspended, not deleted: the app still SHOWS a 8:00 AM Mass marked
   * "Not available", because a parishioner who turns up at 8 needs to
   * know the Mass exists and is off, not to find no mention of it and
   * assume they misremembered.
   */
  unavailableTimes?: string[]
  /** "No 6pm Mass during the renovation" - shown with the day. */
  note?: string
}

/** True unless the parish has suspended this particular Mass. */
export function isTimeAvailable(entry: MassScheduleEntry, time: string): boolean {
  return !(entry.unavailableTimes ?? []).includes(time.trim())
}

/** The times on this day that are actually being celebrated. */
export function availableTimes(entry: MassScheduleEntry): string[] {
  return parseTimes(entry.time).filter((t) => isTimeAvailable(entry, t))
}

/** Adds or removes one time from a day's suspended list. */
export function withTimeAvailability(
  entry: MassScheduleEntry,
  time: string,
  available: boolean,
): MassScheduleEntry {
  const next = new Set(entry.unavailableTimes ?? [])
  if (available) next.delete(time.trim())
  else next.add(time.trim())
  const list = [...next]
  // Dropped entirely when empty rather than written as [], so a parish
  // that never suspends anything keeps the document it always had.
  const { unavailableTimes: _old, ...rest } = entry
  return list.length > 0 ? { ...rest, unavailableTimes: list } : rest
}

export interface NextMass {
  day: string
  time: string
  date: Date
}

export function parseTimes(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function toMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return NaN

  let hours = Number(match[1]) % 12
  const minutes = Number(match[2])
  if (match[3].toUpperCase() === 'PM') hours += 12

  return hours * 60 + minutes
}

export function nextMass(schedule: MassScheduleEntry[], now: Date): NextMass | null {
  if (schedule.length === 0) return null

  // Suspended Masses are not candidates for "the next Mass". Telling
  // someone to come at 8 for a Mass the parish has called off is the one
  // failure this whole feature exists to prevent.
  const byDay = new Map(schedule.map((s) => [s.day, availableTimes(s)]))
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  for (let offset = 0; offset < 8; offset++) {
    const dayName = DAYS[(now.getDay() + offset) % 7]
    const times = byDay.get(dayName)
    if (!times) continue

    // Sort by clock time rather than trusting the data's order — parish data
    // is hand-entered, and "4:30 PM, 6:00 AM" would otherwise report the
    // afternoon Mass as the next one.
    const ordered = times
      .filter((t) => !Number.isNaN(toMinutes(t)))
      .sort((a, b) => toMinutes(a) - toMinutes(b))

    for (const time of ordered) {
      const minutes = toMinutes(time)
      if (offset === 0 && minutes <= nowMinutes) continue

      const date = new Date(now)
      date.setDate(date.getDate() + offset)
      date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)

      return { day: dayName, time, date }
    }
  }

  return null
}

/**
 * How long a Mass is assumed to run, in minutes.
 *
 * An ordinary Sunday or weekday Mass in a Philippine parish runs roughly an
 * hour; a sung or Tagalog Mass often runs longer. Sixty is the honest middle,
 * and the consequence of being wrong is small in one direction and large in
 * the other: saying "in progress" a few minutes after it ended simply sends
 * someone into a quiet church, whereas saying "not on" while it is still
 * being celebrated turns them away from the door.
 */
export const MASS_DURATION_MINUTES = 60

/** Within this many minutes of the hour, a Mass counts as about to start. */
export const MASS_STARTING_SOON_MINUTES = 30

export type MassState = 'in-progress' | 'starting-soon' | 'none'

export interface MassStatus {
  state: MassState
  /** The Mass this refers to, e.g. "6:00 AM". Null when state is 'none'. */
  time: string | null
  /** Minutes until it starts (starting-soon), or since it began (in-progress). */
  minutes: number
}

/**
 * Whether a Mass is happening right now, or about to.
 *
 * This is the thing a mapping app cannot answer and a parish app must: not
 * "when is the next Mass" but "can I still walk in". It reads only today's
 * entry, because a Mass tomorrow is not happening now — `nextMass` already
 * answers the forward-looking question.
 */
export function massStatus(
  schedule: MassScheduleEntry[],
  now: Date,
  { durationMinutes = MASS_DURATION_MINUTES, soonMinutes = MASS_STARTING_SOON_MINUTES } = {},
): MassStatus {
  const today = schedule.find((entry) => entry.day === DAYS[now.getDay()])
  if (!today) return { state: 'none', time: null, minutes: 0 }

  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const times = parseTimes(today.time)
    .map((time) => ({ time, at: toMinutes(time) }))
    .filter((t) => Number.isFinite(t.at))
    // Hand-entered data arrives in whatever order someone typed it, so
    // "4:30 PM, 6:00 AM" must not report the afternoon Mass as the earlier.
    .sort((a, b) => a.at - b.at)

  // In progress wins over starting soon: standing outside at 6:05 with a
  // 6:00 and a 6:30 Mass, the useful fact is that one is already under way.
  for (const { time, at } of times) {
    const since = nowMinutes - at
    if (since >= 0 && since < durationMinutes) {
      return { state: 'in-progress', time, minutes: since }
    }
  }

  for (const { time, at } of times) {
    const until = at - nowMinutes
    if (until > 0 && until <= soonMinutes) {
      return { state: 'starting-soon', time, minutes: until }
    }
  }

  return { state: 'none', time: null, minutes: 0 }
}
