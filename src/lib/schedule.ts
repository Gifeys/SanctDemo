const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface MassScheduleEntry {
  day: string
  time: string
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

  const byDay = new Map(schedule.map((s) => [s.day, parseTimes(s.time)]))
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
